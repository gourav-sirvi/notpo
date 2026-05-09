const jwt = require('jsonwebtoken');
const db = require('../database');
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access denied, token missing' });

    jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
        if (err) return res.status(401).json({ error: 'Invalid token' });
        
        // Verify user actually exists in DB to prevent foreign key issues from stale tokens
        db.get('SELECT * FROM User WHERE id = ?', [decodedUser.id], (err, user) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!user) return res.status(401).json({ error: 'User no longer exists. Please log in again.' });
            
            req.user = decodedUser;
            next();
        });
    });
};

const authorizeRole = (role) => {
    return (req, res, next) => {
        if (req.user.role !== role) {
            return res.status(403).json({ error: 'Access denied, insufficient permissions' });
        }
        next();
    };
};

module.exports = { authenticateToken, authorizeRole };
