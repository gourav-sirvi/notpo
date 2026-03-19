const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const db = require('./database'); // Initialize database schema

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for audio and uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes placeholder
app.get('/api/health', (req, res) => {
    res.json({ status: 'API is running', timestamp: new Date() });
});
// Routes
const authRoutes = require('./routes/auth');
const lectureRoutes = require('./routes/lectures');
const classroomRoutes = require('./routes/classrooms');
const profileRoutes = require('./routes/profiles');
const chatRoutes = require('./routes/chat');
const analyticsRoutes = require('./routes/analytics');

app.use('/api/auth', authRoutes);
app.use('/api/lectures', lectureRoutes);
app.use('/api/classrooms', classroomRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/analytics', analyticsRoutes);

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
