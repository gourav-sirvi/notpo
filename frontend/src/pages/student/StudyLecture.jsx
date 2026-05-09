import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Play, RefreshCw, FileText, CheckCircle2, ChevronRight, ChevronLeft, Bookmark, Star, Send, MessageCircle, X, Volume2, Square } from 'lucide-react';
import Navbar from '../../components/Navbar';

const StudyLecture = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lecture, setLecture] = useState(null);
  const [activeTab, setActiveTab] = useState('notes'); // notes | flashcards | quiz
  const [summaryLevel, setSummaryLevel] = useState('medium'); 
  const audioRef = useRef(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Interaction State
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Feedback State
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [userFeedback, setUserFeedback] = useState(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  // Flashcard State
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Quiz State
  const [answers, setAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);

  useEffect(() => {
    const fetchLecture = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`/api/lectures/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLecture(res.data);
        setIsBookmarked(res.data.isBookmarked);
        setUserFeedback(res.data.userFeedback);
        if (res.data.userFeedback) {
          setRating(res.data.userFeedback.rating);
          setComment(res.data.userFeedback.comment || '');
        }
      } catch (err) {
        console.error(err);
        if (err.response?.status === 401) navigate('/login');
      }
    };

    fetchLecture();

    let interval;
    // Poll if still processing
    const checkProcessing = () => {
      setLecture(prev => {
        if (prev && (prev.status === 'processing' || !prev.summaries?.detailed)) {
          interval = setInterval(fetchLecture, 5000);
        }
        return prev;
      });
    };
    checkProcessing();

    return () => { if (interval) clearInterval(interval); };
  }, [id, navigate]);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const handleToggleBookmark = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`/api/lectures/${id}/bookmark`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsBookmarked(res.data.isBookmarked);
    } catch (err) {
      console.error('Bookmark toggle failed', err);
    }
  };

  const handleSendQuestion = async (e) => {
    e.preventDefault();
    if (!currentQuestion.trim() || isChatLoading) return;

    const userMsg = { role: 'user', text: currentQuestion };
    setChatMessages([...chatMessages, userMsg]);
    setCurrentQuestion('');
    setIsChatLoading(true);

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`/api/chat/${id}`, { message: userMsg.text }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChatMessages(prev => [...prev, { role: 'ai', text: res.data.answer }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'ai', text: 'Sorry, I am having trouble connecting to the AI assistant. Please try again later.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    if (rating === 0 || isSubmittingFeedback) return;
    setIsSubmittingFeedback(true);

    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/lectures/${id}/feedback`, { rating, comment }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserFeedback({ rating, comment });
    } catch (err) {
      console.error('Feedback submission failed', err);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleNextCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentCardIndex((prev) => (prev + 1) % lecture.flashcards.length);
    }, 150);
  };

  const handlePrevCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentCardIndex((prev) => (prev - 1 + lecture.flashcards.length) % lecture.flashcards.length);
    }, 150);
  };

  const handleQuizSubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingQuiz(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`/api/lectures/${id}/quiz`, { answers }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQuizResult(res.data);
      fetchLecture();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingQuiz(false);
    }
  };

  const handleSpeedChange = (e) => {
    const speed = parseFloat(e.target.value);
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const toggleTTS = () => {
    if (!lecture || !lecture.summaries || !lecture.summaries[summaryLevel]) return;
    
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      const textToRead = lecture.summaries[summaryLevel].replace(/^\d+\.\s*/gm, ''); // Clean up numbers
      const utterance = new SpeechSynthesisUtterance(textToRead);
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  // Cleanup TTS on unmount
  useEffect(() => {
    return () => window.speechSynthesis.cancel();
  }, []);

  if (!lecture) return <div style={{ minHeight: '100vh', background: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)', color: 'var(--text-color)', position: 'relative', overflowX: 'hidden' }}>
      <Navbar />

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <button 
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
          >
            <ArrowLeft size={18} /> Back
          </button>
          
          <button 
            onClick={handleToggleBookmark}
            style={{ 
              background: isBookmarked ? 'rgba(99, 102, 241, 0.1)' : 'var(--card-bg)', 
              border: `1px solid ${isBookmarked ? 'var(--primary-color)' : 'var(--border-color)'}`, 
              borderRadius: '2rem', padding: '0.5rem 1.25rem', display: 'flex', alignItems: 'center', 
              gap: '0.5rem', cursor: 'pointer', transition: 'all 0.3s ease',
              color: isBookmarked ? 'var(--primary-color)' : 'var(--secondary-color)',
              fontWeight: 600
            }}
          >
            <Bookmark size={18} fill={isBookmarked ? 'var(--primary-color)' : 'none'} />
            {isBookmarked ? 'Bookmarked' : 'Bookmark'}
          </button>
        </div>

        <div className="auth-card" style={{ maxWidth: '100%', padding: '2.5rem', marginBottom: '2rem', position: 'relative' }}>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>{lecture.title}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--secondary-color)', fontSize: '1rem', fontWeight: 500, marginBottom: '2rem' }}>
            <img src={lecture.teacher_profile_picture ? (lecture.teacher_profile_picture.startsWith('http') ? lecture.teacher_profile_picture : `http://localhost:5000${lecture.teacher_profile_picture}`) : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(lecture.teacher_name)}`} alt={lecture.teacher_name} style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
            {new Date(lecture.date).toLocaleDateString()} • {lecture.teacher_name}
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
          {['notes', 'flashcards', 'quiz'].map((tab) => (
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
              {tab}
            </button>
          ))}
        </div>

        {/* TAB CONTENTS */}
        {activeTab === 'notes' && (
          <div className="auth-card" style={{ maxWidth: '100%', padding: '2.5rem', animation: 'fadeIn 0.3s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
             <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}><FileText size={20} /> AI Summary</h2>
             <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
               {lecture.summaries?.[summaryLevel] && (
                 <button 
                   onClick={toggleTTS}
                   style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: `1px solid \${isSpeaking ? '#ef4444' : 'var(--primary-color)'}`, background: isSpeaking ? 'rgba(239, 68, 68, 0.1)' : 'rgba(140, 157, 129, 0.1)', color: isSpeaking ? '#ef4444' : 'var(--primary-color)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                 >
                   {isSpeaking ? <Square size={16} /> : <Volume2 size={16} />}
                   {isSpeaking ? 'Stop Reading' : 'Listen'}
                 </button>
               )}
               <select 
                  value={summaryLevel} 
                  onChange={(e) => {
                    setSummaryLevel(e.target.value);
                    if (isSpeaking) {
                      window.speechSynthesis.cancel();
                      setIsSpeaking(false);
                    }
                  }}
                  style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-color)' }}
                >
                  <option value="easy">Easy (Simple Summary)</option>
                  <option value="medium">Medium (Simplified Explanation)</option>
                  <option value="detailed">High (Detailed Notes)</option>
                </select>
             </div>
            </div>
            
            {lecture.status === 'processing' || !lecture.summaries?.[summaryLevel] ? (
               <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '3rem', background: 'var(--bg-color)', borderRadius: '1rem', border: '1px dashed var(--primary-color)' }}>
                <RefreshCw size={48} className="spin" color="var(--primary-color)" />
                <div style={{ textAlign: 'center' }}>
                  <h3 style={{ margin: '0 0 0.5rem 0' }}>AI is Crafting Your Study Material...</h3>
                  <p style={{ color: 'var(--secondary-color)', margin: 0 }}>Please stay on this page. Notes will appear automatically in a few seconds.</p>
                </div>
              </div>
            ) : lecture.status === 'failed' ? (
              <div style={{ padding: '2rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '1rem', border: '1px solid #ef4444', textAlign: 'center' }}>
                <h3 style={{ color: '#ef4444' }}>Material Generation Failed</h3>
                <p>There was an error generating study notes for this lecture. Your teacher has been notified.</p>
              </div>
            ) : (
              <div>
                {lecture.summaries[summaryLevel] ? (
                  <ol style={{ paddingLeft: '1.5rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {lecture.summaries[summaryLevel].split('\n').filter(p => p.trim()).map((point, i) => (
                      <li key={i} style={{ lineHeight: '1.75', fontSize: '1.05rem', color: 'var(--text-color)', paddingLeft: '0.5rem' }}>
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
                  <CheckCircle2 size={18} /> Key Concepts
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  {lecture.key_concepts.map((concept, i) => (
                    <span key={i} style={{ padding: '0.4rem 1rem', background: 'var(--card-bg)', borderRadius: '2rem', fontSize: '0.85rem', fontWeight: 600, border: '1px solid var(--border-color)', color: 'var(--text-color)' }}>
                      {concept}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            <hr style={{ margin: '2.5rem 0', borderColor: 'var(--border-color)' }} />
            <h3 style={{ marginBottom: '1rem' }}>Full Transcript</h3>
            <div style={{ background: 'var(--input-bg)', padding: '1.5rem', borderRadius: '1rem', fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--secondary-color)', border: '1px solid var(--border-color)', marginBottom: '3rem' }}>
              {lecture.transcript || 'No transcript available.'}
            </div>

            {/* FEEDBACK SECTION */}
            <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '1rem', border: '1px solid var(--border-color)', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <Star size={20} color="#f59e0b" /> How was this lecture?
              </h3>
              
              {userFeedback ? (
                <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '0.75rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem' }}>
                    {[1,2,3,4,5].map(s => <Star key={s} size={18} fill={s <= userFeedback.rating ? '#f59e0b' : 'none'} color="#f59e0b" />)}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.95rem', fontStyle: 'italic' }}>"{userFeedback.comment || 'No comment provided.'}"</p>
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#059669', fontWeight: 600 }}>Thank you for your feedback!</p>
                </div>
              ) : (
                <form onSubmit={handleSubmitFeedback}>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    {[1,2,3,4,5].map(s => (
                      <button 
                        key={s} 
                        type="button"
                        onMouseEnter={() => setHoverRating(s)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setRating(s)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        <Star size={32} fill={(hoverRating || rating) >= s ? '#f59e0b' : 'none'} color="#f59e0b" style={{ transition: 'all 0.2s' }} />
                      </button>
                    ))}
                  </div>
                  <textarea 
                    placeholder="Write a short comment... (optional)"
                    className="form-control"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    style={{ background: 'var(--input-bg)', borderRadius: '0.75rem', marginBottom: '1.5rem', padding: '1rem', fontFamily: 'inherit' }}
                  />
                  <button 
                    type="submit" 
                    disabled={rating === 0 || isSubmittingFeedback}
                    style={{ 
                      padding: '0.75rem 1.5rem', borderRadius: '0.75rem', border: 'none', 
                      background: 'var(--primary-color)', color: 'white', fontWeight: 600, cursor: 'pointer',
                      opacity: (rating === 0 || isSubmittingFeedback) ? 0.6 : 1, transition: 'all 0.3s ease'
                    }}
                  >
                    {isSubmittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* FLASHCARDS TAB */}
        {activeTab === 'flashcards' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'fadeIn 0.3s', padding: '1rem 0' }}>
            {(!lecture.flashcards || lecture.flashcards.length === 0) ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--secondary-color)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🧠</div>
                <p>No flashcards yet. Check back after AI processing completes.</p>
              </div>
            ) : (
              <>
                <div style={{ fontSize: '0.85rem', color: 'var(--secondary-color)', marginBottom: '1.5rem', fontWeight: 500 }}>
                  Card {currentCardIndex + 1} of {lecture.flashcards.length} — click to flip
                </div>

                {/* 3D Flip Card */}
                <div
                  onClick={() => setIsFlipped(!isFlipped)}
                  style={{ width: '100%', maxWidth: '580px', height: '280px', perspective: '1200px', cursor: 'pointer' }}
                >
                  <div style={{
                    position: 'relative', width: '100%', height: '100%',
                    transformStyle: 'preserve-3d',
                    transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  }}>
                    {/* FRONT */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                      background: 'var(--card-bg)',
                      border: '2px solid var(--border-color)',
                      borderRadius: '1.5rem',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      padding: '2rem', textAlign: 'center',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.08)'
                    }}>
                      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--secondary-color)', fontWeight: 700, marginBottom: '1.25rem' }}>Q U E S T I O N</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 600, lineHeight: '1.5', color: 'var(--text-color)' }}>
                        {lecture.flashcards[currentCardIndex]?.front}
                      </div>
                      <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--secondary-color)', opacity: 0.7 }}>Tap to reveal answer  ↻</div>
                    </div>

                    {/* BACK */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                      background: 'var(--primary-hover)',
                      borderRadius: '1.5rem',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      padding: '2rem', textAlign: 'center',
                      border: '1px solid var(--border-color)',
                      boxShadow: '0 10px 30px var(--btn-shadow)'
                    }}>
                      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '2px', color: 'rgba(255,255,255,0.65)', fontWeight: 700, marginBottom: '1.25rem' }}>A N S W E R</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 600, lineHeight: '1.6', color: '#ffffff' }}>
                        {lecture.flashcards[currentCardIndex]?.back}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dot nav + arrows */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginTop: '2rem' }}>
                  <button onClick={handlePrevCard}
                    style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-color)', transition: 'border-color 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary-color)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}>
                    <ChevronLeft size={22} />
                  </button>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {lecture.flashcards.map((_, i) => (
                      <div key={i}
                        onClick={() => { setIsFlipped(false); setTimeout(() => setCurrentCardIndex(i), 150); }}
                        style={{ width: i === currentCardIndex ? '24px' : '8px', height: '8px', borderRadius: '4px', background: i === currentCardIndex ? 'var(--primary-color)' : 'var(--border-color)', cursor: 'pointer', transition: 'all 0.3s' }} />
                    ))}
                  </div>

                  <button onClick={handleNextCard}
                    style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-color)', transition: 'border-color 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary-color)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}>
                    <ChevronRight size={22} />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* QUIZ TAB */}
        {activeTab === 'quiz' && (
          <div className="auth-card" style={{ maxWidth: '100%', padding: '2.5rem', animation: 'fadeIn 0.3s' }}>
            {(!lecture.mcqs || lecture.mcqs.length === 0) ? (
              <p style={{ color: 'var(--secondary-color)' }}>No quiz available for this lecture yet.</p>
            ) : (lecture.user_score !== null || quizResult) ? (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <CheckCircle2 size={64} style={{ color: '#10b981', margin: '0 auto 1rem' }} />
                <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Quiz Completed!</h2>
                <p style={{ fontSize: '1.2rem', color: 'var(--secondary-color)' }}>
                  You scored <strong style={{ color: 'var(--text-color)', fontSize: '1.5rem' }}>{quizResult?.score ?? lecture.user_score}</strong> out of {quizResult?.maxScore ?? lecture.mcqs.length}.
                </p>
                <p style={{ marginTop: '1rem', color: 'var(--secondary-color)', fontSize: '0.9rem', marginBottom: '3rem' }}>The instructor has been notified of your score.</p>
                
                {/* Review Section */}
                <div style={{ textAlign: 'left', marginTop: '2rem' }}>
                  <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>Review Your Answers</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {lecture.mcqs.map((mcq, idx) => {
                      const userAnswers = quizResult ? answers : (lecture.user_answers || {});
                      const selectedOpt = userAnswers[mcq.id];
                      const correctOpt = mcq.correct_option;
                      
                      return (
                        <div key={mcq.id} style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
                          <h4 style={{ marginBottom: '1rem', fontSize: '1.05rem', lineHeight: '1.5' }}>{idx + 1}. {mcq.question}</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {['A', 'B', 'C', 'D'].map((opt) => {
                              const isSelected = selectedOpt === opt;
                              const isCorrect = correctOpt === opt;
                              
                              let bg = 'var(--input-bg)';
                              let borderColor = 'var(--border-color)';
                              let color = 'var(--text-color)';
                              
                              if (isCorrect) {
                                bg = 'rgba(16, 185, 129, 0.1)';
                                borderColor = '#10b981';
                                color = '#10b981';
                              } else if (isSelected && !isCorrect) {
                                bg = 'rgba(239, 68, 68, 0.1)';
                                borderColor = '#ef4444';
                                color = '#ef4444';
                              }

                              return (
                                <div key={opt} style={{ 
                                  padding: '1rem', 
                                  background: bg, 
                                  border: `1px solid \${borderColor}`, 
                                  borderRadius: '0.75rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  color: color,
                                  fontWeight: isSelected || isCorrect ? 600 : 400
                                }}>
                                  <span>{opt}. {mcq[`option_\${opt.toLowerCase()}`]}</span>
                                  <div style={{ fontSize: '0.85rem' }}>
                                    {isCorrect && !isSelected && <span>✓ Correct Answer</span>}
                                    {isCorrect && isSelected && <span>✓ You answered correctly</span>}
                                    {isSelected && !isCorrect && <span>✗ Your Answer</span>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleQuizSubmit}>
                <h2 style={{ marginBottom: '2rem' }}>Knowledge Check Quiz</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                  {lecture.mcqs.map((mcq, idx) => (
                    <div key={mcq.id}>
                      <h4 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>{idx + 1}. {mcq.question}</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {['A', 'B', 'C', 'D'].map((opt) => (
                          <label 
                            key={opt}
                            style={{ 
                              display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', 
                              border: `2px solid ${answers[mcq.id] === opt ? 'var(--primary-color)' : 'var(--border-color)'}`, 
                              borderRadius: '0.75rem', cursor: 'pointer', background: 'var(--input-bg)',
                              transition: 'all 0.2s'
                            }}
                          >
                            <input 
                              type="radio" 
                              name={`mcq_${mcq.id}`} 
                              value={opt}
                              checked={answers[mcq.id] === opt}
                              onChange={() => setAnswers({...answers, [mcq.id]: opt})}
                              style={{ transform: 'scale(1.2)' }}
                              required
                            />
                            <span>{mcq[`option_${opt.toLowerCase()}`]}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                
                <button 
                  type="submit" 
                  disabled={isSubmittingQuiz || Object.keys(answers).length < lecture.mcqs.length}
                  className="btn-interactive"
                  style={{
                    width: '100%', marginTop: '3rem', padding: '1rem', borderRadius: '1rem',
                    fontSize: '1.1rem', fontWeight: 600,
                  }}
                >
                  {isSubmittingQuiz ? 'Submitting...' : 'Submit Quiz'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* --- AI CHAT DRAWER --- */}
      <button 
        onClick={() => setShowChat(true)}
        style={{
          position: 'fixed', bottom: '2rem', right: '2rem', width: '64px', height: '64px',
          borderRadius: '50%', background: 'var(--primary-color)', color: 'white', border: 'none',
          boxShadow: '0 8px 32px rgba(99, 102, 241, 0.4)', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 100, transition: 'transform 0.3s'
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        <MessageCircle size={32} />
      </button>

      {showChat && (
        <>
          <div onClick={() => setShowChat(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000 }}></div>
          <div 
            style={{ 
              position: 'fixed', top: 0, right: 0, height: '100vh', width: '100%', maxWidth: '450px',
              background: 'var(--card-bg)', boxShadow: '-10px 0 50px rgba(0,0,0,0.2)', zIndex: 1001,
              display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--primary-color)', color: 'white' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <MessageCircle size={24} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Lecture Assistant</h3>
                  <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Powered by Llama 3</span>
                </div>
              </div>
              <button onClick={() => setShowChat(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={24} /></button>
            </div>

            <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'var(--input-bg)', padding: '1rem', borderRadius: '0.75rem', fontSize: '0.9rem', color: 'var(--secondary-color)', alignSelf: 'flex-start', maxWidth: '85%' }}>
                Hi! I've read the transcript for **"{lecture.title}"**. Ask me anything about this lecture and I'll help you out!
              </div>

              {chatMessages.map((msg, i) => (
                <div key={i} style={{ 
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  background: msg.role === 'user' ? 'var(--primary-color)' : 'var(--input-bg)',
                  color: msg.role === 'user' ? 'white' : 'var(--text-color)',
                  padding: '1rem', borderRadius: '1rem', maxWidth: '85%', fontSize: '0.95rem',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                  borderBottomRightRadius: msg.role === 'user' ? '0' : '1rem',
                  borderBottomLeftRadius: msg.role === 'ai' ? '0' : '1rem',
                }}>
                  {msg.text}
                </div>
              ))}
              {isChatLoading && (
                <div style={{ alignSelf: 'flex-start', background: 'var(--input-bg)', padding: '1rem', borderRadius: '1rem', borderBottomLeftRadius: 0 }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <div className="dot-pulse"></div>
                    <div className="dot-pulse" style={{ animationDelay: '0.2s' }}></div>
                    <div className="dot-pulse" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef}></div>
            </div>

            <form onSubmit={handleSendQuestion} style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '0.75rem' }}>
              <input 
                type="text" 
                placeholder="Ask a question..."
                className="form-control"
                value={currentQuestion}
                onChange={e => setCurrentQuestion(e.target.value)}
                style={{ borderRadius: '2rem', padding: '0.75rem 1.5rem', background: 'var(--bg-color)', border: '1px solid var(--border-color)' }}
              />
              <button 
                type="submit" 
                disabled={!currentQuestion.trim() || isChatLoading}
                style={{ 
                  width: '45px', height: '45px', borderRadius: '50%', background: 'var(--primary-color)', 
                  border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.3s', opacity: (!currentQuestion.trim() || isChatLoading) ? 0.6 : 1
                }}
              >
                <Send size={20} />
              </button>
            </form>
          </div>
        </>
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .dot-pulse {
          width: 8px; height: 8px; border-radius: 50%; background: var(--secondary-color);
          animation: pulse 1.5s infinite ease-in-out;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(0.8); opacity: 0.5; }
          50% { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default StudyLecture;
