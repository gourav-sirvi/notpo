import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BookOpen, ArrowLeft } from 'lucide-react';
import Navbar from '../../components/Navbar';

const StudentClassDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lectures, setLectures] = useState([]);
  
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    fetchLectures();
  }, [id, navigate]);

  const fetchLectures = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`\/api/lectures?classroom_id=${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLectures(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)', color: 'var(--text-color)' }}>
      <Navbar />

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
        <button 
          onClick={() => navigate('/student/dashboard')}
          style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, marginBottom: '2rem' }}
        >
          <ArrowLeft size={18} /> Back to Dashboard
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="auth-card" style={{ maxWidth: '100%', padding: '2rem' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '1.5rem' }}>
                <BookOpen size={24} /> Classroom Lectures
              </h2>
              
              {lectures.length === 0 ? (
                <p style={{ color: 'var(--secondary-color)', textAlign: 'center', padding: '2rem 0' }}>No lectures uploaded yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {lectures.map(lec => (
                    <div 
                      key={lec.lecture_id} 
                      onClick={() => navigate(`/student/lecture/${lec.lecture_id}`)}
                      style={{ padding: '1.5rem', background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '1rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s ease' }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary-color)'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                          <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--primary-color)' }}>{lec.title}</h4>
                          {lec.status === 'processing' && (
                            <span style={{ fontSize: '0.7rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary-color)', padding: '0.2rem 0.6rem', borderRadius: '1rem', border: '1px solid var(--primary-color)', fontWeight: 700 }}>
                              PROCESSING
                            </span>
                          )}
                          {lec.status === 'failed' && (
                            <span style={{ fontSize: '0.7rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.2rem 0.6rem', borderRadius: '1rem', border: '1px solid #ef4444', fontWeight: 700 }}>
                              FAILED
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--secondary-color)' }}>{new Date(lec.date).toLocaleDateString()} • {lec.teacher_name}</div>
                      </div>
                      <div style={{ background: 'var(--card-bg)', padding: '0.5rem 1rem', borderRadius: '2rem', fontSize: '0.85rem', fontWeight: 600, border: '1px solid var(--border-color)' }}>
                        Study Now
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default StudentClassDetail;
