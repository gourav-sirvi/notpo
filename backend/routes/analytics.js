const express = require('express');
const db = require('../database');
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');

const router = express.Router();

// @route   GET /api/analytics/student
// @desc    Get performance and progress analytics for the current student
router.get('/student', authenticateToken, authorizeRole('student'), (req, res) => {
    const studentId = req.user.id;
    const stats = {};

    db.serialize(() => {
        // 1. Completion Stats
        db.get(`
            SELECT 
                COUNT(*) as total_lectures,
                SUM(CASE WHEN lp.status = 'completed' THEN 1 ELSE 0 END) as completed_lectures,
                SUM(CASE WHEN lp.status = 'started' THEN 1 ELSE 0 END) as started_lectures
            FROM ClassroomStudent e
            LEFT JOIN Lecture l ON e.classroom_id = l.classroom_id
            LEFT JOIN LectureProgress lp ON l.lecture_id = lp.lecture_id AND lp.user_id = ?
            WHERE e.student_id = ?`, 
            [studentId, studentId], (err, row) => {
                if (err) return res.status(500).json({ error: err.message });
                stats.progress = row;
            });

        // 2. Quiz Stats
        db.get(`
            SELECT 
                AVG(score) as avg_score,
                COUNT(*) as quizzes_taken
            FROM QuizScore 
            WHERE student_id = ?`, 
            [studentId], (err, row) => {
                if (err) return res.status(500).json({ error: err.message });
                stats.quizzes = row;
            });

        // 3. Bookmark Stats
        db.get('SELECT COUNT(*) as bookmark_count FROM Bookmark WHERE user_id = ?', [studentId], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            stats.bookmarks = row.bookmark_count;
        });

        // 4. Performance by classroom
        db.all(`
            SELECT 
                c.name as classroom_name,
                COUNT(l.lecture_id) as total_lectures,
                SUM(CASE WHEN lp.status = 'completed' THEN 1 ELSE 0 END) as completed
            FROM ClassroomStudent e
            JOIN Classroom c ON e.classroom_id = c.id
            LEFT JOIN Lecture l ON c.id = l.classroom_id
            LEFT JOIN LectureProgress lp ON l.lecture_id = lp.lecture_id AND lp.user_id = ?
            WHERE e.student_id = ?
            GROUP BY c.id`, 
            [studentId, studentId], (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                stats.classroom_performance = rows;
                res.json(stats);
            });
    });
});

// @route   GET /api/analytics/teacher/:classId
// @desc    Get engagement and performance analytics for a specific classroom
router.get('/teacher/:classId', authenticateToken, authorizeRole('teacher'), (req, res) => {
    const { classId } = req.params;
    const teacherId = req.user.id;
    const stats = {};

    // Verify ownership
    db.get('SELECT id FROM Classroom WHERE id = ? AND teacher_id = ?', [classId, teacherId], (err, classroom) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!classroom) return res.status(403).json({ error: 'Unauthorized' });

        db.serialize(() => {
            // 1. Lecture Engagement (Started vs Completed per lecture)
            db.all(`
                SELECT 
                    l.title,
                    l.lecture_id,
                    COUNT(lp.id) as total_engagement,
                    SUM(CASE WHEN lp.status = 'completed' THEN 1 ELSE 0 END) as completions
                FROM Lecture l
                LEFT JOIN LectureProgress lp ON l.lecture_id = lp.lecture_id
                WHERE l.classroom_id = ?
                GROUP BY l.lecture_id`, 
                [classId], (err, rows) => {
                    stats.engagement = rows;
                });

            // 2. Quiz Performance per lecture
            db.all(`
                SELECT 
                    l.title,
                    AVG(qs.score) as avg_score,
                    COUNT(qs.id) as submissions
                FROM Lecture l
                LEFT JOIN QuizScore qs ON l.lecture_id = qs.lecture_id
                WHERE l.classroom_id = ?
                GROUP BY l.lecture_id`, 
                [classId], (err, rows) => {
                    stats.quiz_performance = rows;
                });

            // 3. Feedback Averages per lecture
            db.all(`
                SELECT 
                    l.title,
                    AVG(lf.rating) as avg_rating,
                    COUNT(lf.id) as feedback_count
                FROM Lecture l
                LEFT JOIN LectureFeedback lf ON l.lecture_id = lf.lecture_id
                WHERE l.classroom_id = ?
                GROUP BY l.lecture_id`, 
                [classId], (err, rows) => {
                    if (err) return res.status(500).json({ error: err.message });
                    stats.feedback = rows;
                });

            // 4. Per-student performance summary
            db.all(`
                SELECT 
                    u.id, u.name, u.email, u.institution,
                    COUNT(DISTINCT l.lecture_id) as total_lectures,
                    COUNT(DISTINCT lp.lecture_id) as completed_lectures,
                    ROUND(AVG(qs.score) * 10, 0) as avg_score_pct,
                    COUNT(DISTINCT qs.id) as quizzes_taken
                FROM ClassroomStudent e
                JOIN User u ON e.student_id = u.id
                LEFT JOIN Lecture l ON l.classroom_id = e.classroom_id
                LEFT JOIN LectureProgress lp ON lp.lecture_id = l.lecture_id AND lp.user_id = u.id AND lp.status = 'completed'
                LEFT JOIN QuizScore qs ON qs.lecture_id = l.lecture_id AND qs.student_id = u.id
                WHERE e.classroom_id = ?
                GROUP BY u.id`,
                [classId], (err, rows) => {
                    if (err) return res.status(500).json({ error: err.message });
                    stats.students = rows;
                    res.json(stats);
                });
        });
    });
});

module.exports = router;
