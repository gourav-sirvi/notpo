import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { PlusCircle, Bookmark, PlayCircle } from 'lucide-react';
import Navbar from '../../components/Navbar';

const StudentDashboard = () => {
  const [classrooms, setClassrooms] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchClassrooms();
    fetchBookmarks();
  }, []);

  const fetchClassrooms = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/classrooms', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClassrooms(res.data);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
      }
    }
  };

  const fetchBookmarks = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/lectures/bookmarked', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBookmarks(res.data);
    } catch (err) {
      console.error('Failed to fetch bookmarks', err);
    }
  };

  const handleJoinClass = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/classrooms/join', { join_code: joinCode.toUpperCase() }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setJoinCode('');
      fetchClassrooms();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join classroom. Check the code and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)', color: 'var(--text-color)' }}>
      <Navbar />

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>

        {/* Welcome Header */}
        <div style={{ marginBottom: '2.5rem', animation: 'fadeIn 0.6s ease-out' }}>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-color)' }}>
            <span style={{ animation: 'wave 2s infinite', display: 'inline-block' }}>👋</span>
            Welcome Back, {user?.name || 'Student'}!
          </h1>
          <p style={{ fontSize: '1.05rem', color: 'var(--primary-color)', fontWeight: 500, margin: 0 }}>
            What are we learning today? Check your classrooms below.
          </p>
        </div>

        {/* Top Cards — Join + Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '3rem' }}>

          {/* Join Classroom */}
          <form onSubmit={handleJoinClass} className="card-interactive" style={{
            borderRadius: '1.25rem',
            padding: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-color)' }}>
              <PlusCircle size={20} color="var(--primary-color)" /> Join Classroom
            </h2>
            {error && (
              <p style={{ color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>⚠️ {error}</p>
            )}
            <input
              type="text"
              placeholder="Enter Class Code (e.g. AB1234)"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              required
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '0.75rem',
                border: '1.5px solid var(--border-color)',
                background: 'var(--input-bg)',
                color: 'var(--text-color)',
                fontSize: '0.95rem',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
            <button
              type="submit"
              disabled={isLoading}
              className="btn-interactive"
              style={{
                padding: '0.85rem',
                borderRadius: '0.75rem',
                fontWeight: 700,
                fontSize: '0.95rem',
              }}>
              {isLoading ? 'Joining...' : 'Join Classroom'}
            </button>
          </form>

          {/* Stats Card */}
          <div className="card-interactive" style={{
            borderRadius: '1.25rem',
            padding: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>Enrolled Classes</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--primary-color)', lineHeight: 1 }}>{classrooms.length}</div>
            </div>

            <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.5rem 0' }} />

            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>Saved Lectures</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary-color)', lineHeight: 1 }}>{bookmarks.length}</div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.25rem 0' }}>
              <span style={{ color: 'var(--success)' }}>✓</span> All assignments submitted
            </div>

            <button
              onClick={() => navigate('/student/analytics')}
              style={{
                marginTop: '0.5rem',
                padding: '0.65rem 1rem',
                background: 'var(--input-bg)',
                border: '1px solid var(--primary-color)',
                borderRadius: '0.75rem',
                color: 'var(--primary-color)',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.3s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--card-bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--input-bg)'}>
              📊 View My Analytics
            </button>
          </div>
        </div>

        {/* Bookmarks Section */}
        {bookmarks.length > 0 && (
          <div style={{ marginBottom: '3rem' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-color)' }}>
              <Bookmark color="var(--primary-color)" fill="var(--primary-color)" size={22} /> Bookmarked Lectures
            </h2>
            <div style={{ display: 'flex', gap: '1.25rem', overflowX: 'auto', paddingBottom: '1rem', scrollSnapType: 'x mandatory' }}>
              {bookmarks.map((lecture) => (
                <div
                  key={lecture.lecture_id}
                  className="card-interactive"
                  style={{
                    flex: '0 0 260px',
                    borderRadius: '1.25rem',
                    padding: '1.25rem',
                    cursor: 'pointer',
                    scrollSnapAlign: 'start',
                  }}
                  onClick={() => navigate(`/student/lecture/${lecture.lecture_id}`)}>
                  <div style={{ background: 'var(--input-bg)', height: '80px', borderRadius: '0.75rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
                    <PlayCircle size={36} color="var(--primary-color)" />
                  </div>
                  <h3 style={{ fontSize: '0.95rem', marginBottom: '0.35rem', color: 'var(--text-color)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lecture.title}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <img src={lecture.teacher_profile_picture ? (lecture.teacher_profile_picture.startsWith('http') ? lecture.teacher_profile_picture : `http://localhost:5000${lecture.teacher_profile_picture}`) : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(lecture.teacher_name)}`} alt={lecture.teacher_name} style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover' }} />
                    {lecture.teacher_name} • {new Date(lecture.date).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Classrooms */}
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-color)' }}>Your Classrooms</h2>

          {classrooms.length === 0 ? (
            <div className="card-interactive" style={{
              textAlign: 'center', padding: '3rem',
              borderRadius: '1.25rem',
              borderStyle: 'dashed',
              borderWidth: '1.5px',
              color: 'var(--text-muted)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
            }}>
              <span style={{ fontSize: '2rem' }}>🏫</span>
              <p style={{ margin: 0, fontWeight: 500 }}>You haven't joined any classrooms yet.</p>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>Enter a class code above to get started.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
              {classrooms.map((cls) => (
                <div
                  key={cls.id}
                  className="card-interactive"
                  style={{
                    borderRadius: '1.25rem',
                    padding: '1.5rem',
                    cursor: 'pointer',
                  }}
                  onClick={() => navigate(`/student/class/${cls.id}`)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-color)' }}>{cls.name}</h3>
                    <img src={cls.teacher_profile_picture ? (cls.teacher_profile_picture.startsWith('http') ? cls.teacher_profile_picture : `http://localhost:5000${cls.teacher_profile_picture}`) : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cls.teacher_name)}`} alt={cls.teacher_name} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--primary-color)' }} />
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    Instructor: {cls.teacher_name}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <span>Enrolled {new Date(cls.enrolled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    <span style={{ color: 'var(--primary-color)', fontWeight: 600 }}>Open →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes wave {
          0%   { transform: rotate(0deg); }
          10%  { transform: rotate(14deg); }
          20%  { transform: rotate(-8deg); }
          30%  { transform: rotate(14deg); }
          40%  { transform: rotate(-4deg); }
          50%  { transform: rotate(10deg); }
          60%  { transform: rotate(0deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        ::-webkit-scrollbar { height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(167,139,250,0.3); border-radius: 10px; }
        input::placeholder { color: rgba(255,255,255,0.35); }
        input:focus { border-color: rgba(167,139,250,0.6) !important; box-shadow: 0 0 0 3px rgba(167,139,250,0.2); }
      `}</style>
    </div>
  );
};

export default StudentDashboard;
