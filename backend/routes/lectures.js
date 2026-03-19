const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../database');
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');
// const { InferenceClient } = require("@huggingface/inference"); // No longer needed

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
async function processLectureAI(lectureId, transcriptText) {
    console.log(`[Worker] Starting AI processing for Lecture ${lectureId}...`);
    
    const generatePrompt = (text) => `
You are an AI study assistant for students.

Step 1:
Clean and rewrite the lecture transcript into clear, grammatically correct sentences.
Fix punctuation and remove repeated words.

Step 2:
Identify the main concepts and topics discussed.

Step 3:
Generate structured study material.

Return ONLY valid JSON in this exact structure:
{
 "summary": "Detailed summary here",
 "key_concepts": ["concept1", "concept2"],
 "flashcards": [
   {"front":"Question?","back":"Answer."}
 ],
 "mcqs":[
   {
     "question":"Question text?",
     "options":["A","B","C","D"],
     "answer":"A"
   }
 ]
}

Rules:
- Flashcards must focus on key concepts.
- MCQs must test understanding, not trivial wording.
- Each MCQ must have exactly 4 options.
- The correct answer must appear in the options list.
- Return ONLY the JSON object. No other text.

Lecture Transcript:
"${text}"
`;

    let retries = 3;
    let data = null;

    while (retries > 0 && !data) {
        try {
            const response = await fetch("http://localhost:11434/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "llama3",
                    prompt: generatePrompt(transcriptText),
                    stream: false,
                    options: {
                        temperature: 0.3
                    }
                })
            });

            if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
            
            const result = await response.json();
            let responseText = result.response.trim();
            
            // Extract JSON if wrapped in markdown
            if (responseText.includes('{')) {
                const start = responseText.indexOf('{');
                const end = responseText.lastIndexOf('}') + 1;
                responseText = responseText.substring(start, end);
            }

            data = JSON.parse(responseText);
        } catch (err) {
            retries--;
            console.error(`[Worker] Attempt failed for Lecture ${lectureId}. Retries left: ${retries}. Error:`, err.message);
            if (retries === 0) {
                db.run('UPDATE Lecture SET status = ? WHERE lecture_id = ?', ['failed', lectureId]);
                return;
            }
            await new Promise(r => setTimeout(r, 2000)); // Wait before retry
        }
    }

    // Save to Database
    db.serialize(() => {
        // 1. Save Summaries
        const stmtSumm = db.prepare('INSERT INTO Summary (lecture_id, level, content) VALUES (?, ?, ?)');
        // Use a simple split of summary for easy/medium if not provided separately
        stmtSumm.run([lectureId, 'easy', data.summary.slice(0, 200) + '...']);
        stmtSumm.run([lectureId, 'medium', data.summary.slice(0, 500) + '...']);
        stmtSumm.run([lectureId, 'detailed', data.summary]);
        stmtSumm.finalize();

        // 2. Save Key Concepts
        if (data.key_concepts) {
            const stmtComp = db.prepare('INSERT INTO KeyConcept (lecture_id, concept) VALUES (?, ?)');
            data.key_concepts.forEach(c => stmtComp.run([lectureId, c]));
            stmtComp.finalize();
        }

        // 3. Save Flashcards
        if (data.flashcards) {
            const stmtFlash = db.prepare('INSERT INTO Flashcard (lecture_id, front, back) VALUES (?, ?, ?)');
            data.flashcards.forEach(f => stmtFlash.run([lectureId, f.front || f.question, f.back || f.answer]));
            stmtFlash.finalize();
        }

        // 4. Save MCQs
        if (data.mcqs) {
            const stmtMCQ = db.prepare('INSERT INTO MCQ (lecture_id, question, option_a, option_b, option_c, option_d, correct_option) VALUES (?, ?, ?, ?, ?, ?, ?)');
            data.mcqs.forEach(m => {
                const opts = m.options || [];
                stmtMCQ.run([lectureId, m.question, opts[0] || 'A', opts[1] || 'B', opts[2] || 'C', opts[3] || 'D', m.answer.length === 1 ? m.answer : 'A']);
            });
            stmtMCQ.finalize();
        }

        db.run('UPDATE Lecture SET status = ? WHERE lecture_id = ?', ['completed', lectureId]);
        console.log(`[Worker] Completed AI processing for Lecture ${lectureId}.`);
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
                aiQueue.push(() => processLectureAI(lectureId, actualTranscript));

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

// @route   GET /api/lectures
// @desc    Get lectures optionally filtered by classroom_id
router.get('/', authenticateToken, (req, res) => {
    const { classroom_id } = req.query;
    let query = `
        SELECT l.*, u.name as teacher_name 
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

// @route   GET /api/lectures/:id
// @desc    Get a single lecture with its summaries, flashcards, MCQs, and user interaction status
router.get('/:id', authenticateToken, (req, res) => {
    const lectureId = req.params.id;
    const userId = req.user.id;

    db.get('SELECT l.*, u.name as teacher_name FROM Lecture l JOIN User u ON l.teacher_id = u.id WHERE l.lecture_id = ?', [lectureId], (err, lecture) => {
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
                                        summaries: structuredSummaries,
                                        flashcards,
                                        mcqs,
                                        key_concepts: concepts.map(c => c.concept),
                                        user_score: scoreRow ? scoreRow.score : null,
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
            if (answers[mcq.id] === mcq.correct_option) {
                score++;
            }
        });

        // Insert or UPDATE score using INSERT OR REPLACE logic
        db.run('INSERT OR REPLACE INTO QuizScore (id, student_id, lecture_id, score) VALUES ((SELECT id FROM QuizScore WHERE student_id = ? AND lecture_id = ?), ?, ?, ?)',
            [studentId, lectureId, studentId, lectureId, score], function (err) {
                if (err) return res.status(500).json({ error: err.message });

                // Mark lecture as completed in LectureProgress
                db.run(`INSERT INTO LectureProgress (user_id, lecture_id, status, last_accessed) 
                        VALUES (?, ?, 'completed', CURRENT_TIMESTAMP)
                        ON CONFLICT(user_id, lecture_id) DO UPDATE SET 
                        status = 'completed', last_accessed = CURRENT_TIMESTAMP`, 
                        [userId, lectureId]);

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

// @route   GET /api/lectures/bookmarked
// @desc    Get all bookmarked lectures for the current user
router.get('/bookmarked', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const query = `
        SELECT l.*, u.name as teacher_name 
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

module.exports = router;
