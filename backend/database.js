const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, 'notemicpro.db');
const uploadsDir = path.resolve(__dirname, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Previously we deleted the DB for MVP resets. Now we keep it.
/*
if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
}
*/

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error opening database " + err.message);
    } else {
        console.log("Database connected locally (SQLite).");
        
        db.serialize(() => {
            // Enforce foreign key constraints
            db.run("PRAGMA foreign_keys = ON;");

            // --- USERS ---
            db.run(`CREATE TABLE IF NOT EXISTS User (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT CHECK(role IN ('teacher', 'student')) NOT NULL,
                profile_picture TEXT,
                institution TEXT,
                course TEXT,
                subject TEXT,
                bio TEXT,
                qualification TEXT,
                experience TEXT,
                semester TEXT,
                learning_style TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // --- CLASSROOMS ---
            db.run(`CREATE TABLE IF NOT EXISTS Classroom (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                teacher_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                join_code TEXT UNIQUE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (teacher_id) REFERENCES User(id) ON DELETE CASCADE
            )`);

            // --- ENROLLMENTS ---
            db.run(`CREATE TABLE IF NOT EXISTS ClassroomStudent (
                classroom_id INTEGER NOT NULL,
                student_id INTEGER NOT NULL,
                enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (classroom_id, student_id),
                FOREIGN KEY (classroom_id) REFERENCES Classroom(id) ON DELETE CASCADE,
                FOREIGN KEY (student_id) REFERENCES User(id) ON DELETE CASCADE
            )`);

            // --- LECTURES ---
            db.run(`CREATE TABLE IF NOT EXISTS Lecture (
                lecture_id INTEGER PRIMARY KEY AUTOINCREMENT,
                teacher_id INTEGER NOT NULL,
                classroom_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                date DATETIME DEFAULT CURRENT_TIMESTAMP,
                audio_file TEXT,
                transcript TEXT,
                status TEXT DEFAULT 'processing',
                FOREIGN KEY (teacher_id) REFERENCES User(id) ON DELETE CASCADE,
                FOREIGN KEY (classroom_id) REFERENCES Classroom(id) ON DELETE CASCADE
            )`);

            // --- SUMMARIES ---
            db.run(`CREATE TABLE IF NOT EXISTS Summary (
                summary_id INTEGER PRIMARY KEY AUTOINCREMENT,
                lecture_id INTEGER,
                level TEXT CHECK(level IN ('easy', 'medium', 'detailed')) NOT NULL,
                content TEXT NOT NULL,
                FOREIGN KEY (lecture_id) REFERENCES Lecture(lecture_id) ON DELETE CASCADE
            )`);

            // --- FLASHCARDS ---
            db.run(`CREATE TABLE IF NOT EXISTS Flashcard (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lecture_id INTEGER NOT NULL,
                front TEXT NOT NULL,
                back TEXT NOT NULL,
                FOREIGN KEY (lecture_id) REFERENCES Lecture(lecture_id) ON DELETE CASCADE
            )`);

            // --- MCQs ---
            db.run(`CREATE TABLE IF NOT EXISTS MCQ (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lecture_id INTEGER NOT NULL,
                question TEXT NOT NULL,
                option_a TEXT NOT NULL,
                option_b TEXT NOT NULL,
                option_c TEXT NOT NULL,
                option_d TEXT NOT NULL,
                correct_option TEXT CHECK(correct_option IN ('A', 'B', 'C', 'D')) NOT NULL,
                FOREIGN KEY (lecture_id) REFERENCES Lecture(lecture_id) ON DELETE CASCADE
            )`);

            // --- KEY CONCEPTS ---
            db.run(`CREATE TABLE IF NOT EXISTS KeyConcept (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lecture_id INTEGER NOT NULL,
                concept TEXT NOT NULL,
                FOREIGN KEY (lecture_id) REFERENCES Lecture(lecture_id) ON DELETE CASCADE
            )`);

            // --- SCORES ---
            db.run(`CREATE TABLE IF NOT EXISTS QuizScore (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL,
                lecture_id INTEGER NOT NULL,
                score INTEGER NOT NULL,
                taken_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, lecture_id),
                FOREIGN KEY (student_id) REFERENCES User(id) ON DELETE CASCADE,
                FOREIGN KEY (lecture_id) REFERENCES Lecture(lecture_id) ON DELETE CASCADE
            )`);

            // --- FEEDBACK ---
            db.run(`CREATE TABLE IF NOT EXISTS LectureFeedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lecture_id INTEGER NOT NULL,
                student_id INTEGER NOT NULL,
                rating INTEGER CHECK(rating BETWEEN 1 AND 5) NOT NULL,
                comment TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (lecture_id) REFERENCES Lecture(lecture_id) ON DELETE CASCADE,
                FOREIGN KEY (student_id) REFERENCES User(id) ON DELETE CASCADE
            )`);

            // --- BOOKMARKS ---
            db.run(`CREATE TABLE IF NOT EXISTS Bookmark (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                lecture_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, lecture_id),
                FOREIGN KEY (user_id) REFERENCES User(id) ON DELETE CASCADE,
                FOREIGN KEY (lecture_id) REFERENCES Lecture(lecture_id) ON DELETE CASCADE
            )`);

            // --- PROGRESS TRACKING ---
            db.run(`CREATE TABLE IF NOT EXISTS LectureProgress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                lecture_id INTEGER NOT NULL,
                status TEXT CHECK(status IN ('started', 'completed')) DEFAULT 'started',
                last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, lecture_id),
                FOREIGN KEY (user_id) REFERENCES User(id) ON DELETE CASCADE,
                FOREIGN KEY (lecture_id) REFERENCES Lecture(lecture_id) ON DELETE CASCADE
            )`);

            console.log("Database schema completely initialized with all premium features.");
        });
    }
});

module.exports = db;
