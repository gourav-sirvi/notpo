import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BookOpen, ArrowLeft, FileText, X, RefreshCw } from 'lucide-react';
import Navbar from '../../components/Navbar';

const StudentClassDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lectures, setLectures] = useState([]);
  const [showStudyGuide, setShowStudyGuide] = useState(false);
  const [studyGuideContent, setStudyGuideContent] = useState('');
  const [isGeneratingGuide, setIsGeneratingGuide] = useState(false);
  const [guideError, setGuideError] = useState('');

  useEffect(() => {
    const fetchLectures = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`/api/lectures?classroom_id=${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLectures(res.data);
      } catch (err) {
        console.error(err);
        if (err.response?.status === 401) navigate('/login');
      }
    };
    fetchLectures();
  }, [id, navigate]);

  const handleGenerateStudyGuide = async () => {
    setShowStudyGuide(true);
    setGuideError('');
    if (studyGuideContent) return; // Already generated

    setIsGeneratingGuide(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/classrooms/\${id}/study-guide`, {
        headers: { Authorization: `Bearer \${token}` }
      });
      setStudyGuideContent(res.data.studyGuide);
    } catch (err) {
      console.error(err);
      setGuideError(err.response?.data?.error || 'Failed to generate study guide.');
    } finally {
      setIsGeneratingGuide(false);
    }
  };

  // Helper to safely render basic markdown
  const renderMarkdown = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
      if (line.startsWith('## ')) return <h3 key={i} style={{ marginTop: '1.5rem', marginBottom: '0.5rem', color: 'var(--primary-color)' }}>{line.replace('## ', '')}</h3>;
      if (line.startsWith('# ')) return <h2 key={i} style={{ marginTop: '2rem', marginBottom: '1rem' }}>{line.replace('# ', '')}</h2>;
      if (line.startsWith('- ')) return <li key={i} style={{ marginLeft: '1.5rem', marginBottom: '0.3rem' }}>{line.replace('- ', '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</li>;
      if (line.trim() === '') return <br key={i} />;
      return <p key={i} style={{ marginBottom: '0.5rem' }} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />;
    });
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
            <div className="auth-card" style={{ maxWidth: '100%', padding: '2rem', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.5rem', margin: 0 }}>
                  <BookOpen size={24} /> Classroom Lectures
                </h2>
                <button
                  onClick={handleGenerateStudyGuide}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.6rem 1.2rem', borderRadius: '0.5rem',
                    background: 'var(--primary-color)', color: 'white',
                    border: 'none', fontWeight: 600, cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                    transition: 'transform 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <FileText size={18} />
                  Generate Study Guide
                </button>
              </div>
              
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--secondary-color)' }}>
                          <img src={lec.teacher_profile_picture ? (lec.teacher_profile_picture.startsWith('http') ? lec.teacher_profile_picture : `http://localhost:5000${lec.teacher_profile_picture}`) : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(lec.teacher_name)}`} alt={lec.teacher_name} style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />
                          {new Date(lec.date).toLocaleDateString()} • {lec.teacher_name}
                        </div>
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

      {/* Study Guide Modal */}
      {showStudyGuide && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div onClick={() => setShowStudyGuide(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}></div>
          <div className="auth-card" style={{ position: 'relative', width: '100%', maxWidth: '800px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0, animation: 'fadeIn 0.3s' }}>
            
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg)', borderRadius: '1rem 1rem 0 0' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FileText size={24} color="var(--primary-color)" /> Master AI Study Guide</h2>
              <button onClick={() => setShowStudyGuide(false)} style={{ background: 'none', border: 'none', color: 'var(--text-color)', cursor: 'pointer' }}><X size={24} /></button>
            </div>

            <div style={{ padding: '2rem', overflowY: 'auto', flex: 1, background: 'var(--bg-color)', borderRadius: '0 0 1rem 1rem', lineHeight: '1.6' }}>
              {isGeneratingGuide ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', color: 'var(--primary-color)' }}>
                  <RefreshCw size={48} className="spin" />
                  <h3>Analyzing all lectures...</h3>
                  <p style={{ color: 'var(--secondary-color)' }}>Groq AI is building your comprehensive study guide. This only takes a few seconds.</p>
                </div>
              ) : guideError ? (
                <div style={{ color: '#ef4444', textAlign: 'center', padding: '2rem' }}>
                  <h3>Oops!</h3>
                  <p>{guideError}</p>
                </div>
              ) : (
                <div style={{ fontSize: '1.05rem', color: 'var(--text-color)' }}>
                  {renderMarkdown(studyGuideContent)}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default StudentClassDetail;
