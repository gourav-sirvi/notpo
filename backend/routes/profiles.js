const express = require('express');
const db = require('../database');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, 'profile-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// @route   GET /api/profiles/me
// @desc    Get current user's profile
router.get('/me', authenticateToken, (req, res) => {
    const user_id = req.user.id;
    
    db.get(`SELECT id, name, email, role, profile_picture, created_at,
            institution, course, subject, bio, qualification, experience, semester, learning_style
            FROM User WHERE id = ?`, [user_id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'User not found' });
        res.json(row);
    });
});

// @route   POST /api/profiles/upload-photo
// @desc    Upload or update profile picture
router.post('/upload-photo', authenticateToken, upload.single('photo'), (req, res) => {
    const user_id = req.user.id;
    
    if (!req.file) {
        return res.status(400).json({ error: 'No photo uploaded' });
    }

    const photoUrl = `/uploads/${req.file.filename}`;

    db.run('UPDATE User SET profile_picture = ? WHERE id = ?', [photoUrl, user_id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Profile photo updated successfully', profile_picture: photoUrl });
    });
});

// @route   PUT /api/profiles/me
// @desc    Update current user's profile (including extended fields)
router.put('/me', authenticateToken, async (req, res) => {
    const user_id = req.user.id;
    const { name, email, password, institution, course, subject, bio, qualification, experience, semester, learning_style } = req.body;
    
    if (!name || !email) {
        return res.status(400).json({ error: "Name and email are required" });
    }

    try {
        let query, params;

        if (password) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            query = `UPDATE User SET name=?, email=?, password=?, institution=?, course=?, subject=?, bio=?, qualification=?, experience=?, semester=?, learning_style=? WHERE id=?`;
            params = [name, email, hashedPassword, institution||null, course||null, subject||null, bio||null, qualification||null, experience||null, semester||null, learning_style||null, user_id];
        } else {
            query = `UPDATE User SET name=?, email=?, institution=?, course=?, subject=?, bio=?, qualification=?, experience=?, semester=?, learning_style=? WHERE id=?`;
            params = [name, email, institution||null, course||null, subject||null, bio||null, qualification||null, experience||null, semester||null, learning_style||null, user_id];
        }

        db.run(query, params, function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Profile updated successfully' });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

