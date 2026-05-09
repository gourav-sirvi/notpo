# NoteMic Pro - Technical Documentation

NoteMic Pro is a strictly local, privacy-first, AI-powered e-learning platform designed for classrooms and interactive lecture experiences.

## 🚀 Core Features

### 1. AI-Powered Study Material
The platform utilizes a local Ollama integration to transform lecture transcripts into actionable study material without any cloud dependencies.
- **Dynamic Summaries**: Students can choose between 3 summary levels:
  - **Easy (5 Points)**: Quick overview
  - **Medium (10 Points)**: Balanced summary
  - **Detailed (20 Points)**: Deep dive into the material
- **Interactive Flashcards**: Automatically generates exactly **5 high-quality flashcards** per lecture.
- **Auto-Quizzes**: Generates **5 MCQs** with instant grading and score tracking.

### 2. Classroom Management
- **Teacher Dashboard**: Create multiple classrooms, manage lectures, and track student progress.
- **Student Dashboard**: Join classrooms via unique codes and access bookmarked or assigned lectures.
- **Gamified Experience**: Interactive progress badges (5, 10, 20 points) for completing summaries.

### 3. Audio/Lecture System
- **Real-time Recording**: Teachers can record lectures directly in the browser.
- **Transcription**: Automated transcription system to feed the AI study engine.
- **Study Mode**: A dedicated page for students to view videos, transcripts, and AI-generated aids.

## 🛠️ Technology Stack

### Frontend
- **Framework**: React.js with Vite.
- **Styling**: Vanilla CSS with a **Premium UI Design System**:
  - **Palettes**: Indigo/Purple and Cyan/Yellow gradients.
  - **Layouts**: Pill-style navigation and cards with smooth hover transitions.
  - **Responsive**: Fully optimized for various screen sizes.

### Backend
- **Server**: Node.js with Express.
- **Database**: **SQLite** (Strictly Local) — `backend/notemicpro.db`.
- **AI Integration**: **Ollama** (Running locally on `http://localhost:11434`).

### Storage
- Local file system in `backend/uploads/` for audio/video assets.

## 🏗️ Technical Architecture

### Database Schema (SQLite)
The application relies on a multi-table schema:
- `User`: Handles authentication and roles (Teacher/Student).
- `Classroom`: Stores classroom information and join codes.
- `Lecture`: Metadata for audio/transcripts.
- `Summary`, `Flashcard`, `MCQ`: Stores AI-generated study aids.
- `QuizScore`, `LectureProgress`: Tracks student achievement.

### Key Logic
- **AI Prompts**: Structured prompts ensure strict output formats (JSON) for parsing into the database.
- **Real-time Feedback**: Students can rate lectures (1-5 stars).

## 📝 Setup & Running
1.  **Start Backend**: `cd backend && npm install && node server.js`
2.  **Start Frontend**: `cd frontend && npm install && npm run dev`
3.  **Required**: Ensure **Ollama** is running locally for AI features.

---
*Created for NoteMic Pro - 2026*
