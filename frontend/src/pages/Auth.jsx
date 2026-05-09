import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mic } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';
import axios from 'axios';

const Auth = ({ initialMode = 'login' }) => {
  const [mode, setMode] = useState(initialMode); // 'login' | 'signup' | 'forgot-password'
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student',
  });

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleRoleToggle = (r) => setFormData({ ...formData, role: r });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if ((mode === 'signup' || mode === 'forgot-password') && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      if (mode === 'login') {
        const res = await axios.post('/api/auth/login', formData);
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        const u = res.data.user;
        if (!u.institution && !u.subject && !u.semester) {
          navigate('/profile/setup');
        } else {
          navigate('/');
        }
      } else if (mode === 'forgot-password') {
        const res = await axios.post('/api/auth/reset-password', {
          email: formData.email,
          newPassword: formData.password
        });
        setMode('login');
        alert(res.data.message || 'Password reset successfully!');
        setFormData({ ...formData, password: '', confirmPassword: '' });
      } else {
        await axios.post('/api/auth/register', {
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role
        });
        const res = await axios.post('/api/auth/login', {
          email: formData.email,
          password: formData.password,
          role: formData.role
        });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        navigate('/profile/setup');
      }
    } catch (err) {
      setError(err.response?.data?.error || `${mode === 'login' ? 'Login' : mode === 'forgot-password' ? 'Password Reset' : 'Registration'} failed`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      setError('');
      setIsLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const res = await axios.post('/api/auth/google', {
        email: user.email,
        name: user.displayName,
        role: formData.role,
        firebaseUid: user.uid,
        photoUrl: user.photoURL
      });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      const u = res.data.user;
      if (!u.institution && !u.subject && !u.semester) {
        navigate('/profile/setup');
      } else {
        navigate('/');
      }
    } catch (error) {
      if (error.code === 'auth/popup-blocked') {
        setError('Popup was blocked. Please allow popups for this site.');
      } else if (error.code === 'auth/cancelled-popup-request') {
        setError('');
      } else {
        setError(error.response?.data?.error || 'Google Authentication failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Role is tracked via formData.role

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      background: 'var(--bg-color)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Blurred background circles */}
      <div style={{ position: 'absolute', top: '-80px', left: '-80px', width: '300px', height: '300px', borderRadius: '50%', background: 'var(--primary-color)', opacity: 0.1, filter: 'blur(40px)' }} />
      <div style={{ position: 'absolute', bottom: '-100px', right: '-60px', width: '350px', height: '350px', borderRadius: '50%', background: 'var(--secondary-color)', opacity: 0.1, filter: 'blur(50px)' }} />

      <div className="card-interactive" style={{
        borderRadius: '2rem',
        padding: '2.5rem',
        width: '100%',
        maxWidth: '440px',
        animation: 'cardIn 0.5s cubic-bezier(0.16,1,0.3,1)',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <div style={{ background: 'var(--primary-color)', borderRadius: '8px', padding: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px var(--btn-shadow)' }}>
            <Mic size={24} color="#fff" />
          </div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-color)' }}>NoteMic Pro</h1>
        </div>

        {/* Login / Signup Toggle — pill style */}
        <div style={{ display: 'flex', background: 'var(--input-bg)', borderRadius: '2rem', padding: '0.35rem', marginBottom: '1.75rem', border: '1px solid var(--border-color)' }}>
          {['login', 'signup'].map(t => (
            <button key={t} type="button" onClick={() => { setMode(t); setError(''); }}
              style={{
                flex: 1, padding: '0.7rem 1rem', borderRadius: '1.75rem', border: 'none',
                fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px',
                background: mode === t ? 'var(--primary-color)' : 'transparent',
                color: mode === t ? '#fff' : 'var(--text-muted)',
                boxShadow: mode === t ? '0 4px 12px var(--btn-shadow)' : 'none',
                transition: 'all 0.3s ease',
              }}>
              {t === 'login' ? 'Existing User' : 'New User'}
            </button>
          ))}
        </div>

        {/* Heading */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.7rem', fontWeight: 800, color: 'var(--text-color)' }}>
            {mode === 'login' ? 'Welcome Back!' : mode === 'forgot-password' ? 'Reset Password' : 'Start Your Journey'}
          </h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.9rem' }}>
            {mode === 'login' ? 'Login with your credentials to continue.'
              : mode === 'forgot-password' ? 'Enter your email and new password.'
              : 'Create an account to get started.'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626', padding: '0.85rem 1rem', borderRadius: '0.75rem', marginBottom: '1.25rem', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.88rem', fontWeight: 600 }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Role Toggle — unified style */}
          {mode !== 'forgot-password' && (
            <div style={{ display: 'flex', background: 'var(--input-bg)', padding: '0.3rem', borderRadius: '0.75rem', marginBottom: '1.25rem', border: '1px solid var(--border-color)', gap: '0.25rem' }}>
              {['student', 'teacher'].map(r => (
                <button key={r} type="button" onClick={() => handleRoleToggle(r)}
                  style={{
                    flex: 1, padding: '0.55rem', borderRadius: '0.5rem', border: 'none',
                    fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                    background: formData.role === r ? 'var(--secondary-color)' : 'transparent',
                    color: formData.role === r ? '#fff' : 'var(--text-muted)',
                    boxShadow: formData.role === r ? '0 2px 6px var(--btn-shadow)' : 'none',
                    transition: 'all 0.25s ease',
                  }}>
                  {r === 'student' ? 'Student Account' : 'Teacher Account'}
                </button>
              ))}
            </div>
          )}

          {/* Full Name */}
          {mode === 'signup' && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Full Name *</label>
              <input type="text" name="name" className="form-control" placeholder="Your full name"
                value={formData.name} onChange={handleChange} required
                style={{ borderRadius: '0.75rem', background: 'var(--input-bg)', border: '1.5px solid var(--border-color)', color: 'var(--text-color)' }} />
            </div>
          )}

          {/* Email */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email Address *</label>
            <input type="email" name="email" className="form-control" placeholder="you@example.com"
              value={formData.email} onChange={handleChange} required
              style={{ borderRadius: '0.75rem', background: 'var(--input-bg)', border: '1.5px solid var(--border-color)', color: 'var(--text-color)' }} />
          </div>

          {/* Password */}
          <div style={{ marginBottom: '0.5rem', position: 'relative' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {mode === 'forgot-password' ? 'New Password *' : 'Password *'}
            </label>
            <input type={showPassword ? 'text' : 'password'} name="password" className="form-control"
              placeholder="••••••••" value={formData.password} onChange={handleChange} required
              style={{ borderRadius: '0.75rem', paddingRight: '2.5rem', background: 'var(--input-bg)', border: '1.5px solid var(--border-color)', color: 'var(--text-color)' }} />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: '1rem', top: '64%', transform: 'translateY(-10%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>

          {/* Forgot Password */}
          {mode === 'login' && (
            <div style={{ textAlign: 'right', marginBottom: '1.25rem' }}>
              <a href="#" onClick={(e) => { e.preventDefault(); setMode('forgot-password'); }}
                style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--primary-color)', textDecoration: 'none' }}>
                Forgot password?
              </a>
            </div>
          )}

          {/* Confirm Password */}
          {(mode === 'signup' || mode === 'forgot-password') && (
            <div style={{ marginBottom: '1.25rem', position: 'relative' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Confirm Password *</label>
              <input type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword" className="form-control"
                placeholder="Repeat password" value={formData.confirmPassword} onChange={handleChange} required
                style={{ borderRadius: '0.75rem', paddingRight: '2.5rem', background: 'var(--input-bg)', border: '1.5px solid var(--border-color)', color: 'var(--text-color)' }} />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{ position: 'absolute', right: '1rem', top: '62%', transform: 'translateY(-10%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={isLoading} className="btn-interactive"
            style={{
              width: '100%', padding: '0.95rem', marginTop: '0.75rem', borderRadius: '0.75rem',
              fontSize: '1rem', fontWeight: 700, opacity: isLoading ? 0.75 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            }}>
            {isLoading
              ? <div style={{ width: '20px', height: '20px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              : mode === 'login' ? 'Sign In to Dashboard' : mode === 'forgot-password' ? 'Reset Password' : 'Create Account'}
          </button>
        </form>

        {/* Google */}
        {mode !== 'forgot-password' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0', gap: '0.75rem' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', whiteSpace: 'nowrap' }}>or continue with</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
            </div>

            <button onClick={handleGoogleAuth} type="button" disabled={isLoading} className="card-interactive"
              style={{
                width: '100%', padding: '0.9rem', borderRadius: '0.75rem',
                color: 'var(--text-color)',
                fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
              }}>
              <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </button>

            {mode === 'login' && (
              <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.78rem', color: '#94a3b8' }}>
                ⚠️ Make sure popups are <strong>allowed</strong> for this site for Google sign-in to work.
              </p>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Auth;
