import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, Users, PlusCircle, Bookmark, PlayCircle } from 'lucide-react';
import Navbar from '../../components/Navbar';

const StudentDashboard = () => {
  const [classrooms, setClassrooms] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    fetchClassrooms();
    fetchBookmarks();
  }, []);

  const fetchClassrooms = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('\/api/classrooms', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClassrooms(res.data);
    } catch (err) {
      console.error(err);
      if(err.response?.status === 401 || err.response?.status === 403) navigate('/login');
    }
  };

  const fetchBookmarks = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('\/api/lectures/bookmarked', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBookmarks(res.data);
    } catch (err) {
      console.error('Failed to fetch bookmarks', err);
    }
  };

  const handleJoinClass = async (e) => {
    e.preventDefault();
    if (!joinCode) return;
    setIsLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      await axios.post('\/api/classrooms/join', { join_code: joinCode.toUpperCase() }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setJoinCode('');
      fetchClassrooms();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join classroom');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)', color: 'var(--text-color)' }}>
      <Navbar />

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ marginBottom: '3rem', animation: 'fadeIn 0.8s ease-out' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ animation: 'wave 2s infinite' }}>👋</span> Welcome Back, {user?.name || 'Student'}!
          </h1>
          <p style={{ fontSize: '1.2rem', color: 'var(--secondary-color)', fontWeight: 500 }}>
            What are we learning today? Check your classrooms below.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
          {/* Join Classroom Card */}
          <form className="auth-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', border: '2px dashed var(--border-color)', background: 'transparent' }} onSubmit={handleJoinClass}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.5rem' }}>
               <PlusCircle color="var(--primary-color)" /> Join Classroom
            </h2>
            {error && <p style={{ color: '#ef4444', marginBottom: '0.5rem' }}>{error}</p>}
            <input 
              type="text" 
              className="form-control" 
              placeholder="Enter Class Code (e.g. AB1234)" 
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              style={{ borderRadius: '0.75rem' }}
              required
            />
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isLoading}
              style={{ borderRadius: '0.75rem', padding: '0.85rem', fontWeight: 600, opacity: isLoading ? 0.7 : 1 }}
            >
              Join Classroom
            </button>
          </form>

        {/* Quick Stats / Bookmarks Summary */}
          <div className="auth-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'linear-gradient(135deg, var(--primary-color), #4338ca)', color: 'white', border: 'none' }}>
             <h3 style={{ margin: 0, opacity: 0.9, fontSize: '1rem' }}>Enrolled Classes</h3>
             <p style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0.5rem 0' }}>{classrooms.length}</p>
             <div style={{ height: '1px', background: 'rgba(255,255,255,0.2)', margin: '1rem 0' }}></div>
             <h3 style={{ margin: 0, opacity: 0.9, fontSize: '1rem' }}>Saved Lectures</h3>
             <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.5rem 0' }}>{bookmarks.length}</p>
             <button
               onClick={() => navigate('/student/analytics')}
               style={{ marginTop: '1rem', padding: '0.6rem 1rem', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '0.75rem', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem', backdropFilter: 'blur(10px)' }}
             >
               📊 View My Analytics
             </button>
          </div>
        </div>

        {/* BOOKMARKS SECTION */}
        {bookmarks.length > 0 && (
          <div style={{ marginBottom: '3rem' }}>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bookmark color="var(--primary-color)" fill="var(--primary-color)" size={24} /> Bookmarked Lectures
            </h2>
            <div style={{ display: 'flex', gap: '1.5rem', overflowX: 'auto', paddingBottom: '1rem', scrollSnapType: 'x mandatory' }}>
              {bookmarks.map((lecture) => (
                <div 
                  key={lecture.lecture_id} 
                  className="auth-card"
                  style={{ 
                    flex: '0 0 300px', padding: '1.5rem', cursor: 'pointer',
                    scrollSnapAlign: 'start', transition: 'transform 0.2s',
                  }}
                  onClick={() => navigate(`/student/lecture/${lecture.lecture_id}`)}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div style={{ background: 'var(--input-bg)', height: '100px', borderRadius: '0.75rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PlayCircle size={40} color="var(--primary-color)" opacity={0.6} />
                  </div>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lecture.title}</h3>
                  <div style={{ fontSize: '0.85rem', color: 'var(--secondary-color)' }}>
                    {lecture.teacher_name} • {new Date(lecture.date).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Your Classrooms</h2>
        
        {classrooms.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--card-bg)', borderRadius: '1rem', border: '1px dashed var(--border-color)', color: 'var(--secondary-color)' }}>
            <p>You haven't joined any classrooms yet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {classrooms.map((cls) => (
              <div 
                key={cls.id} 
                className="auth-card"
                style={{ 
                  maxWidth: '100%', padding: '1.5rem', cursor: 'pointer',
                  transition: 'transform 0.2s',
                }}
                onClick={() => navigate(`/student/class/${cls.id}`)}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.25rem', margin: 0 }}>{cls.name}</h3>
                </div>
                
                <div style={{ fontSize: '0.9rem', color: 'var(--secondary-color)' }}>
                  Instructor: {cls.teacher_name}
                </div>
                
                <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--secondary-color)' }}>
                  Enrolled: {new Date(cls.enrolled_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        ::-webkit-scrollbar { height: 6px; }
        ::-webkit-scrollbar-track { background: var(--bg-color); }
        ::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--secondary-color); }
      `}</style>
    </div>
  );
};

export default StudentDashboard;
