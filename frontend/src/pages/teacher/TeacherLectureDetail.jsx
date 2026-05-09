import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Play, RefreshCw, FileText, CheckCircle2 } from 'lucide-react';
import Navbar from '../../components/Navbar';

const TeacherLectureDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lecture, setLecture] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  const [summaryLevel, setSummaryLevel] = useState('medium');
  const audioRef = useRef(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studentScores, setStudentScores] = useState([]);

  const handleNextCard = () => {
    setIsFlipped(false);
    setTimeout(() => setCurrentCardIndex(prev => (prev + 1) % (lecture?.flashcards?.length || 1)), 150);
  };
  const handlePrevCard = () => {
    setIsFlipped(false);
    setTimeout(() => setCurrentCardIndex(prev => (prev - 1 + (lecture?.flashcards?.length || 1)) % (lecture?.flashcards?.length || 1)), 150);
  };



  useEffect(() => {
    let isMounted = true;
    let timeoutId;

    const fetchLectureAndScores = async () => {
      try {
        const token = localStorage.getItem('token');
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const [lectureRes, scoresRes] = await Promise.all([
            axios.get(`/api/lectures/${id}`, config),
            axios.get(`/api/lectures/${id}/scores`, config).catch(() => ({ data: [] }))
        ])
        
        if (isMounted) {
          setLecture(lectureRes.data);
          setStudentScores(scoresRes.data);

          if (lectureRes.data.status === 'processing' || !lectureRes.data.summaries?.detailed) {
            timeoutId = setTimeout(fetchLectureAndScores, 5000);
          }
        }
      } catch (err) {
        console.error(err);
        if (err.response?.status === 401 && isMounted) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          navigate('/login');
        }
      }
    };

    fetchLectureAndScores();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [id, navigate]);



  const handleRefreshAI = async () => {
    if (!window.confirm('Are you certain you want to regenerate all Notes, Flashcards, and Quizzes? The AI will use the audio to rebuild everything.')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/lectures/${id}/retry`, {}, { headers: { Authorization: `Bearer ${token}` } });
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Failed to trigger AI regeneration.');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this lecture? This will remove all summaries, notes, and quiz data.')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/lectures/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Lecture deleted successfully.');
      navigate(-1); // Go back
    } catch (err) {
      console.error(err);
      alert('Failed to delete lecture.');
    }
  };

  const handleSpeedChange = (e) => {
    const speed = parseFloat(e.target.value);
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  if (!lecture) return <div style={{ minHeight: '100vh', background: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)', color: 'var(--text-color)' }}>
      <Navbar />

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <button 
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
            >
            <ArrowLeft size={18} /> Back to Classroom
            </button>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                  onClick={handleRefreshAI}
                  disabled={lecture.status === 'processing'}
                  style={{ 
                      background: 'rgba(99, 102, 241, 0.1)', 
                      border: '1px solid rgba(99, 102, 241, 0.2)', 
                      color: '#6366f1', 
                      padding: '0.6rem 1.2rem', 
                      borderRadius: '0.75rem', 
                      cursor: lecture.status === 'processing' ? 'not-allowed' : 'pointer', 
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      opacity: lecture.status === 'processing' ? 0.5 : 1
                  }}
              >
                  <RefreshCw size={18} style={{ animation: lecture.status === 'processing' ? 'spin 1s linear infinite' : 'none' }} />
                  {lecture.status === 'processing' ? 'AI is Processing...' : 'Refresh AI Notes'}
              </button>

              <button 
                  onClick={handleDelete}
                  style={{ 
                      background: 'rgba(239, 68, 68, 0.1)', 
                      border: '1px solid rgba(239, 68, 68, 0.2)', 
                      color: '#ef4444', 
                      padding: '0.6rem 1.2rem', 
                      borderRadius: '0.75rem', 
                      cursor: 'pointer', 
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                  }}
              >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                  Delete Lecture
              </button>
            </div>
        </div>

        <div className="auth-card" style={{ maxWidth: '100%', padding: '2.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>{lecture.title}</h1>
              <div style={{ color: 'var(--secondary-color)', fontSize: '1rem', fontWeight: 500, marginBottom: '2rem' }}>
                {new Date(lecture.date).toLocaleDateString()}
              </div>
            </div>
            <div style={{ background: 'var(--input-bg)', padding: '0.5rem 1rem', borderRadius: '2rem', color: 'var(--primary-color)', fontWeight: 600, border: '1px solid var(--primary-color)'}}>
              Teacher View
            </div>
          </div>

          {lecture.audio_file && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--input-bg)', padding: '1rem', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
              <Play size={20} color="var(--primary-color)" />
              <audio ref={audioRef} src={`\${lecture.audio_file}`} controls style={{ flex: 1, height: '40px', outline: 'none' }} />
              <select 
                value={playbackSpeed} 
                onChange={handleSpeedChange}
                style={{ padding: '0.4rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-color)', fontWeight: 600, cursor: 'pointer' }}
              >
                <option value="0.5">0.5x</option>
                <option value="1">1x</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2x</option>
              </select>
            </div>
          )}

          {/* Smart Timestamps */}
          {lecture.timestamps && lecture.timestamps.length > 0 && (
            <div style={{ marginTop: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {lecture.timestamps.map((ts, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (audioRef.current) {
                      audioRef.current.currentTime = ts.time_seconds;
                      audioRef.current.play();
                    }
                  }}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '2rem',
                    border: '1px solid var(--primary-color)',
                    background: 'rgba(99, 102, 241, 0.1)',
                    color: 'var(--primary-color)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--primary-color)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                    e.currentTarget.style.color = 'var(--primary-color)';
                  }}
                >
                  <Play size={12} />
                  {Math.floor(ts.time_seconds / 60)}:{(ts.time_seconds % 60).toString().padStart(2, '0')} - {ts.topic}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* STUDY TABS */}
        <div style={{ 
          display: 'flex', 
          background: 'var(--card-bg)', 
          backdropFilter: 'blur(10px)',
          borderRadius: '1rem', 
          padding: '0.5rem', 
          marginBottom: '2rem',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)',
          border: '1px solid var(--border-color)'
        }}>
          {['notes', 'flashcards', 'quiz reviews', 'student scores'].map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, padding: '1rem 1.5rem', borderRadius: '0.75rem', border: 'none',
                fontWeight: 600, fontSize: '1rem', cursor: 'pointer', textTransform: 'capitalize',
                background: activeTab === tab ? 'var(--primary-color)' : 'transparent',
                color: activeTab === tab ? '#fff' : 'var(--text-color)',
                boxShadow: activeTab === tab ? '0 4px 10px rgba(99, 102, 241, 0.3)' : 'none',
                transition: 'all 0.3s ease'
              }}
            >
              {tab.replace('reviews', 'Preview')}
            </button>
          ))}
        </div>

        {/* TAB CONTENTS */}
        {activeTab === 'notes' && (
          <div className="auth-card" style={{ maxWidth: '100%', padding: '2.5rem', animation: 'fadeIn 0.3s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
             <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FileText size={20} /> AI Summary Options</h2>
             <select 
                value={summaryLevel} 
                onChange={(e) => setSummaryLevel(e.target.value)}
                style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-color)', fontWeight: 'bold' }}
              >
                <option value="easy">Easy (Bullet Summary)</option>
                <option value="medium">Medium (Quick Understanding)</option>
                <option value="detailed">High (Detailed Study Notes)</option>
              </select>
            </div>
            
            <p style={{ color: 'var(--secondary-color)', fontSize: '0.9rem', marginBottom: '1.5rem', fontStyle: 'italic' }}>
              Preview how students will see the {summaryLevel === 'easy' ? 'small' : summaryLevel === 'medium' ? 'medium' : 'large'}-sized AI notes.
            </p>

            {lecture.status === 'processing' || !lecture.summaries?.[summaryLevel] ? (
               <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '3rem', background: 'var(--bg-color)', borderRadius: '1rem', border: '1px dashed var(--primary-color)' }}>
                <RefreshCw size={48} className="spin" color="var(--primary-color)" />
                <div style={{ textAlign: 'center' }}>
                  <h3 style={{ margin: '0 0 0.5rem 0' }}>AI is Crafting Your Notes...</h3>
                  <p style={{ color: 'var(--secondary-color)', margin: 0 }}>This usually takes 10-30 seconds. This page will update automatically.</p>
                </div>
              </div>
            ) : lecture.status === 'failed' ? (
              <div style={{ padding: '2rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '1rem', border: '1px solid #ef4444', textAlign: 'center' }}>
                <h3 style={{ color: '#ef4444' }}>AI Processing Failed</h3>
                <p>There was an error generating notes for this lecture. Please check if Ollama is running or try re-uploading.</p>
              </div>
            ) : (
              <div style={{ padding: '1.5rem', background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '1rem' }}>
                {lecture.summaries[summaryLevel] ? (
                  <ol style={{ paddingLeft: '1.5rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {lecture.summaries[summaryLevel].split('\n').filter(p => p.trim()).map((point, i) => (
                      <li key={i} style={{ lineHeight: '1.7', fontSize: '1rem', color: 'var(--text-color)', paddingLeft: '0.5rem' }}>
                        {point.replace(/^\d+\.\s*/, '')}
                      </li>
                    ))}
                  </ol>
                ) : null}
              </div>
            )}

            {lecture.key_concepts && lecture.key_concepts.length > 0 && (
              <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '1rem', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle2 size={18} /> Generated Key Concepts
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  {lecture.key_concepts.map((concept, i) => (
                    <span key={i} style={{ padding: '0.4rem 1rem', background: 'var(--bg-color)', borderRadius: '2rem', fontSize: '0.85rem', fontWeight: 600, border: '1px solid var(--border-color)', color: 'var(--text-color)' }}>
                      {concept}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            <hr style={{ margin: '2rem 0', borderColor: 'var(--border-color)' }} />
            <h3 style={{ marginBottom: '1rem' }}>Original Raw Transcript</h3>
            <div style={{ background: 'var(--input-bg)', padding: '1.5rem', borderRadius: '1rem', fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--secondary-color)', border: '1px solid var(--border-color)' }}>
              {lecture.transcript || 'No transcript available.'}
            </div>
          </div>
        )}

        {activeTab === 'flashcards' && (
          <div className="auth-card" style={{ maxWidth: '100%', padding: '2.5rem', animation: 'fadeIn 0.3s' }}>
            <h2 style={{ marginBottom: '0.4rem' }}>Flashcards Preview</h2>
            <p style={{ color: 'var(--secondary-color)', fontSize: '0.88rem', marginBottom: '2rem', fontStyle: 'italic' }}>Preview how students will experience these flashcards</p>
            {(!lecture.flashcards || lecture.flashcards.length === 0) ? (
              <p style={{ color: 'var(--secondary-color)' }}>No flashcards generated yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--secondary-color)', fontWeight: 500 }}>
                  Card {currentCardIndex + 1} of {lecture.flashcards.length} — click to flip
                </div>

                {/* 3D Flip Card */}
                <div
                  onClick={() => setIsFlipped(!isFlipped)}
                  style={{ width: '100%', maxWidth: '580px', height: '260px', perspective: '1200px', cursor: 'pointer' }}
                >
                  <div style={{
                    position: 'relative', width: '100%', height: '100%',
                    transformStyle: 'preserve-3d',
                    transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  }}>
                    <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', background: 'var(--card-bg)', border: '2px solid var(--border-color)', borderRadius: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--secondary-color)', fontWeight: 700, marginBottom: '1rem' }}>Q U E S T I O N</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 600, lineHeight: '1.5', color: 'var(--text-color)' }}>{lecture.flashcards[currentCardIndex]?.front}</div>
                      <div style={{ marginTop: '1rem', fontSize: '0.78rem', color: 'var(--secondary-color)', opacity: 0.7 }}>Click to reveal answer ↻</div>
                    </div>
                    <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', background: 'var(--primary-hover)', borderRadius: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '2px', color: 'rgba(255,255,255,0.65)', fontWeight: 700, marginBottom: '1rem' }}>A N S W E R</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 600, lineHeight: '1.6', color: '#fff' }}>{lecture.flashcards[currentCardIndex]?.back}</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <button onClick={handlePrevCard} style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.2rem' }}>‹</button>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {lecture.flashcards.map((_, i) => (
                      <div key={i} onClick={() => { setIsFlipped(false); setTimeout(() => setCurrentCardIndex(i), 150); }}
                        style={{ width: i === currentCardIndex ? '24px' : '8px', height: '8px', borderRadius: '4px', background: i === currentCardIndex ? 'var(--primary-color)' : 'var(--border-color)', cursor: 'pointer', transition: 'all 0.3s' }} />
                    ))}
                  </div>
                  <button onClick={handleNextCard} style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.2rem' }}>›</button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'quiz reviews' && (
          <div className="auth-card" style={{ maxWidth: '100%', padding: '2.5rem', animation: 'fadeIn 0.3s' }}>
             <h2 style={{ marginBottom: '1.5rem' }}>AI Generated Quiz Preview</h2>
            {(!lecture.mcqs || lecture.mcqs.length === 0) ? (
              <p style={{ color: 'var(--secondary-color)' }}>No quiz available for this lecture yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  {lecture.mcqs.map((mcq, idx) => (
                    <div key={mcq.id || idx} style={{ padding: '1.5rem', background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '1rem' }}>
                      <h4 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>{idx + 1}. {mcq.question}</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        {['A', 'B', 'C', 'D'].map((opt) => (
                          <div 
                            key={opt}
                            style={{ 
                              padding: '1rem', 
                              border: `2px solid \${mcq.correct_option === opt ? '#10b981' : 'var(--border-color)'}`, 
                              borderRadius: '0.75rem', 
                              background: mcq.correct_option === opt ? 'rgba(16, 185, 129, 0.1)' : 'var(--input-bg)',
                              display: 'flex', gap: '1rem'
                            }}
                          >
                            <strong style={{ color: mcq.correct_option === opt ? '#10b981' : 'var(--text-color)' }}>{opt}.</strong>
                            <span>{mcq[`option_\${opt.toLowerCase()}`]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
               </div>
            )}
          </div>
        )}

        {activeTab === 'student scores' && (
          <div className="auth-card" style={{ maxWidth: '100%', padding: '2.5rem', animation: 'fadeIn 0.3s' }}>
             <h2 style={{ marginBottom: '1.5rem' }}>Student Quiz Submissions</h2>
            {(!studentScores || studentScores.length === 0) ? (
              <p style={{ color: 'var(--secondary-color)' }}>No students have completed the quiz yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {studentScores.map(score => (
                  <div key={score.student_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '1rem' }}>
                    <div>
                      <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem' }}>{score.name}</h4>
                      <div style={{ fontSize: '0.85rem', color: 'var(--secondary-color)' }}>Submitted: {new Date(score.taken_at).toLocaleString()}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary-color)' }}>
                        {score.score} / {lecture?.mcqs?.length || 5}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default TeacherLectureDetail;
