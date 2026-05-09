import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import API_BASE from './config'
import './index.css'
import App from './App.jsx'

axios.defaults.baseURL = API_BASE;

// Global auth error handler — if ANY request returns 401/403,
// clear the stale session and redirect to /login.
// This is the single fix for the tab-flickering redirect loop:
// previously navigate('/login') was called while localStorage still had a
// valid-looking user, so GuestRoute immediately bounced back to the dashboard.
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isAuthRoute = error.config?.url?.includes('/api/auth/');
      if (!isAuthRoute) {
        // Only clear session for non-auth routes (don't break login/register flows)
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
