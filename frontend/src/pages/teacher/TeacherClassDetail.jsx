import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Mic, Square, Play, Upload, BookOpen, Users, ArrowLeft } from 'lucide-react';
import Navbar from '../../components/Navbar';

const TeacherClassDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lectures, setLectures] = useState([]);
  const [students, setStudents] = useState([]);
  
  // Teacher Upload State
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    fetchLectures();
    fetchStudents();
    
    // Init speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.onresult = (event) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscriptText(currentTranscript);
      };
    }
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

  const fetchStudents = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`\/api/classrooms/${id}/students`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStudents(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setTranscriptText('');

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      if (recognitionRef.current) recognitionRef.current.start();
      setIsRecording(true);
      setStatus('Recording... Speak into your microphone!');
    } catch (err) {
      console.error(err);
      setStatus('Microphone access denied or not available.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsRecording(false);
      setStatus('Recording stopped. Ready to upload.');
    }
  };

  const handleUpload = async () => {
    if (!audioBlob) return;
    if (!title) {
      setStatus('Please enter a lecture title first.');
      return;
    }

    setStatus('Uploading and generating study materials...');
    const formData = new FormData();
    formData.append('audio', audioBlob, 'lecture.webm');
    formData.append('title', title);
    formData.append('transcript', transcriptText);
    formData.append('classroom_id', id);

    try {
      const token = localStorage.getItem('token');
      await axios.post('\/api/lectures/upload', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setStatus('Lecture uploaded successfully! AI is processing in the background.');
      setAudioBlob(null);
      setAudioUrl('');
      setTitle('');
      setTranscriptText('');
      fetchLectures(); // refresh list
    } catch (err) {
      console.error('Upload failed:', err);
      const errorMsg = err.response?.data?.error || 'Upload failed. Please try again.';
      setStatus(errorMsg);
    }
  };

  const handleDeleteLecture = async (e, lectureId) => {
    e.stopPropagation(); // Prevent navigation to details
    if (!window.confirm('Are you sure you want to delete this lecture? This action cannot be undone.')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`\/api/lectures/${lectureId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus('Lecture deleted successfully.');
      fetchLectures(); // Refresh list
    } catch (err) {
      console.error('Deletion failed:', err);
      setStatus('Failed to delete lecture.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)', color: 'var(--text-color)' }}>
      <Navbar />

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <button 
            onClick={() => navigate('/teacher/dashboard')}
            style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
          >
            <ArrowLeft size={18} /> Back to Dashboard
          </button>
          <button
            onClick={() => navigate(`/teacher/class/${id}/analytics`)}
            style={{ padding: '0.6rem 1.25rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}
          >
            📊 View Analytics
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div className="auth-card" style={{ maxWidth: '100%', padding: '2rem' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '1.5rem' }}>
                  <Mic size={24} color="var(--primary-color)" /> Record New Lecture
                </h2>
                
                <div style={{ marginBottom: '1.5rem' }}>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Lecture Title / Chapter Name" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={{ borderRadius: '0.75rem' }}
                  />
                </div>

                {(transcriptText || audioUrl) && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <strong style={{display: 'block', marginBottom: '0.5rem', color: 'var(--secondary-color)', fontSize: '0.9rem'}}>
                      {isRecording ? 'Live Transcription:' : 'Review & Edit Transcription:'}
                    </strong>
                    <textarea 
                      value={transcriptText}
                      onChange={(e) => setTranscriptText(e.target.value)}
                      readOnly={isRecording}
                      placeholder="Transcript will appear here... You can edit it after recording."
                      style={{ 
                        width: '100%',
                        minHeight: '120px',
                        padding: '1rem', 
                        background: isRecording ? 'var(--bg-color)' : 'var(--input-bg)', 
                        borderRadius: '0.75rem', 
                        border: '1px solid var(--border-color)', 
                        fontSize: '0.95rem', 
                        color: 'var(--text-color)', 
                        fontFamily: 'inherit',
                        resize: 'vertical',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease'
                      }}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', gap: '1rem' }}>
                  {!isRecording ? (
                    <button 
                      onClick={startRecording}
                      style={{ flex: 1, padding: '0.85rem 1rem', borderRadius: '0.75rem', background: '#ec4899', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    >
                      <Mic size={18} /> Start Recording
                    </button>
                  ) : (
                    <button 
                      onClick={stopRecording}
                      style={{ flex: 1, padding: '0.85rem 1rem', borderRadius: '0.75rem', background: '#ef4444', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', animation: 'pulse 2s infinite' }}
                    >
                      <Square size={18} fill="currentColor" /> Stop Recording
                    </button>
                  )}
                </div>

                {audioUrl && !isRecording && (
                  <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: 'var(--bg-color)', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                      <Play size={24} color="var(--primary-color)" />
                      <h4 style={{ margin: 0 }}>Preview Recording</h4>
                    </div>
                    <audio src={audioUrl} controls style={{ width: '100%', outline: 'none' }} />
                    <button 
                      onClick={handleUpload}
                      style={{ width: '100%', marginTop: '1rem', padding: '0.85rem 1rem', borderRadius: '0.75rem', background: 'var(--primary-color)', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    >
                      <Upload size={18} /> Upload Lecture
                    </button>
                  </div>
                )}
                {status && <p style={{ marginTop: '1rem', color: 'var(--secondary-color)', fontWeight: 500, textAlign: 'center' }}>{status}</p>}
              </div>

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
                      onClick={() => navigate(`/teacher/lecture/${lec.lecture_id}`)}
                      style={{ padding: '1.5rem', background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s ease', cursor: 'pointer' }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary-color)'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                          <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--primary-color)' }}>{lec.title}</h4>
                          {lec.status === 'processing' && (
                            <span style={{ fontSize: '0.7rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary-color)', padding: '0.2rem 0.6rem', borderRadius: '1rem', border: '1px solid var(--primary-color)', fontWeight: 700, animation: 'pulse 2s infinite' }}>
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
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <div style={{ background: 'var(--card-bg)', padding: '0.5rem 1rem', borderRadius: '2rem', fontSize: '0.85rem', fontWeight: 600, border: '1px solid var(--border-color)' }}>
                          View Details
                        </div>
                        <button 
                          onClick={(e) => handleDeleteLecture(e, lec.lecture_id)}
                          title="Delete Lecture"
                          style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '0.5rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Student Roster Sidebar (Teacher Only) */}
            <div className="auth-card" style={{ maxWidth: '100%', padding: '2rem', height: 'fit-content' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '1.25rem' }}>
                <Users size={20} /> Enrolled Students
              </h3>
              
              {students.length === 0 ? (
                <p style={{ color: 'var(--secondary-color)', fontSize: '0.9rem', textAlign: 'center' }}>No students enrolled.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {students.map(stu => (
                    <div key={stu.student_id} style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                      <div style={{ fontWeight: 600, fontSize: '1rem' }}>{stu.name}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--secondary-color)' }}>{stu.email}</div>
                      <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                        <span>Quizzes: {stu.quizzes_taken}</span>
                        <span style={{ color: stu.average_score >= 4 ? '#10b981' : stu.average_score >= 3 ? '#f59e0b' : 'var(--primary-color)' }}>
                          Avg: {stu.average_score ? stu.average_score.toFixed(1) : '0'}/5
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          
        </div>
      </div>
    </div>
  );
};

export default TeacherClassDetail;
