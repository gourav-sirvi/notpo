import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { PlusCircle, BookOpen, BarChart2, Users } from 'lucide-react';
import Navbar from '../../components/Navbar';

const TeacherDashboard = () => {
  const [classrooms, setClassrooms] = useState([]);
  const [newClassName, setNewClassName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [totalStudents, setTotalStudents] = useState(0);

  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    fetchClassrooms();
  }, []);

  const fetchClassrooms = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/classrooms', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClassrooms(res.data);
      const total = res.data.reduce((sum, cls) => sum + (cls.student_count || 0), 0);
      setTotalStudents(total);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) {
        // Clear stale session so GuestRoute doesn't bounce back
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
      }
    }
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/classrooms/create', { name: newClassName.trim() }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewClassName('');
      fetchClassrooms();
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
      } else {
        setError(err.response?.data?.error || 'Failed to create classroom. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)', color: 'var(--text-color)' }}>
      <Navbar />

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>

        {/* Welcome Header */}
        <div style={{ marginBottom: '2rem', animation: 'fadeIn 0.6s ease-out' }}>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-color)' }}>
            <span style={{ animation: 'wave 2s infinite', display: 'inline-block' }}>👋</span>
            Welcome Back, {user?.name || 'Teacher'}!
          </h1>
          <p style={{ fontSize: '1.1rem', color: 'var(--primary-color)', fontWeight: 600, margin: 0 }}>
            Ready to manage your classrooms and lectures?
          </p>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { icon: <BookOpen size={18} color="var(--primary-color)" />, label: 'Classrooms', value: classrooms.length },
            { icon: <Users size={18} color="var(--primary-color)" />, label: 'Total Students', value: totalStudents },
            { icon: <BarChart2 size={18} color="var(--primary-color)" />, label: 'Ungraded Submissions', value: 0 },
          ].map((stat, i) => (
            <div key={i} className="card-interactive" style={{
              borderRadius: '1rem',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.4rem',
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary-color)' }}>{stat.value}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {stat.icon} {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* New Classroom Card */}
        <div className="card-interactive" style={{
          borderStyle: 'dashed',
          borderWidth: '2px',
          borderRadius: '1.25rem',
          padding: '1.75rem',
          marginBottom: '2.5rem',
        }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-color)' }}>
            <PlusCircle size={22} color="var(--primary-color)" /> New Classroom
          </h2>
          {error && (
            <p style={{ color: 'var(--danger)', marginBottom: '0.75rem', fontSize: '0.88rem', fontWeight: 600 }}>⚠️ {error}</p>
          )}
          <form onSubmit={handleCreateClass} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Class Name (e.g. Physics 101)"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              required
              style={{ flex: 1, minWidth: '200px', borderRadius: '0.75rem', border: '1.5px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-color)' }}
            />
            <button
              type="submit"
              disabled={isLoading}
              className="btn-interactive"
              style={{
                padding: '0.75rem 2rem',
                borderRadius: '0.75rem',
                fontWeight: 700,
                fontSize: '0.95rem',
                whiteSpace: 'nowrap',
              }}>
              {isLoading ? 'Creating...' : 'Create Classroom'}
            </button>
          </form>
        </div>

        {/* Classrooms Section */}
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-color)' }}>Your Classrooms</h2>

          {classrooms.length === 0 ? (
            <div className="card-interactive" style={{
              textAlign: 'center', padding: '3rem',
              borderRadius: '1.25rem', borderStyle: 'dashed', color: 'var(--text-muted)',
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🏫</div>
              <p style={{ fontWeight: 500 }}>No classrooms yet. Create your first one above!</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
              {classrooms.map((cls) => (
                <div
                  key={cls.id}
                  onClick={() => navigate(`/teacher/class/${cls.id}`)}
                  className="card-interactive"
                  style={{
                    borderRadius: '1.25rem',
                    padding: '1.5rem',
                    cursor: 'pointer',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-color)' }}>{cls.name}</h3>
                    <span style={{ fontSize: '0.72rem', background: 'var(--card-bg)', color: 'var(--primary-color)', padding: '0.2rem 0.6rem', borderRadius: '1rem', fontWeight: 700, border: '1px solid var(--border-color)' }}>
                      ACTIVE
                    </span>
                  </div>

                  <div style={{ background: 'var(--input-bg)', padding: '0.5rem 0.75rem', borderRadius: '0.6rem', border: '1px solid var(--border-color)', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-color)', marginBottom: '1rem', letterSpacing: '1px' }}>
                    🔑 {cls.join_code}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <span>Created {new Date(cls.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    <span style={{ color: 'var(--primary-color)', fontWeight: 600 }}>View →</span>
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
      `}</style>
    </div>
  );
};

export default TeacherDashboard;
