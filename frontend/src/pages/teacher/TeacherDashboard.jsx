import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { PlusCircle } from 'lucide-react';
import Navbar from '../../components/Navbar';

const TeacherDashboard = () => {
  const [classrooms, setClassrooms] = useState([]);
  const [newClassName, setNewClassName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    fetchClassrooms();
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

  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (!newClassName) return;
    setIsLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      await axios.post('\/api/classrooms/create', { name: newClassName }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewClassName('');
      fetchClassrooms();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create classroom');
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
            <span style={{ animation: 'wave 2s infinite' }}>👋</span> Welcome Back, {user?.name || 'Teacher'}!
          </h1>
          <p style={{ fontSize: '1.2rem', color: 'var(--secondary-color)', fontWeight: 500 }}>
            Ready to manage your AI-powered classrooms and lectures?
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
          {/* Create New Classroom Card */}
          <form className="auth-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', border: '2px dashed var(--border-color)', background: 'transparent' }} onSubmit={handleCreateClass}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.5rem' }}>
               <PlusCircle color="var(--primary-color)" /> New Classroom
            </h2>
            {error && <p style={{ color: '#ef4444', marginBottom: '0.5rem' }}>{error}</p>}
            <input 
              type="text" 
              className="form-control" 
              placeholder="Class Name (e.g. Physics 101)" 
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              style={{ borderRadius: '0.75rem' }}
              required
            />
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isLoading}
              style={{ borderRadius: '0.75rem', padding: '0.85rem', fontWeight: 600, opacity: isLoading ? 0.7 : 1 }}
            >
              {isLoading ? 'Creating...' : 'Create Classroom'}
            </button>
          </form>
        </div>


        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Your Classrooms</h2>
        
        {classrooms.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--card-bg)', borderRadius: '1rem', border: '1px dashed var(--border-color)', color: 'var(--secondary-color)' }}>
            <p>You haven't created any classrooms yet.</p>
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
                onClick={() => navigate(`/teacher/class/${cls.id}`)}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.25rem', margin: 0 }}>{cls.name}</h3>
                </div>
                
                <div style={{ background: 'var(--bg-color)', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', display: 'inline-block', fontSize: '0.85rem', fontWeight: 600 }}>
                  Class Code: <span style={{ color: 'var(--primary-color)', letterSpacing: '1px' }}>{cls.join_code}</span>
                </div>
                
                <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--secondary-color)' }}>
                  Created: {new Date(cls.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherDashboard;
