const fs = require('fs');
const path = require('path');
const Groq = require('groq-sdk');

// Global transcriber config
let groqClient = null;

async function initTranscriber() {
    if (!groqClient) {
        if (!process.env.GROQ_API_KEY) {
            console.error('[STT] WARNING: GROQ_API_KEY is missing in your .env file!');
            console.error('[STT] Please go to https://console.groq.com to get a free key and add it to backend/.env');
        } else {
            console.log('[STT] Initializing Groq API client...');
        }
        
        // Initialize Groq client (it automatically picks up GROQ_API_KEY from env if present)
        groqClient = new Groq({
            apiKey: process.env.GROQ_API_KEY || 'MISSING_API_KEY'
        });
        console.log('[STT] Groq client ready.');
    }
    return groqClient;
}

async function transcribeOffline(audioFilePath) {
    try {
        const client = await initTranscriber();
        
        if (!process.env.GROQ_API_KEY) {
            throw new Error('GROQ_API_KEY is not set. Please add it to your .env file. You can get one for free at console.groq.com');
        }

        console.log(`[STT] Sending audio to Groq Whisper Large V3: ${audioFilePath}`);
        
        // Groq natively supports .webm, .wav, .mp3, etc. We just send the stream.
        const audioStream = fs.createReadStream(audioFilePath);
        
        const transcription = await client.audio.transcriptions.create({
            file: audioStream,
            model: 'whisper-large-v3-turbo', // The fastest and near perfect model on Groq
            prompt: 'Please transcribe the following lecture clearly.', // Optional prompt to guide STT
            response_format: 'json',
            language: 'en', // Force English, remove this if you want multiple languages
            temperature: 0.0
        });
        
        console.log('[STT] Transcription complete!');
        console.log('[STT] Text snippet:', transcription.text.substring(0, 50), '...');
        
        return transcription.text;
    } catch (err) {
        console.error('[STT Error]', err.message || err);
        throw err;
    }
}

module.exports = {
    transcribeOffline,
    initTranscriber
};
