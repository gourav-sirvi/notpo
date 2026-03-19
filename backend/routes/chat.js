const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// @route   POST /api/chat/:lectureId
// @desc    Ask a question about a specific lecture transcript
router.post('/:lectureId', authenticateToken, async (req, res) => {
    const { lectureId } = req.params;
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    // 1. Fetch transcript for the lecture
    db.get('SELECT transcript, title FROM Lecture WHERE lecture_id = ?', [lectureId], async (err, lecture) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!lecture) return res.status(404).json({ error: 'Lecture not found' });

        if (!lecture.transcript) {
            return res.status(400).json({ error: 'No transcript available for this lecture' });
        }

        const prompt = `
You are an AI study assistant for the lecture titled "${lecture.title}".
Based ONLY on the following lecture transcript, answer the student's question accurately and concisely.
If the answer is not in the transcript, state that clearly.

Lecture Transcript:
"${lecture.transcript}"

Student Question:
"${message}"

Helpful Response:
`;

        try {
            const response = await fetch("http://localhost:11434/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "llama3",
                    prompt: prompt,
                    stream: false,
                    options: {
                        temperature: 0.4
                    }
                })
            });

            if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
            
            const result = await response.json();
            const aiResponse = result.response.trim();

            res.json({ answer: aiResponse });
        } catch (error) {
            console.error("Chat AI error:", error.message);
            res.status(500).json({ error: 'AI Assistant is currently unavailable' });
        }
    });
});

module.exports = router;
