import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle } from 'lucide-react';

const ProfileSetup = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));
  const token = localStorage.getItem('token');

  const [formData, setFormData] = useState({
    institution: '',
    course: '',
    // Teacher-specific
    subject: '',
    qualification: '',
    experience: '',
    bio: '',
    // Student-specific
    semester: '',
    learning_style: 'reading'
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  if (!user || !token) {
    navigate('/login');
    return null;
  }

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      await axios.put('\/api/profiles/me', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Update local user object
      const updated = { ...user, ...formData };
      localStorage.setItem('user', JSON.stringify(updated));
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => navigate('/');

  const inputStyle = { borderRadius: '0.75rem', marginTop: '0.35rem' };
  const labelStyle = { fontWeight: 600, fontSize: '0.85rem', color: 'var(--secondary-color)' };
  const fieldStyle = { marginBottom: '1.25rem' };

  const isTeacher = user.role === 'teacher';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)', color: 'var(--text-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="auth-card" style={{ maxWidth: '560px', width: '100%' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <span style={{ fontSize: '1.8rem' }}>👋</span>
          </div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.4rem' }}>
            Welcome, {user.name?.split(' ')[0]}!
          </h2>
          <p style={{ color: 'var(--secondary-color)', fontSize: '0.95rem' }}>
            Complete your profile to personalize your experience. You can also do this later from Settings.
          </p>
        </div>

        {/* Role Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 1rem', borderRadius: '2rem', background: isTeacher ? 'rgba(99,102,241,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${isTeacher ? '#6366f1' : '#10b981'}`, color: isTeacher ? '#6366f1' : '#10b981', fontWeight: 700, fontSize: '0.85rem', marginBottom: '2rem' }}>
          {isTeacher ? '🧑‍🏫 Teacher Account' : '🎓 Student Account'}
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1.5rem', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.9rem', fontWeight: 600 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Common Fields */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Institution / College</label>
          <input type="text" name="institution" className="form-control hover-lift" placeholder="e.g. IIT Delhi, Delhi University" value={formData.institution} onChange={handleChange} style={inputStyle} />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Course / Department</label>
          <input type="text" name="course" className="form-control hover-lift" placeholder="e.g. Computer Science, B.Tech CSE" value={formData.course} onChange={handleChange} style={inputStyle} />
        </div>

        {/* Teacher Fields */}
        {isTeacher && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '0.5rem 0 1.5rem' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--secondary-color)', textTransform: 'uppercase', letterSpacing: '1px' }}>Teaching Details</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Subject Expertise</label>
              <input type="text" name="subject" className="form-control hover-lift" placeholder="e.g. Data Structures, Physics, Mathematics" value={formData.subject} onChange={handleChange} style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Qualification</label>
                <input type="text" name="qualification" className="form-control hover-lift" placeholder="e.g. M.Tech, PhD" value={formData.qualification} onChange={handleChange} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Experience (Years)</label>
                <input type="number" name="experience" className="form-control hover-lift" placeholder="e.g. 5" min="0" max="60" value={formData.experience} onChange={handleChange} style={inputStyle} />
              </div>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Short Bio</label>
              <textarea name="bio" className="form-control hover-lift" placeholder="Tell students a bit about yourself... (optional)" value={formData.bio} onChange={handleChange} rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
          </>
        )}

        {/* Student Fields */}
        {!isTeacher && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '0.5rem 0 1.5rem' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--secondary-color)', textTransform: 'uppercase', letterSpacing: '1px' }}>Study Details</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Year / Semester</label>
                <input type="text" name="semester" className="form-control hover-lift" placeholder="e.g. 3rd Year, Sem 5" value={formData.semester} onChange={handleChange} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Learning Style</label>
                <select name="learning_style" className="form-control hover-lift" value={formData.learning_style} onChange={handleChange} style={inputStyle}>
                  <option value="visual">Visual (diagrams)</option>
                  <option value="reading">Reading / Writing</option>
                  <option value="audio">Audio (listening)</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
          <button onClick={handleSkip} style={{ flex: 1, padding: '0.85rem', borderRadius: '0.75rem', background: 'var(--input-bg)', color: 'var(--secondary-color)', border: '1px solid var(--border-color)', fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem' }}>
            Skip for now
          </button>
          <button onClick={handleSave} disabled={isSaving} style={{ flex: 2, padding: '0.85rem', borderRadius: '0.75rem', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: isSaving ? 0.7 : 1 }}>
            {isSaving
              ? <div style={{ width: '18px', height: '18px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              : <><CheckCircle size={18} /> Save & Continue</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileSetup;
