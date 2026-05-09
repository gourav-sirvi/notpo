const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../database');
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');
const { transcribeOffline } = require('../helpers/audioUtils'); // <-- Offline STT
const Groq = require('groq-sdk');

const router = express.Router();

// --- IN-MEMORY JOB QUEUE SYSTEM ---
class JobQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
    }

    push(task) {
        this.queue.push(task);
        this.processNext();
    }

    async processNext() {
        if (this.isProcessing || this.queue.length === 0) return;
        this.isProcessing = true;
        const task = this.queue.shift();
        try {
            await task();
        } catch (err) {
            console.error("Queue task failed:", err);
        } finally {
            this.isProcessing = false;
            this.processNext();
        }
    }
}

const aiQueue = new JobQueue();

// --- OLLAMA BACKGROUND WORKER ---
async function processLectureAI(lectureId, transcriptText, audioFilePath) {
    console.log(`[Worker] Starting AI processing for Lecture ${lectureId}...`);
    
    // --- SERVER-SIDE OFFLINE STT (IF BROWSER FAILED) ---
    if (!transcriptText || transcriptText.trim().length < 20 || transcriptText.includes('No audio transcribed')) {
        console.log(`[Worker] Transcript too short or missing. Executing Server-Side STT using Whisper-Tiny on ${audioFilePath}...`);
        try {
            // Reconstruct absolute path to uploads folder
            const absoluteAudioPath = path.join(__dirname, '..', audioFilePath);
            const generatedText = await transcribeOffline(absoluteAudioPath);
            if (generatedText && generatedText.trim().length > 5) {
                transcriptText = generatedText.trim();
                // Immediately save the valid transcript back to DB for the frontend to view
                db.run('UPDATE Lecture SET transcript = ? WHERE lecture_id = ?', [transcriptText, lectureId]);
                console.log(`[Worker] Successfully transcribed audio natively: ${transcriptText.substring(0, 50)}...`);
            }
        } catch (err) {
            console.error(`[Worker] Server-Side Whisper STT failed: ${err.message}. Proceeding with fallback...`);
            transcriptText = 'This lecture had an audio file but transcription failed. Please generate generic educational content.';
        }
    }

    const generateNotesPrompt = (text) => `
You are an AI study assistant. Analyze the lecture transcript and return ONLY a valid JSON object. No extra text, no markdown.

Return exactly this JSON structure:
{
  "notes": {
    "easy": [
      "Point 1", "Point 2", "Point 3", "Point 4", "Point 5"
    ],
    "medium": [
      "Point 1", "Point 2", "Point 3", "Point 4", "Point 5",
      "Point 6", "Point 7", "Point 8", "Point 9", "Point 10"
    ],
    "detailed": [
      "Point 1", "Point 2", "Point 3", "Point 4", "Point 5",
      "Point 6", "Point 7", "Point 8", "Point 9", "Point 10",
      "Point 11", "Point 12", "Point 13", "Point 14", "Point 15",
      "Point 16", "Point 17", "Point 18", "Point 19", "Point 20"
    ]
  },
  "key_concepts": ["Concept one", "Concept two", "(up to 5 concepts)"],
  "timestamps": [
    { "topic": "Introduction", "time_seconds": 0 },
    { "topic": "Major Topic 1", "time_seconds": 120 }
  ]
}

STRICT RULES:
1. CRITICAL: DO NOT copy the placeholder text (e.g. "Concept one", "Generate 1st simple point"). You MUST extract REAL information and REAL key concepts from the actual transcript.
2. notes.easy MUST have EXACTLY 5 distinct points extracted from the transcript.
3. notes.medium MUST have EXACTLY 10 distinct points. Do not stop at 5.
4. notes.detailed MUST have EXACTLY 20 distinct points AND must include real examples from the lecture. Do not stop early!
5. timestamps MUST include 3 to 10 major topic shifts with an estimated time in seconds (assume average speaking rate if exact timestamps aren't in text).
6. Return NO backticks, NO markdown, ONLY valid JSON.

Lecture Transcript:
"${text}"
`;

    const generateQuizPrompt = (detailedNotes) => `
You are an AI quiz generator. Create multiple choice questions and flashcards strictly based on the provided summary notes.
Return ONLY a valid JSON object. No extra text, no markdown.

Return exactly this JSON structure:
{
  "flashcards": [
    {"front": "A direct question based on the notes?", "back": "The exact answer from the notes."}
  ],
  "mcqs": [
    {"question": "A multiple choice question?", "options": ["Valid Option A", "Valid Option B", "Valid Option C", "Valid Option D"], "answer": "C"}
  ]
}

STRICT RULES:
1. CRITICAL: DO NOT output placeholder text like "A multiple choice question?" or "Valid Option A". You MUST generate REAL questions and REAL answers based on the summary notes!
2. flashcards MUST have EXACTLY 5 items.
3. mcqs MUST have EXACTLY 5 questions, each with exactly 4 options. 'answer' must be strictly A, B, C, or D.
4. Return NO backticks, NO markdown, ONLY valid JSON.

Lecture Summary Notes:
${JSON.stringify(detailedNotes)}
`;

    // Helper to safely call Groq with retries
    async function runGroqCall(promptString, stepName) {
        let retries = 3;
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'MISSING' });
        
        while (retries > 0) {
            try {
                console.log(`[Worker] Calling Groq API for ${stepName} (attempt ${4 - retries}/3)...`);
                const completion = await groq.chat.completions.create({
                    messages: [{ role: 'user', content: promptString }],
                    model: 'llama3-70b-8192',
                    temperature: 0.3,
                    response_format: { type: "json_object" }
                });

                const responseText = completion.choices[0]?.message?.content?.trim();
                if (!responseText) throw new Error('Empty response from Groq');
                
                return JSON.parse(responseText);
            } catch (err) {
                retries--;
                console.error(`[Worker] ${stepName} attempt failed. Retries left: ${retries}. Error:`, err.message);
                if (retries === 0) throw err;
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    }

    // Guard: if transcript is too short
    if (!transcriptText || transcriptText.trim().length < 20) {
        console.warn(`[Worker] Lecture ${lectureId} has very short transcript. AI might struggle.`);
        transcriptText = transcriptText || 'This lecture had no audio transcription. Please generate generic educational content.';
    }

    let data = {};
    try {
        console.log(`[Worker] Phase 1: Summarizing Notes for Lecture ${lectureId}`);
        const notesObj = await runGroqCall(generateNotesPrompt(transcriptText), 'Notes Generation');
        
        console.log(`[Worker] Phase 2: Generating Q&A from Notes for Lecture ${lectureId}`);
        // Extract the detailed notes array to pass to the Quiz AI. Fallback to transcript if missing.
        const summaryDataArray = (notesObj.notes && notesObj.notes.detailed) ? notesObj.notes.detailed : [transcriptText.substring(0, 500)];
        const quizObj = await runGroqCall(generateQuizPrompt(summaryDataArray), 'Quiz Generation');

        // Merge results
        data = { ...notesObj, ...quizObj };
        console.log(`[Worker] AI Pipeline complete for Lecture ${lectureId}`);
    } catch (err) {
        db.run('UPDATE Lecture SET status = ? WHERE lecture_id = ?', ['failed', lectureId]);
        console.error(`[Worker] Lecture ${lectureId} permanently failed during AI pipeline.`, err.message);
        return;
    }

    // Save to Database
    db.serialize(() => {
        // 1. Save point-wise notes (new structure)
        const notesObj = data.notes || {};
        const safeSlice = (arr, maxCount) => {
            const result = Array.isArray(arr) ? arr : [];
            return result.slice(0, maxCount);
        };
        const easyNotes   = safeSlice(notesObj.easy, 5);
        const mediumNotes = safeSlice(notesObj.medium, 10);
        const detailNotes = safeSlice(notesObj.detailed, 20);

        // Fallback: if AI returned old 'summary' format, use that as detailed
        const fallbackSummary = data.summary || '';

        const stmtSumm = db.prepare('INSERT INTO Summary (lecture_id, level, content) VALUES (?, ?, ?)');
        stmtSumm.run([lectureId, 'easy',     easyNotes.join('\n')   || fallbackSummary.slice(0, 200)]);
        stmtSumm.run([lectureId, 'medium',   mediumNotes.join('\n') || fallbackSummary.slice(0, 500)]);
        stmtSumm.run([lectureId, 'detailed', detailNotes.join('\n') || fallbackSummary]);
        stmtSumm.finalize();

        // 2. Save Key Concepts
        if (data.key_concepts) {
            const stmtComp = db.prepare('INSERT INTO KeyConcept (lecture_id, concept) VALUES (?, ?)');
            data.key_concepts.forEach(c => stmtComp.run([lectureId, c]));
            stmtComp.finalize();
        }

        // 3. Save Flashcards (enforce max 5)
        if (data.flashcards) {
            const flashcardsToSave = data.flashcards.slice(0, 5);
            const stmtFlash = db.prepare('INSERT INTO Flashcard (lecture_id, front, back) VALUES (?, ?, ?)');
            flashcardsToSave.forEach(f => stmtFlash.run([lectureId, f.front || f.question, f.back || f.answer]));
            stmtFlash.finalize();
        }

        // 4. Save MCQs (enforce max 5)
        if (data.mcqs) {
            const mcqsToSave = data.mcqs.slice(0, 5);
            const stmtMCQ = db.prepare('INSERT INTO MCQ (lecture_id, question, option_a, option_b, option_c, option_d, correct_option) VALUES (?, ?, ?, ?, ?, ?, ?)');
            mcqsToSave.forEach(m => {
                const opts = m.options || [];
                const correctLetter = (m.answer || 'A').length === 1 ? m.answer.toUpperCase() : 'A';
                stmtMCQ.run([lectureId, m.question, opts[0] || 'A', opts[1] || 'B', opts[2] || 'C', opts[3] || 'D', correctLetter]);
            });
            stmtMCQ.finalize();
        }

        // 5. Save Timestamps
        if (data.timestamps && Array.isArray(data.timestamps)) {
            const timestampsStr = JSON.stringify(data.timestamps);
            db.run('UPDATE Lecture SET timestamps_json = ? WHERE lecture_id = ?', [timestampsStr, lectureId]);
        }

        db.run('UPDATE Lecture SET status = ? WHERE lecture_id = ?', ['completed', lectureId]);
        console.log(`[Worker] Lecture ${lectureId} marked as completed.`);
    });
}

const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, 'lecture-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

router.post('/upload', authenticateToken, authorizeRole('teacher'), upload.single('audio'), async (req, res) => {
    const { title, transcript, classroom_id } = req.body;
    const teacher_id = req.user.id;

    if (!req.file || !title || !classroom_id) {
        return res.status(400).json({ error: 'Audio file, title, and classroom_id are required' });
    }

    const audioUrl = `/uploads/${req.file.filename}`;
    const actualTranscript = transcript || '(No audio transcribed. Please ensure microphone permissions are granted and speak clearly.)';

    try {
        db.run('INSERT INTO Lecture (teacher_id, classroom_id, title, audio_file, transcript, status) VALUES (?, ?, ?, ?, ?, ?)', 
            [teacher_id, classroom_id, title, audioUrl, actualTranscript, 'processing'], 
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                const lectureId = this.lastID;

                // Push to Background Queue
                aiQueue.push(() => processLectureAI(lectureId, actualTranscript, audioUrl));

                res.status(201).json({
                    message: 'Lecture uploaded successfully. AI processing started in the background.',
                    lecture_id: lectureId,
                    audio_file: audioUrl
                });
            }
        );
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/lectures/:id/retry
// @desc    [TEACHER] Re-queue a failed lecture for AI processing
router.post('/:id/retry', authenticateToken, authorizeRole('teacher'), (req, res) => {
    const lectureId = req.params.id;
    const teacher_id = req.user.id;

    db.get('SELECT * FROM Lecture WHERE lecture_id = ? AND teacher_id = ?', [lectureId, teacher_id], (err, lecture) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!lecture) return res.status(404).json({ error: 'Lecture not found' });

        // Mark as processing
        db.run('UPDATE Lecture SET status = ? WHERE lecture_id = ?', ['processing', lectureId], (err) => {
            if (err) return res.status(500).json({ error: err.message });

            // Clear old AI-generated data before retry
            db.serialize(() => {
                db.run('DELETE FROM Summary WHERE lecture_id = ?', [lectureId]);
                db.run('DELETE FROM Flashcard WHERE lecture_id = ?', [lectureId]);
                db.run('DELETE FROM MCQ WHERE lecture_id = ?', [lectureId]);
                db.run('DELETE FROM KeyConcept WHERE lecture_id = ?', [lectureId]);
                // Delete user scores so they can retake the new quiz
                db.run('DELETE FROM QuizScore WHERE lecture_id = ?', [lectureId]);
                // Reset progress back to started
                db.run('UPDATE LectureProgress SET status = ? WHERE lecture_id = ?', ['started', lectureId]);
            });

            // Re-queue
            aiQueue.push(() => processLectureAI(lectureId, lecture.transcript || '', lecture.audio_file));
            res.json({ message: 'Lecture re-queued for AI processing.' });
        });
    });
});

// @route   GET /api/lectures
// @desc    Get lectures optionally filtered by classroom_id
router.get('/', authenticateToken, (req, res) => {
    const { classroom_id } = req.query;
    let query = `
        SELECT l.*, u.name as teacher_name, u.profile_picture as teacher_profile_picture
        FROM Lecture l 
        JOIN User u ON l.teacher_id = u.id
    `;
    const params = [];

    if (classroom_id) {
        query += ' WHERE l.classroom_id = ?';
        params.push(classroom_id);
    }
    query += ' ORDER BY l.date DESC';

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// @route   GET /api/lectures/bookmarked
// @desc    Get all bookmarked lectures for the current user
// NOTE: This MUST be defined BEFORE /:id route to avoid wildcard match
router.get('/bookmarked', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const query = `
        SELECT l.*, u.name as teacher_name, u.profile_picture as teacher_profile_picture
        FROM Lecture l 
        JOIN User u ON l.teacher_id = u.id
        JOIN Bookmark b ON l.lecture_id = b.lecture_id
        WHERE b.user_id = ?
        ORDER BY b.created_at DESC
    `;

    db.all(query, [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// @route   GET /api/lectures/:id
// @desc    Get a single lecture with its summaries, flashcards, MCQs, and user interaction status
router.get('/:id', authenticateToken, (req, res) => {
    const lectureId = req.params.id;
    const userId = req.user.id;

    db.get('SELECT l.*, u.name as teacher_name, u.profile_picture as teacher_profile_picture FROM Lecture l JOIN User u ON l.teacher_id = u.id WHERE l.lecture_id = ?', [lectureId], (err, lecture) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!lecture) return res.status(404).json({ error: 'Lecture not found' });

        db.all('SELECT level, content FROM Summary WHERE lecture_id = ?', [lectureId], (err, summaries) => {
            if (err) return res.status(500).json({ error: err.message });

            db.all('SELECT * FROM Flashcard WHERE lecture_id = ?', [lectureId], (err, flashcards) => {
                if (err) return res.status(500).json({ error: err.message });

                db.all('SELECT id, question, option_a, option_b, option_c, option_d FROM MCQ WHERE lecture_id = ?', [lectureId], (err, mcqs) => {
                    if (err) return res.status(500).json({ error: err.message });

                    db.all('SELECT concept FROM KeyConcept WHERE lecture_id = ?', [lectureId], (err, concepts) => {
                        if (err) return res.status(500).json({ error: err.message });

                        // Check if bookmarked
                        db.get('SELECT id FROM Bookmark WHERE user_id = ? AND lecture_id = ?', [userId, lectureId], (err, bookmark) => {
                            if (err) return res.status(500).json({ error: err.message });

                            // Check for existing feedback
                            db.get('SELECT rating, comment FROM LectureFeedback WHERE student_id = ? AND lecture_id = ?', [userId, lectureId], (err, feedback) => {
                                if (err) return res.status(500).json({ error: err.message });

                                // Fetch user quiz score
                                db.get('SELECT score FROM QuizScore WHERE student_id = ? AND lecture_id = ?', [userId, lectureId], (err, scoreRow) => {
                                    if (err) return res.status(500).json({ error: err.message });

                                    let structuredSummaries = { easy: null, medium: null, detailed: null };
                                    summaries.forEach(s => {
                                        structuredSummaries[s.level] = s.content;
                                    });

                                // Fetch progress
                                db.get('SELECT status FROM LectureProgress WHERE user_id = ? AND lecture_id = ?', [userId, lectureId], (err, progress) => {
                                    if (err) return res.status(500).json({ error: err.message });

                                    res.json({
                                        ...lecture,
                                        timestamps: lecture.timestamps_json ? JSON.parse(lecture.timestamps_json) : [],
                                        summaries: structuredSummaries,
                                        flashcards,
                                        mcqs,
                                        key_concepts: concepts.map(c => c.concept),
                                        user_score: scoreRow ? scoreRow.score : null,
                                        user_answers: scoreRow && scoreRow.answers_json ? JSON.parse(scoreRow.answers_json) : null,
                                        isBookmarked: !!bookmark,
                                        userFeedback: feedback || null,
                                        progress: progress ? progress.status : 'not_started'
                                    });
                                });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});

// @route   POST /api/lectures/:id/quiz
// @desc    Submit quiz answers and calculate score out of 5
router.post('/:id/quiz', authenticateToken, authorizeRole('student'), (req, res) => {
    const lectureId = req.params.id;
    const studentId = req.user.id;
    const { answers } = req.body; // { mcq_id: 'A', mcq_id2: 'C' }

    if (!answers) return res.status(400).json({ error: 'Answers payload missing' });

    db.all('SELECT id, correct_option FROM MCQ WHERE lecture_id = ?', [lectureId], (err, mcqs) => {
        if (err) return res.status(500).json({ error: err.message });
        if (mcqs.length === 0) return res.status(404).json({ error: 'No quiz available for this lecture' });

        let score = 0;
        mcqs.forEach(mcq => {
            const studentAns = String(answers[mcq.id] || '').trim().toUpperCase();
            const correctAns = String(mcq.correct_option || '').trim().toUpperCase();
            if (studentAns === correctAns) {
                score++;
            }
        });

        // Insert or UPDATE score using INSERT OR REPLACE logic
        const answersJson = JSON.stringify(answers);
        db.run('INSERT OR REPLACE INTO QuizScore (id, student_id, lecture_id, score, answers_json) VALUES ((SELECT id FROM QuizScore WHERE student_id = ? AND lecture_id = ?), ?, ?, ?, ?)',
            [studentId, lectureId, studentId, lectureId, score, answersJson], function (err) {
                if (err) return res.status(500).json({ error: err.message });

                // Mark lecture as completed in LectureProgress
                db.run(`INSERT INTO LectureProgress (user_id, lecture_id, status, last_accessed) 
                        VALUES (?, ?, 'completed', CURRENT_TIMESTAMP)
                        ON CONFLICT(user_id, lecture_id) DO UPDATE SET 
                        status = 'completed', last_accessed = CURRENT_TIMESTAMP`, 
                        [studentId, lectureId]);

                res.json({ message: 'Quiz submitted successfully', score, maxScore: mcqs.length });
            });
    });
});

// @route   POST /api/lectures/:id/feedback
// @desc    Submit student feedback for a lecture
router.post('/:id/feedback', authenticateToken, authorizeRole('student'), (req, res) => {
    const lectureId = req.params.id;
    const studentId = req.user.id;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Valid rating (1-5) is required' });
    }

    db.run('INSERT INTO LectureFeedback (lecture_id, student_id, rating, comment) VALUES (?, ?, ?, ?)',
        [lectureId, studentId, rating, comment], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Feedback submitted successfully' });
        });
});

// @route   POST /api/lectures/:id/bookmark
// @desc    Toggle bookmark for a lecture
router.post('/:id/bookmark', authenticateToken, (req, res) => {
    const lectureId = req.params.id;
    const userId = req.user.id;

    // Check if bookmark exists
    db.get('SELECT id FROM Bookmark WHERE user_id = ? AND lecture_id = ?', [userId, lectureId], (err, bookmark) => {
        if (err) return res.status(500).json({ error: err.message });

        if (bookmark) {
            // Remove bookmark
            db.run('DELETE FROM Bookmark WHERE id = ?', [bookmark.id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Bookmark removed', isBookmarked: false });
            });
        } else {
            // Add bookmark
            db.run('INSERT INTO Bookmark (user_id, lecture_id) VALUES (?, ?)', [userId, lectureId], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Lecture bookmarked', isBookmarked: true });
            });
        }
    });
});

// @route   POST /api/lectures/:id/progress
// @desc    Update progress for a lecture (started/completed)
router.post('/:id/progress', authenticateToken, (req, res) => {
    const lectureId = req.params.id;
    const userId = req.user.id;
    const { status } = req.body; // 'started' | 'completed'

    db.run(`INSERT INTO LectureProgress (user_id, lecture_id, status, last_accessed) 
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, lecture_id) DO UPDATE SET 
            status = COALESCE(?, status), 
            last_accessed = CURRENT_TIMESTAMP`, 
            [userId, lectureId, status || 'started', status], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Progress updated' });
            });
});

// @route   DELETE /api/lectures/:id
// @desc    Delete a lecture (Teacher only)
router.delete('/:id', authenticateToken, authorizeRole('teacher'), (req, res) => {
    const lectureId = req.params.id;
    const teacherId = req.user.id;

    // First find the lecture to verify ownership and get the audio file path
    db.get('SELECT audio_file FROM Lecture WHERE lecture_id = ? AND teacher_id = ?', [lectureId, teacherId], (err, lecture) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!lecture) return res.status(404).json({ error: 'Lecture not found or unauthorized' });

        // Delete audio file from disk
        if (lecture.audio_file) {
            const absolutePath = path.join(__dirname, '..', lecture.audio_file);
            const fs = require('fs');
            try {
                if (fs.existsSync(absolutePath)) {
                    fs.unlinkSync(absolutePath);
                }
            } catch (fileErr) {
                console.error('Could not delete audio file:', fileErr.message);
            }
        }

        // Manually delete all related child records first (handles old tables without CASCADE)
        db.serialize(() => {
            db.run('DELETE FROM Summary WHERE lecture_id = ?', [lectureId]);
            db.run('DELETE FROM Flashcard WHERE lecture_id = ?', [lectureId]);
            db.run('DELETE FROM MCQ WHERE lecture_id = ?', [lectureId]);
            db.run('DELETE FROM KeyConcept WHERE lecture_id = ?', [lectureId]);
            db.run('DELETE FROM QuizScore WHERE lecture_id = ?', [lectureId]);
            db.run('DELETE FROM LectureFeedback WHERE lecture_id = ?', [lectureId]);
            db.run('DELETE FROM Bookmark WHERE lecture_id = ?', [lectureId]);
            db.run('DELETE FROM LectureProgress WHERE lecture_id = ?', [lectureId]);

            // Now delete the lecture itself
            db.run('DELETE FROM Lecture WHERE lecture_id = ?', [lectureId], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                if (this.changes === 0) return res.status(404).json({ error: 'Lecture not found' });
                res.json({ message: 'Lecture deleted successfully' });
            });
        });
    });
});

// @route   GET /api/lectures/:id/scores
// @desc    [TEACHER] Get all student scores for a specific lecture
router.get('/:id/scores', authenticateToken, authorizeRole('teacher'), (req, res) => {
    const lectureId = req.params.id;
    const teacherId = req.user.id;

    // First ensure the teacher owns this lecture
    db.get('SELECT lecture_id FROM Lecture WHERE lecture_id = ? AND teacher_id = ?', [lectureId, teacherId], (err, lecture) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!lecture) return res.status(403).json({ error: 'Unauthorized to view these scores' });

        const query = `
            SELECT 
                u.id as student_id, 
                u.name, 
                u.email,
                u.profile_picture,
                qs.score,
                qs.taken_at
            FROM QuizScore qs
            JOIN User u ON qs.student_id = u.id
            WHERE qs.lecture_id = ?
            ORDER BY qs.taken_at DESC
        `;
        db.all(query, [lectureId], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });
});

module.exports = router;
