import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import { User, Mail, Lock, Save, ArrowLeft, Camera, BookOpen, Award, Briefcase, GraduationCap, Building2 } from 'lucide-react';

const Profile = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '', email: '', password: '',
    institution: '', course: '', subject: '', bio: '',
    qualification: '', experience: '', semester: '', learning_style: 'reading'
  });
  const [role, setRole] = useState('');
  const [profilePicture, setProfilePicture] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/profiles/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = res.data;
      setFormData({
        name: d.name || '',
        email: d.email || '',
        password: '',
        institution: d.institution || '',
        course: d.course || '',
        subject: d.subject || '',
        bio: d.bio || '',
        qualification: d.qualification || '',
        experience: d.experience || '',
        semester: d.semester || '',
        learning_style: d.learning_style || 'reading'
      });
      setRole(d.role);
      setProfilePicture(d.profile_picture || '');
      
      const user = JSON.parse(localStorage.getItem('user')) || {};
      localStorage.setItem('user', JSON.stringify({ ...user, profile_picture: d.profile_picture || '' }));
    } catch (err) {
      console.error(err);
      if(err.response?.status === 401) navigate('/login');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    setError('');

    try {
      const token = localStorage.getItem('token');
      const res = await axios.put('/api/profiles/me', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage(res.data.message);
      
      const user = JSON.parse(localStorage.getItem('user')) || {};
      user.name = formData.name;
      user.email = formData.email;
      localStorage.setItem('user', JSON.stringify(user));
      
      setFormData({ ...formData, password: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const data = new FormData();
    data.append('photo', file);

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/api/profiles/upload-photo', data, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      setProfilePicture(res.data.profile_picture);
      setMessage('Profile photo updated successfully');
      
      const user = JSON.parse(localStorage.getItem('user')) || {};
      user.profile_picture = res.data.profile_picture;
      localStorage.setItem('user', JSON.stringify(user));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload photo');
    }
  };

  const fieldStyle = {
    wrapper: { marginBottom: '1.25rem' },
    label: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem', color: 'var(--secondary-color)' },
    input: { borderRadius: '0.75rem', width: '100%' }
  };

  // eslint-disable-next-line no-unused-vars
  const SectionTitle = ({ icon: Icon, title }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.5rem 0 1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
      <Icon size={18} color="var(--primary-color)" />
      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</span>
    </div>
  );

  const dashboardPath = role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)', color: 'var(--text-color)' }}>
      <Navbar />

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem' }}>
        <button 
          onClick={() => navigate(dashboardPath)}
          style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, marginBottom: '2rem' }}
        >
          <ArrowLeft size={18} /> Back to Dashboard
        </button>

        <div className="auth-card" style={{ maxWidth: '100%', padding: '3rem', position: 'relative' }}>
          {/* Role Badge */}
          <div style={{ position: 'absolute', top: '2rem', right: '2rem', padding: '0.5rem 1rem', background: 'var(--primary-color)', color: 'white', borderRadius: '2rem', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>
            {role}
          </div>

          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <User size={32} /> Your Profile
          </h1>

          {/* Profile Photo */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
            <div 
              style={{
                width: '120px', height: '120px', borderRadius: '50%', background: 'var(--input-bg)',
                border: '3px solid var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', cursor: 'pointer', position: 'relative', marginBottom: '1rem'
              }}
              onClick={() => fileInputRef.current?.click()}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.8';
                const overlay = e.currentTarget.querySelector('.overlay');
                if (overlay) overlay.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
                const overlay = e.currentTarget.querySelector('.overlay');
                if (overlay) overlay.style.opacity = '0';
              }}
            >
              {profilePicture ? (
                <img 
                  src={profilePicture.startsWith('http') ? profilePicture : `http://localhost:5000\${profilePicture}`} 
                  alt="Avatar" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              ) : (
                <User size={48} color="var(--secondary-color)" />
              )}
              <div className="overlay" style={{
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                opacity: 0, transition: 'opacity 0.2s', color: 'white'
              }}>
                <Camera size={24} />
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--secondary-color)', margin: 0 }}>Click to change photo</p>
            <input 
              type="file" 
              accept="image/*" 
              style={{ display: 'none' }} 
              ref={fileInputRef}
              onChange={handlePhotoUpload}
            />
          </div>

          {message && <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '0.5rem', marginBottom: '1.5rem', border: '1px solid currentColor' }}>{message}</div>}
          {error && <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '0.5rem', marginBottom: '1.5rem', border: '1px solid currentColor' }}>{error}</div>}

          <form onSubmit={handleUpdate}>

            {/* --- Account Section --- */}
            <SectionTitle icon={User} title="Account Info" />

            <div style={fieldStyle.wrapper}>
              <label style={fieldStyle.label}><User size={15} /> Full Name *</label>
              <input type="text" className="form-control" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} style={fieldStyle.input} />
            </div>

            <div style={fieldStyle.wrapper}>
              <label style={fieldStyle.label}><Mail size={15} /> Email Address *</label>
              <input type="email" className="form-control" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} style={fieldStyle.input} />
            </div>

            <div style={fieldStyle.wrapper}>
              <label style={fieldStyle.label}><Lock size={15} /> New Password <span style={{ fontWeight: 400, fontSize: '0.8rem' }}>(Optional)</span></label>
              <input type="password" className="form-control" placeholder="Leave blank to keep unchanged" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} style={fieldStyle.input} />
            </div>

            {/* --- Academic Section --- */}
            <SectionTitle icon={Building2} title="Academic Info" />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={fieldStyle.wrapper}>
                <label style={fieldStyle.label}><Building2 size={15} /> Institution</label>
                <input type="text" className="form-control" placeholder="e.g. IIT Delhi" value={formData.institution} onChange={(e) => setFormData({...formData, institution: e.target.value})} style={fieldStyle.input} />
              </div>
              <div style={fieldStyle.wrapper}>
                <label style={fieldStyle.label}><BookOpen size={15} /> Course / Department</label>
                <input type="text" className="form-control" placeholder="e.g. Computer Science" value={formData.course} onChange={(e) => setFormData({...formData, course: e.target.value})} style={fieldStyle.input} />
              </div>
            </div>

            {/* Teacher-specific */}
            {role === 'teacher' && (
              <>
                <SectionTitle icon={Briefcase} title="Professional Details" />
                <div style={fieldStyle.wrapper}>
                  <label style={fieldStyle.label}><BookOpen size={15} /> Subject Expertise</label>
                  <input type="text" className="form-control" placeholder="e.g. Physics, Data Structures" value={formData.subject} onChange={(e) => setFormData({...formData, subject: e.target.value})} style={fieldStyle.input} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={fieldStyle.wrapper}>
                    <label style={fieldStyle.label}><Award size={15} /> Qualification</label>
                    <input type="text" className="form-control" placeholder="e.g. PhD, M.Tech" value={formData.qualification} onChange={(e) => setFormData({...formData, qualification: e.target.value})} style={fieldStyle.input} />
                  </div>
                  <div style={fieldStyle.wrapper}>
                    <label style={fieldStyle.label}><Briefcase size={15} /> Experience (Yrs)</label>
                    <input type="number" className="form-control" placeholder="e.g. 5" min="0" value={formData.experience} onChange={(e) => setFormData({...formData, experience: e.target.value})} style={fieldStyle.input} />
                  </div>
                </div>
                <div style={fieldStyle.wrapper}>
                  <label style={fieldStyle.label}><User size={15} /> Short Bio</label>
                  <textarea className="form-control" placeholder="Tell students about yourself..." value={formData.bio} onChange={(e) => setFormData({...formData, bio: e.target.value})} rows={3} style={{ ...fieldStyle.input, resize: 'vertical', fontFamily: 'inherit' }} />
                </div>
              </>
            )}

            {/* Student-specific */}
            {role === 'student' && (
              <>
                <SectionTitle icon={GraduationCap} title="Student Details" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={fieldStyle.wrapper}>
                    <label style={fieldStyle.label}><GraduationCap size={15} /> Year / Semester</label>
                    <input type="text" className="form-control" placeholder="e.g. 3rd Year, Sem 5" value={formData.semester} onChange={(e) => setFormData({...formData, semester: e.target.value})} style={fieldStyle.input} />
                  </div>
                  <div style={fieldStyle.wrapper}>
                    <label style={fieldStyle.label}><BookOpen size={15} /> Learning Style</label>
                    <select className="form-control" value={formData.learning_style} onChange={(e) => setFormData({...formData, learning_style: e.target.value})} style={fieldStyle.input}>
                      <option value="visual">Visual</option>
                      <option value="reading">Reading / Writing</option>
                      <option value="audio">Audio</option>
                      <option value="mixed">Mixed</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            <button 
              type="submit" 
              disabled={isLoading}
              className="btn-interactive"
              style={{
                marginTop: '1.5rem', padding: '1rem', borderRadius: '0.75rem', width: '100%',
                fontSize: '1.1rem', fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                opacity: isLoading ? 0.7 : 1
              }}
            >
              <Save size={20} /> {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;
