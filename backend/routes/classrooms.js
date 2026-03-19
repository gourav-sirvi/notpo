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
        db.all('SELECT * FROM Classroom WHERE teacher_id = ? ORDER BY created_at DESC', [user_id], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    } else {
        const query = `
            SELECT c.*, u.name as teacher_name 
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

        // Get students and their aggregated quiz score in this class
        const query = `
            SELECT 
                u.id as student_id, 
                u.name, 
                u.email,
                COUNT(qs.id) as quizzes_taken,
                AVG(qs.score) as average_score
            FROM User u
            JOIN ClassroomStudent cs ON u.id = cs.student_id
            LEFT JOIN QuizScore qs ON u.id = qs.student_id 
                AND qs.lecture_id IN (SELECT lecture_id FROM Lecture WHERE classroom_id = ?)
            WHERE cs.classroom_id = ?
            GROUP BY u.id
            ORDER BY u.name ASC
        `;
        db.all(query, [classroom_id, classroom_id], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });
});

module.exports = router;
