import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
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
        const res = await axios.post('\/api/auth/login', formData);
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        // If profile is incomplete, send to setup
        const u = res.data.user;
        if (!u.institution && !u.subject && !u.semester) {
          navigate('/profile/setup');
        } else {
          navigate('/');
        }
      } else if (mode === 'forgot-password') {
        const res = await axios.post('\/api/auth/reset-password', {
          email: formData.email,
          newPassword: formData.password
        });
        setMode('login');
        alert(res.data.message || 'Password reset successfully!');
        setFormData({ ...formData, password: '', confirmPassword: '' });
      } else {
        // Signup: only basic info
        await axios.post('\/api/auth/register', {
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role
        });
        // Auto-login after signup
        const res = await axios.post('\/api/auth/login', {
          email: formData.email,
          password: formData.password,
          role: formData.role
        });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        // New users always go to profile setup
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

      const res = await axios.post('\/api/auth/google', {
        email: user.email,
        name: user.displayName,
        role: formData.role,
        firebaseUid: user.uid,
        photoUrl: user.photoURL
      });

      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));

      // New Google user (no institution set) → profile setup
      const u = res.data.user;
      if (!u.institution && !u.subject && !u.semester) {
        navigate('/profile/setup');
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error(error);
      if (error.code === 'auth/popup-blocked') {
        setError('Popup was blocked by your browser. Please allow popups for this site and try again.');
      } else if (error.code === 'auth/cancelled-popup-request') {
        setError('');
      } else {
        setError(error.response?.data?.error || 'Google Authentication failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle = { borderRadius: '0.75rem' };
  const labelStyle = { display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--secondary-color)' };
  const sectionStyle = { marginBottom: '1rem' };

  return (
    <div className="auth-container">
      {/* Brand Logo */}
      <div style={{ position: 'absolute', top: '2rem', left: '2rem', zIndex: 10, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <img src="/logo.png" alt="NoteMic Pro Logo" style={{ height: '40px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
        <h1 style={{ color: 'var(--primary-color)', fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>NoteMic Pro</h1>
      </div>

      <div className="auth-card">
        {/* Login / Signup Toggle */}
        <div style={{ display: 'flex', background: 'var(--input-bg)', borderRadius: '2rem', padding: '0.4rem', marginBottom: '2rem', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.05)', border: '1px solid var(--border-color)' }}>
          {['login', 'signup'].map(t => (
            <button key={t} type="button" onClick={() => { setMode(t); setError(''); }}
              style={{ flex: 1, padding: '0.85rem 1.5rem', borderRadius: '1.75rem', border: 'none', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px', background: mode === t ? 'var(--primary-color)' : 'transparent', color: mode === t ? '#fff' : 'var(--secondary-color)', boxShadow: mode === t ? '0 8px 15px rgba(99,102,241,0.3)' : 'none', transition: 'all 0.4s cubic-bezier(0.175,0.885,0.32,1.275)' }}>
              {t === 'login' ? 'Existing User' : 'New User'}
            </button>
          ))}
        </div>

        <div style={{ animation: 'fadeIn 0.5s ease-in' }}>
          <h2 style={{ textAlign: 'left', marginBottom: '0.4rem', fontSize: '1.8rem', fontWeight: 800 }}>
            {mode === 'login' ? 'Welcome Back!' : mode === 'forgot-password' ? 'Reset Password' : 'Start Your Journey'}
          </h2>
          <p style={{ color: 'var(--secondary-color)', marginBottom: '2rem', fontSize: '0.95rem' }}>
            {mode === 'login' ? 'Login with your credentials to continue.' :
             mode === 'forgot-password' ? 'Enter your registered email and new password.' :
             'Create an account — you can fill in your profile after signing up.'}
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1.5rem', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.9rem', fontWeight: 600 }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Role Pills */}
          {mode !== 'forgot-password' && (
            <div style={{ display: 'flex', background: 'var(--bg-color)', padding: '0.35rem', borderRadius: '0.75rem', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
              {['student', 'teacher'].map(r => (
                <button key={r} type="button" onClick={() => handleRoleToggle(r)}
                  style={{ flex: 1, padding: '0.6rem', borderRadius: '0.5rem', border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', textTransform: 'capitalize', background: formData.role === r ? 'var(--card-bg)' : 'transparent', color: formData.role === r ? 'var(--primary-color)' : 'var(--secondary-color)', boxShadow: formData.role === r ? '0 2px 8px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.3s ease' }}>
                  {r} Account
                </button>
              ))}
            </div>
          )}

          {/* Full Name (signup only) */}
          {mode === 'signup' && (
            <div style={sectionStyle}>
              <label style={labelStyle}>Full Name *</label>
              <input type="text" name="name" className="form-control hover-lift" placeholder="Your full name" value={formData.name} onChange={handleChange} required style={inputStyle} />
            </div>
          )}

          {/* Email */}
          <div style={sectionStyle}>
            <label style={labelStyle}>Email Address *</label>
            <input type="email" name="email" className="form-control hover-lift" placeholder="you@example.com" value={formData.email} onChange={handleChange} required style={inputStyle} />
          </div>

          {/* Password */}
          <div style={{ ...sectionStyle, position: 'relative' }}>
            <label style={labelStyle}>{mode === 'forgot-password' ? 'New Password *' : 'Password *'}</label>
            <input type={showPassword ? 'text' : 'password'} name="password" className="form-control hover-lift" placeholder="••••••••" value={formData.password} onChange={handleChange} required style={{ ...inputStyle, paddingRight: '2.5rem' }} />
            <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '1rem', top: '62%', transform: 'translateY(-10%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--secondary-color)' }}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Forgot Password link */}
          {mode === 'login' && (
            <div style={{ textAlign: 'right', marginBottom: '1.5rem' }}>
              <a href="#" onClick={(e) => { e.preventDefault(); setMode('forgot-password'); }} style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--primary-color)' }}>Forgot password?</a>
            </div>
          )}

          {/* Confirm Password (signup / forgot) */}
          {(mode === 'signup' || mode === 'forgot-password') && (
            <div style={{ ...sectionStyle, marginBottom: '1.5rem', position: 'relative' }}>
              <label style={labelStyle}>Confirm Password *</label>
              <input type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword" className="form-control hover-lift" placeholder="Repeat password" value={formData.confirmPassword} onChange={handleChange} required style={{ ...inputStyle, paddingRight: '2.5rem' }} />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={{ position: 'absolute', right: '1rem', top: '62%', transform: 'translateY(-10%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--secondary-color)' }}>
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          )}

          <button type="submit" disabled={isLoading}
            style={{ width: '100%', padding: '1rem', borderRadius: '0.75rem', background: mode === 'login' ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : 'linear-gradient(135deg,#10b981,#059669)', color: 'white', border: 'none', fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer', boxShadow: mode === 'login' ? '0 10px 20px -5px rgba(99,102,241,0.4)' : '0 10px 20px -5px rgba(16,185,129,0.4)', transition: 'all 0.3s', opacity: isLoading ? 0.7 : 1, marginTop: '1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            onMouseEnter={e => { if (!isLoading) e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}>
            {isLoading
              ? <div style={{ width: '20px', height: '20px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              : mode === 'login' ? 'Sign In to Dashboard' : mode === 'forgot-password' ? 'Reset Password' : 'Create Account'}
          </button>
        </form>

        {/* Google Button */}
        {mode !== 'forgot-password' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0', gap: '1rem' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
              <span style={{ fontSize: '0.8rem', color: 'var(--secondary-color)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>or continue with</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
            </div>

            <button onClick={handleGoogleAuth} type="button" disabled={isLoading}
              style={{ width: '100%', padding: '1rem', borderRadius: '0.75rem', background: 'var(--card-bg)', color: 'var(--text-color)', border: '1px solid var(--border-color)', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', transition: 'all 0.3s ease' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-color)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--card-bg)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
              <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </button>

            {mode === 'login' && (
              <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem', color: 'var(--secondary-color)' }}>
                ⚠️ Make sure popups are <strong>allowed</strong> for this site for Google sign-in to work.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Auth;
