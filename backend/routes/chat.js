const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/authMiddleware');
const Groq = require('groq-sdk');

const router = express.Router();

let groqClient = null;
const initGroq = () => {
    if (!groqClient) {
        groqClient = new Groq({
            apiKey: process.env.GROQ_API_KEY || 'MISSING_API_KEY'
        });
    }
    return groqClient;
};

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
            const client = initGroq();
            const completion = await client.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: 'llama3-70b-8192',
                temperature: 0.4,
                max_tokens: 1024,
            });

            const aiResponse = completion.choices[0]?.message?.content?.trim() || "I'm sorry, I couldn't generate a response.";
            res.json({ answer: aiResponse });
        } catch (error) {
            console.error("Chat Groq AI error:", error.message);
            res.status(500).json({ error: 'AI Assistant is currently unavailable. Please check your Groq API key.' });
        }
    });
});

module.exports = router;
