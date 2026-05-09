const express = require('express');
const db = require('../database');
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');

const router = express.Router();

// Generate a random 6-character code
const generateJoinCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// @route   POST /api/classrooms/create
// @desc    [TEACHER] Create a new classroom
router.post('/create', authenticateToken, authorizeRole('teacher'), (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Classroom name required' });

    const teacher_id = req.user.id;
    const join_code = generateJoinCode();

    db.run('INSERT INTO Classroom (teacher_id, name, join_code) VALUES (?, ?, ?)', [teacher_id, name, join_code], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, name, join_code });
    });
});

// @route   POST /api/classrooms/join
// @desc    [STUDENT] Join a classroom using a code
router.post('/join', authenticateToken, authorizeRole('student'), (req, res) => {
    const { join_code } = req.body;
    if (!join_code) return res.status(400).json({ error: 'Join code required' });

    const student_id = req.user.id;

    db.get('SELECT id FROM Classroom WHERE join_code = ?', [join_code], (err, classroom) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!classroom) return res.status(404).json({ error: 'Invalid classroom code' });

        db.run('INSERT INTO ClassroomStudent (classroom_id, student_id) VALUES (?, ?)', [classroom.id, student_id], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'You are already enrolled in this class' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.status(200).json({ message: 'Successfully joined classroom', classroom_id: classroom.id });
        });
    });
});

// @route   GET /api/classrooms
// @desc    [BOTH] Get classrooms relevant to user (teacher's own, or student's enrolled)
router.get('/', authenticateToken, (req, res) => {
    const user_id = req.user.id;
    const role = req.user.role;

    if (role === 'teacher') {
        db.all(`
            SELECT c.*,
                (SELECT COUNT(*) FROM ClassroomStudent cs WHERE cs.classroom_id = c.id) AS student_count
            FROM Classroom c
            WHERE c.teacher_id = ?
            ORDER BY c.created_at DESC
        `, [user_id], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    } else {
        const query = `
            SELECT c.*, u.name as teacher_name, u.profile_picture as teacher_profile_picture 
            FROM Classroom c
            JOIN ClassroomStudent cs ON c.id = cs.classroom_id
            JOIN User u ON c.teacher_id = u.id
            WHERE cs.student_id = ?
            ORDER BY cs.enrolled_at DESC
        `;
        db.all(query, [user_id], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    }
});

// @route   GET /api/classrooms/:id/students
// @desc    [TEACHER] Get all students and their lecture quiz scores for a classroom
router.get('/:id/students', authenticateToken, authorizeRole('teacher'), (req, res) => {
    const classroom_id = req.params.id;
    const teacher_id = req.user.id;

    // First ensure the teacher owns this classroom
    db.get('SELECT id FROM Classroom WHERE id = ? AND teacher_id = ?', [classroom_id, teacher_id], (err, classroom) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!classroom) return res.status(403).json({ error: 'Unauthorized to view this classroom' });

        // Get total lectures in this classroom to calculate attendance percentage
        db.get('SELECT COUNT(*) as count FROM Lecture WHERE classroom_id = ?', [classroom_id], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            const totalLectures = row ? row.count : 0;

            // Get students, aggregated quiz score, and completed lectures
            const query = `
                SELECT 
                    u.id as student_id, 
                    u.name, 
                    u.email,
                    u.profile_picture,
                    COUNT(DISTINCT qs.id) as quizzes_taken,
                    AVG(qs.score) as average_score,
                    COUNT(DISTINCT lp.id) as lectures_completed
                FROM User u
                JOIN ClassroomStudent cs ON u.id = cs.student_id
                LEFT JOIN QuizScore qs ON u.id = qs.student_id 
                    AND qs.lecture_id IN (SELECT lecture_id FROM Lecture WHERE classroom_id = ?)
                LEFT JOIN LectureProgress lp ON u.id = lp.user_id 
                    AND lp.status = 'completed'
                    AND lp.lecture_id IN (SELECT lecture_id FROM Lecture WHERE classroom_id = ?)
                WHERE cs.classroom_id = ?
                GROUP BY u.id
                ORDER BY u.name ASC
            `;
            
            db.all(query, [classroom_id, classroom_id, classroom_id], (err, students) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ totalLectures, students });
            });
        });
    });
});

// @route   GET /api/classrooms/:id/study-guide
// @desc    [STUDENT] Generate a master study guide from all class lectures
router.get('/:id/study-guide', authenticateToken, async (req, res) => {
    const classroom_id = req.params.id;
    
    // 1. Fetch all detailed summaries for this classroom
    const query = `
        SELECT l.title, s.content 
        FROM Lecture l
        JOIN Summary s ON l.lecture_id = s.lecture_id
        WHERE l.classroom_id = ? AND s.level = 'detailed' AND l.status = 'completed'
    `;
    
    db.all(query, [classroom_id], async (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!rows || rows.length === 0) {
            return res.status(400).json({ error: 'No completed lectures found to generate a study guide.' });
        }

        const aggregatedNotes = rows.map(r => `## ${r.title}\n${r.content}`).join('\n\n');

        const prompt = `
You are an expert AI tutor. A student is preparing for an exam based on the following lecture summaries.
Generate a comprehensive, highly readable Master Study Guide in Markdown format.
Include:
- A high-level overview of the course so far.
- Key concepts and their definitions categorized logically across all lectures.
- A "Must-Know" section summarizing the most critical points.
- 5 mock review questions at the very end to test their knowledge.

Use headings, bullet points, and bold text to make it easy to read.
Do not wrap your response in JSON. Return ONLY the markdown.

Lecture Summaries:
\${aggregatedNotes}
`;

        try {
            const Groq = require('groq-sdk');
            const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'MISSING' });
            
            const completion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: 'llama3-70b-8192',
                temperature: 0.4,
                max_tokens: 3000
            });

            const studyGuideMarkdown = completion.choices[0]?.message?.content?.trim();
            res.json({ studyGuide: studyGuideMarkdown });
        } catch (error) {
            console.error('Study Guide Gen Error:', error.message);
            res.status(500).json({ error: 'Failed to generate study guide via Groq AI.' });
        }
    });
});

// @route   POST /api/classrooms/:id/students/:studentId/alert
// @desc    [TEACHER] Generate an AI intervention plan for a struggling student
router.post('/:id/students/:studentId/alert', authenticateToken, authorizeRole('teacher'), (req, res) => {
    const { id: classroom_id, studentId } = req.params;
    const { studentName, attendanceStr, avgScoreStr } = req.body;

    // Fetch the student's recent wrong answers for context
    const query = `
        SELECT qs.answers_json, l.title
        FROM QuizScore qs
        JOIN Lecture l ON qs.lecture_id = l.lecture_id
        WHERE qs.student_id = ? AND l.classroom_id = ?
        ORDER BY qs.taken_at DESC LIMIT 5
    `;

    db.all(query, [studentId, classroom_id], async (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        let contextText = `Student Name: ${studentName}\nAttendance: ${attendanceStr}\nAverage Score: ${avgScoreStr}\n\n`;
        if (rows && rows.length > 0) {
            contextText += "Recent Quiz Submissions:\n";
            rows.forEach(r => {
                contextText += `- Lecture "${r.title}": ${r.answers_json}\n`;
            });
        }

        const prompt = `
You are an expert Teacher's Assistant AI.
Analyze the following struggling student's performance data and generate a short, actionable Intervention Plan for the teacher.
Keep it strictly under 150 words. Be empathetic and highly specific to the data provided.
Do not use markdown. Just plain text paragraphs.

Data:
\${contextText}
`;
        try {
            const Groq = require('groq-sdk');
            const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'MISSING' });
            
            const completion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: 'llama3-70b-8192',
                temperature: 0.5,
                max_tokens: 300
            });

            res.json({ alertPlan: completion.choices[0]?.message?.content?.trim() });
        } catch (error) {
            console.error('AI Alert Error:', error.message);
            res.status(500).json({ error: 'Failed to generate AI alert.' });
        }
    });
});

module.exports = router;
