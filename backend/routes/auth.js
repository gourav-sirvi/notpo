const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

// Register User (Standard)
router.post('/register', async (req, res) => {
    const { name, email, password, role, institution, course, subject, bio, qualification, experience, semester, learning_style } = req.body;
    
    if (!name || !email || !password || !role) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    if (role !== 'teacher' && role !== 'student') {
        return res.status(400).json({ error: 'Invalid role' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const query = `INSERT INTO User (name, email, password, role, institution, course, subject, bio, qualification, experience, semester, learning_style)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        db.run(query, [name, email, hashedPassword, role, institution||null, course||null, subject||null, bio||null, qualification||null, experience||null, semester||null, learning_style||null], function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'Email already exists' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ message: `${role} registered successfully`, id: this.lastID });
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Login User (Standard)
router.post('/login', (req, res) => {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const query = `SELECT * FROM User WHERE email = ? AND role = ?`;
    db.get(query, [email, role], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(400).json({ error: 'Invalid credentials or role' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        
        res.json({
            message: 'Logged in successfully',
            token,
            user: {
                id: user.id, name: user.name, email: user.email, role: user.role,
                profile_picture: user.profile_picture,
                institution: user.institution, course: user.course, subject: user.subject,
                bio: user.bio, qualification: user.qualification, experience: user.experience,
                semester: user.semester, learning_style: user.learning_style
            }
        });
    });
});

// Sync Google Auth to internal User table
router.post('/google', (req, res) => {
    const { email, name, role, firebaseUid, photoUrl } = req.body;
    
    if (!email || !name || !role) {
        return res.status(400).json({ error: 'Missing required Google Auth details' });
    }

    const query = `SELECT * FROM User WHERE email = ?`;
    db.get(query, [email], async (err, existingUser) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (existingUser) {
            // Update the profile picture if it was empty
            if (photoUrl && !existingUser.profile_picture) {
                db.run('UPDATE User SET profile_picture = ? WHERE id = ?', [photoUrl, existingUser.id]);
                existingUser.profile_picture = photoUrl;
            }

            const token = jwt.sign({ id: existingUser.id, role: existingUser.role }, JWT_SECRET, { expiresIn: '7d' });
            return res.json({
                message: 'Logged in successfully',
                token,
                user: { id: existingUser.id, name: existingUser.name, email: existingUser.email, role: existingUser.role, profile_picture: existingUser.profile_picture }
            });
        } else {
            // User doesn't exist, create them.
            const dummyPassword = await bcrypt.hash(firebaseUid + Math.random().toString(), 10);
            const insertQuery = `INSERT INTO User (name, email, password, role, profile_picture) VALUES (?, ?, ?, ?, ?)`;
            
            db.run(insertQuery, [name, email, dummyPassword, role, photoUrl], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                
                const newUserId = this.lastID;
                const token = jwt.sign({ id: newUserId, role }, JWT_SECRET, { expiresIn: '7d' });
                
                res.status(201).json({
                    message: 'Google user registered and logged in successfully',
                    token,
                    user: { id: newUserId, name, email, role, profile_picture: photoUrl }
                });
            });
        }
    });
});

// Direct Password Reset (MVP approach without email sending)
router.post('/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
        return res.status(400).json({ error: 'Email and new password are required' });
    }

    try {
        // First check if user exists
        db.get(`SELECT id FROM User WHERE email = ?`, [email], async (err, user) => {
            if (err) return res.status(500).json({ error: 'Database error while checking user' });
            if (!user) return res.status(404).json({ error: 'User with this email does not exist' });

            // User exists, hash the new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Update password in DB
            db.run(`UPDATE User SET password = ? WHERE email = ?`, [hashedPassword, email], function(updateErr) {
                if (updateErr) return res.status(500).json({ error: 'Error updating password' });
                res.json({ message: 'Password reset successfully. You can now log in.' });
            });
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error during password reset' });
    }
});

module.exports = router;
