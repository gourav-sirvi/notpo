// Centralized API base URL
// Reads from VITE_API_URL env variable
// - In dev: http://localhost:5000 (from .env)
// - In production: set in .env.production
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default API_BASE;
