import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Mic, Square, Upload, BookOpen, Users, ArrowLeft,
  Edit3, CheckCircle, AlertCircle, Pause, Play, X,
  MicOff, Radio, Trash2, Sun, Moon
} from 'lucide-react';
import Navbar from '../../components/Navbar';

/* ─────────────────────────────────────────────
   RECORDING STUDIO — full-screen glass overlay
───────────────────────────────────────────── */
const RecordingStudio = ({ classroomId, onClose, onUploaded }) => {
  const [phase, setPhase] = useState('idle'); // idle | recording | paused | stopped | uploading | done
  const [title, setTitle] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [statusType, setStatusType] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [battery, setBattery] = useState(null);
  const [micName, setMicName] = useState('Microphone');
  const [language, setLanguage] = useState('en-US');
  const [srStatus, setSrStatus] = useState(''); // 'listening' | 'restarting' | 'error' | ''
  const [isLocalDark, setIsLocalDark] = useState(document.documentElement.getAttribute('data-theme') === 'dark');
  
  // Single deterministic state for the textarea
  const [displayText, setDisplayText] = useState('');

  // Refs for tracking background truth
  const finalTextRef = useRef('');
  const audioBlobRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const transcriptAreaRef = useRef(null);
  const streamRef = useRef(null);
  const phaseRef = useRef('idle');
  // Clean flag to control auto-restart (replaces fragile _active custom property)
  const isListeningRef = useRef(false);
  // Keep language in a ref so onend closures always see the latest value
  const languageRef = useRef('en-US');
  // Retry counter for exponential backoff on network/service errors
  const srRetryCountRef = useRef(0);
  const SR_MAX_RETRIES = 8; // give up after 8 consecutive failures (~30s total)

  // Audio Visualizer Refs
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const volumeBarRef = useRef(null);

  /* ---------- Battery Level Sync ---------- */
  useEffect(() => {
    if ('getBattery' in navigator) {
      let bat = null;
      let cleanup = null;
      navigator.getBattery().then(b => {
        bat = b;
        const update = () => setBattery({ level: Math.round(b.level * 100), charging: b.charging });
        update();
        b.addEventListener('levelchange', update);
        b.addEventListener('chargingchange', update);
        cleanup = () => {
          b.removeEventListener('levelchange', update);
          b.removeEventListener('chargingchange', update);
        };
      }).catch(() => {});
      return () => { if (cleanup) cleanup(); };
    }
  }, []);

  /* ---------- Pre-flight Mic Check ---------- */
  useEffect(() => {
    const prefetchMic = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (stream.getAudioTracks().length > 0) {
          let label = stream.getAudioTracks()[0].label || 'Default Microphone';
          label = label.replace(' (Default)', '').replace('Default - ', '');
          if (label.length > 25) label = label.substring(0, 22) + '...';
          setMicName(label);
        }
        stream.getTracks().forEach(t => t.stop());
      } catch (err) {
        console.warn('Microphone permission ignored/denied during preflight:', err);
      }
    };
    prefetchMic();
  }, []);

  /* ---------- Visualizer Loop ---------- */
  const startVisualizer = useCallback(() => {
    const draw = () => {
      if (phaseRef.current !== 'recording' || !volumeBarRef.current || !analyserRef.current) return;
      const analyser = analyserRef.current;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      // Use time domain data for accurate amplitude (volume) measurement
      analyser.getByteTimeDomainData(dataArray);
      
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        // Time domain data is centered around 128. We want distance from center.
        const amplitude = Math.abs(dataArray[i] - 128);
        sum += amplitude;
      }
      
      // Average amplitude (0 to 128 max typically)
      let average = sum / bufferLength;
      
      // Multiply by a sensitivity factor to make it noticeable (e.g. * 3)
      let volumePct = Math.min(100, Math.max(3, (average * 3.5))); 
      
      volumeBarRef.current.style.width = `${volumePct}%`;
      // Color coded feedback: Green (Quiet/Good) -> Yellow (Loud) -> Red (Clipping)
      if (volumePct < 60) {
        volumeBarRef.current.style.background = '#10b981';
        volumeBarRef.current.style.boxShadow = '0 0 10px rgba(16,185,129,0.5)';
      } else if (volumePct < 85) {
        volumeBarRef.current.style.background = '#f59e0b';
        volumeBarRef.current.style.boxShadow = '0 0 10px rgba(245,158,11,0.5)';
      } else {
        volumeBarRef.current.style.background = '#ef4444';
        volumeBarRef.current.style.boxShadow = '0 0 10px rgba(239,68,68,0.5)';
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };
    draw();
  }, []);

  /* ---------- Keep languageRef in sync ---------- */
  useEffect(() => { languageRef.current = language; }, [language]);

  /* ---------- Speech Recognition — fresh instance on every start/restart ----------
   *
   * WHY a function instead of a single useEffect?
   *  • Creating a fresh SR instance every time avoids InvalidStateError that
   *    Chrome throws when you call .start() on a session that ended with an error.
   *  • It also ensures `lang` is always the latest selected language.
   *  • isListeningRef drives all restart logic cleanly without a custom property.
   */
  const startSpeechRecognition = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setStatusMsg('⚠️ Speech Recognition not supported. Please use Google Chrome or Microsoft Edge.');
      setStatusType('error');
      return;
    }
    if (!isListeningRef.current) return; // recording was stopped — don't restart

    // Give up after too many consecutive failures
    if (srRetryCountRef.current >= SR_MAX_RETRIES) {
      setSrStatus('error');
      // Don't show a disruptive red banner — the status pill already shows 'error'.
      // Just set a quiet informational message in the statusMsg area.
      setStatusMsg('ℹ️ Speech recognition is unavailable right now (Google\'s servers may be blocked on your network). The transcript box is editable — you can type your notes directly, or try again after recording stops.');
      setStatusType('info');
      return;
    }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;  // ← CRITICAL for real-time word-by-word display
    rec.maxAlternatives = 1;
    rec.lang = languageRef.current;

    rec.onstart = () => {
      srRetryCountRef.current = 0; // successful start — reset backoff counter
      setSrStatus('listening');
      // Clear any previous network-error message so it doesn't confuse the teacher
      setStatusMsg(prev => prev.startsWith('ℹ️') || prev.startsWith('⚠️') ? '' : prev);
      console.log('[Speech] Started, lang:', rec.lang);
    };

    rec.onresult = (event) => {
      let interim = '';
      let newFinal = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          newFinal += text + ' ';
        } else {
          interim += text;
        }
      }

      if (newFinal) finalTextRef.current += newFinal;

      // Real-time display: finalised text + currently-spoken interim text
      setDisplayText(finalTextRef.current + interim);

      if (transcriptAreaRef.current) {
        transcriptAreaRef.current.scrollTop = transcriptAreaRef.current.scrollHeight;
      }
    };

    rec.onerror = (e) => {
      console.warn('[Speech] Error:', e.error, '| retry:', srRetryCountRef.current);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        // Fatal — user denied mic. Stop trying.
        isListeningRef.current = false;
        setSrStatus('error');
        setStatusMsg('🎤 Microphone permission denied. Click the lock icon in your browser address bar, allow microphone, then refresh.');
        setStatusType('error');
      } else if (e.error === 'network') {
        // Chrome cannot reach Google's speech servers.
        // DON'T show a big red banner — just update the pill quietly.
        // onend will fire next and trigger the exponential-backoff retry.
        srRetryCountRef.current += 1;
        setSrStatus('restarting');
      } else if (e.error === 'no-speech') {
        // Normal silence — onend fires next and will restart. No action needed.
        setSrStatus('restarting');
      } else {
        srRetryCountRef.current += 1;
        setSrStatus('restarting');
        console.warn('[Speech] Non-fatal error, will auto-restart:', e.error);
      }
    };

    // onend fires after EVERY session.
    // Compute an exponential backoff delay: 250ms * 2^retryCount, capped at 8s.
    rec.onend = () => {
      setSrStatus(prev => prev === 'listening' ? 'restarting' : prev);
      if (isListeningRef.current) {
        const delay = Math.min(250 * Math.pow(2, srRetryCountRef.current), 8000);
        setTimeout(() => {
          if (isListeningRef.current) {
            startSpeechRecognition();
          }
        }, delay);
      }
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch (err) {
      console.warn('[Speech] Could not start:', err.message);
      srRetryCountRef.current += 1;
      if (isListeningRef.current) {
        const delay = Math.min(250 * Math.pow(2, srRetryCountRef.current), 8000);
        setTimeout(() => startSpeechRecognition(), delay);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Timer ---------- */
  const formatTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  /* ---------- START ---------- */
  const handleStart = async () => {
    try {
      // Request mic permission explicitly first
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      // Detect Mic Name
      if (stream.getAudioTracks().length > 0) {
        let label = stream.getAudioTracks()[0].label || 'Microphone';
        // Cleanup windows mic labels
        label = label.replace(' (Default)', '').replace('Default - ', '');
        // Truncate if too long (e.g. very long BT headset names)
        if (label.length > 25) label = label.substring(0, 22) + '...';
        setMicName(label);
      }

      // Reset all state
      finalTextRef.current = '';
      setDisplayText('');
      audioBlobRef.current = null;
      audioChunksRef.current = [];
      setAudioUrl('');
      setStatusMsg('');

      // Setup MediaRecorder
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm' });
      mediaRecorderRef.current = mr;

      // Setup Audio Visualizer
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;
      } catch (err) {
        console.warn('Audio Visualizer setup failed:', err);
      }

      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioBlobRef.current = blob;
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
        phaseRef.current = 'stopped';
        setPhase('stopped');
        setDisplayText(finalTextRef.current); // lock the final text
      };

      mr.start(1000); // collect every 1s

      // Start speech recognition — delayed by 300 ms so MediaRecorder claims
      // the mic first. Prevents silent conflict on Bluetooth earbuds / USB mics.
      srRetryCountRef.current = 0; // fresh session — reset backoff counter
      isListeningRef.current = true;
      setSrStatus('restarting');
      setTimeout(() => {
        if (isListeningRef.current) startSpeechRecognition();
      }, 300);

      // Start timer
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);

      phaseRef.current = 'recording';
      setPhase('recording');
      startVisualizer();
    } catch (err) {
      console.error('[Recording] Start failed:', err);
      setStatusMsg('Could not access microphone. Please allow microphone permission in your browser and try again.');
      setStatusType('error');
    }
  };

  /* ---------- PAUSE ---------- */
  const handlePause = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
    }
    isListeningRef.current = false; // stop auto-restart loop
    setSrStatus('');
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) { /* ok */ }
    }
    clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    phaseRef.current = 'paused';
    setPhase('paused');
  };

  /* ---------- RESUME ---------- */
  const handleResume = () => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
    }
    // Restart speech recognition with a fresh instance
    isListeningRef.current = true;
    setSrStatus('restarting');

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (_) { /* ok */ }
    }

    setTimeout(() => {
      if (isListeningRef.current) startSpeechRecognition();
    }, 200);

    timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
    phaseRef.current = 'recording';
    setPhase('recording');
    startVisualizer();
  };

  /* ---------- STOP ---------- */
  const handleStop = () => {
    isListeningRef.current = false; // stop auto-restart loop FIRST
    setSrStatus('');
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) { /* ok */ }
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop(); // triggers mr.onstop → sets phase to 'stopped'
    }
    clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  /* ---------- UPLOAD ---------- */
  const handleUpload = async () => {
    if (!audioBlobRef.current) return;
    if (!title.trim()) {
      setStatusMsg('Please enter a lecture title before uploading.');
      setStatusType('error');
      return;
    }
    setPhase('uploading');
    setStatusMsg('Uploading… AI is generating your notes in the background.');
    setStatusType('info');

    const fd = new FormData();
    fd.append('audio', audioBlobRef.current, 'lecture.webm');
    fd.append('title', title.trim());
    fd.append('transcript', (displayText || finalTextRef.current || '').trim());
    fd.append('classroom_id', classroomId);

    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/lectures/upload', fd, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      setStatusMsg('✅ Lecture uploaded! AI is generating 5/10/20-point notes, flashcards & quiz in the background.');
      setStatusType('success');
      setPhase('done');
      onUploaded();
    } catch (err) {
      setStatusMsg(err.response?.data?.error || 'Upload failed. Please try again.');
      setStatusType('error');
      setPhase('stopped');
    }
  };

  const handleClose = useCallback(() => {
    isListeningRef.current = false; // stop any pending restarts
    setSrStatus('');
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) { /* ok */ }
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    onClose();
  }, [onClose]);

  const toggleTheme = () => {
    const newDark = !isLocalDark;
    setIsLocalDark(newDark);
    const newTheme = newDark ? 'dark' : 'light';
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const isLive = phase === 'recording';
  const isPaused = phase === 'paused';
  const isStopped = phase === 'stopped';
  const isDone = phase === 'done';
  const isUploading = phase === 'uploading';
  const isIdle = phase === 'idle';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'var(--studio-overlay)',
      backdropFilter: 'blur(24px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      {/* Animated background orbs */}
      <div style={{ position: 'absolute', top: '10%', left: '5%', width: '400px', height: '400px', borderRadius: '50%', background: isLive ? 'rgba(239,68,68,0.12)' : isPaused ? 'rgba(245,158,11,0.1)' : 'rgba(99,102,241,0.12)', filter: 'blur(80px)', transition: 'background 1s', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '5%', width: '350px', height: '350px', borderRadius: '50%', background: isLive ? 'rgba(236,72,153,0.1)' : 'rgba(6,182,212,0.1)', filter: 'blur(80px)', transition: 'background 1s', pointerEvents: 'none' }} />

      <div style={{
        width: '100%', maxWidth: '880px',
        background: 'var(--studio-bg)',
        border: '1px solid var(--studio-border)',
        borderRadius: '2rem',
        backdropFilter: 'blur(40px)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
        overflow: 'hidden',
        maxHeight: '95vh',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* ─── TOP BAR ─── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', borderBottom: '1px solid var(--studio-border)', background: 'var(--studio-topbar)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: isLive ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.2)', border: `1.5px solid ${isLive ? '#ef4444' : 'rgba(99,102,241,0.5)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.5s' }}>
              {isLive ? <Radio size={20} color="#ef4444" style={{ animation: 'recPulse 1s infinite' }} />
                : isPaused ? <Pause size={20} color="#f59e0b" />
                : isStopped || isDone ? <CheckCircle size={20} color="#10b981" />
                : <Mic size={20} color="var(--primary-color)" />}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--studio-text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isIdle ? 'Recording Studio' : isLive ? '🔴 Recording...' : isPaused ? '⏸ Paused' : isStopped ? '✅ Recording Complete' : isDone ? '🎉 Uploaded!' : '⏫ Uploading...'}
                <span style={{ fontSize: '0.85rem', color: 'var(--studio-text-muted)', background: 'var(--studio-close-bg)', padding: '0.1rem 0.6rem', borderRadius: '1rem', fontWeight: 700 }}>
                  {new Date().getFullYear()}
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--studio-text-muted)', marginTop: '0.1rem' }}>
                {isIdle ? 'Set a title and press Start' : isLive || isPaused ? `Elapsed: ${formatTime(recordingTime)}` : isStopped ? 'Review transcript and upload when ready' : 'AI is generating your study materials'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Timer and Battery badge */}
            {(isLive || isPaused) && (
              <div style={{ fontFamily: 'monospace', fontSize: '2rem', fontWeight: 800, color: isLive ? '#ef4444' : '#f59e0b', background: 'var(--studio-close-bg)', padding: '0.4rem 1.2rem', borderRadius: '0.75rem', border: `1px solid ${isLive ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`, letterSpacing: '2px', transition: 'color 0.4s' }}>
                {formatTime(recordingTime)}
              </div>
            )}

            <button onClick={toggleTheme}
              title="Toggle Light/Dark Mode"
              style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--studio-close-bg)', border: '1px solid var(--studio-border)', color: 'var(--studio-close-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary-color)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--studio-close-bg)'; e.currentTarget.style.color = 'var(--studio-close-color)'; }}>
              {isLocalDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button onClick={handleClose}
              title="Close Studio"
              style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--studio-close-bg)', border: '1px solid var(--studio-border)', color: 'var(--studio-close-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--studio-close-hover-bg)'; e.currentTarget.style.color = 'var(--studio-close-hover-color)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--studio-close-bg)'; e.currentTarget.style.color = 'var(--studio-close-color)'; }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div style={{ padding: '2rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* ─── TITLE INPUT ─── */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--studio-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.6rem' }}>
              Lecture Title *
            </label>
            <input
              type="text"
              placeholder="e.g. Chapter 5 – Newton's Laws of Motion"
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={isLive || isPaused || isUploading || isDone}
              style={{
                width: '100%', padding: '1rem 1.25rem', borderRadius: '1rem', boxSizing: 'border-box',
                background: 'var(--studio-input-bg)', border: '1.5px solid var(--studio-input-border)',
                color: 'var(--studio-text)', fontSize: '1.05rem', fontWeight: 600, outline: 'none',
                transition: 'border-color 0.3s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--primary-color)'}
              onBlur={e => e.target.style.borderColor = 'var(--studio-input-border)'}
            />
          </div>

          {/* ─── LIVE TRANSCRIPT ─── */}
          <div style={{ flex: 1 }}>
            {/* Volume Visualizer Bar */}
            {(isLive || isPaused) && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>
                  <span>Voice Volume Indicator</span>
                  <span style={{ color: isPaused ? '#f59e0b' : 'rgba(255,255,255,0.5)' }}>
                    {isPaused ? 'Paused' : 'Monitoring Mic...'}
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '1rem', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)' }}>
                  <div ref={volumeBarRef} style={{ height: '100%', width: isPaused ? '0%' : '2%', background: '#10b981', transition: 'width 0.1s ease-out, background 0.2s', borderRadius: '1rem', boxShadow: '0 0 10px rgba(16,185,129,0.5)' }} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--studio-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isLive ? (
                  <>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'recPulse 0.8s infinite' }} />
                    Live Transcription
                    {/* SR engine status pill */}
                    {srStatus === 'listening' && (
                      <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '2rem', padding: '0.1rem 0.55rem', letterSpacing: '0.5px' }}>
                        ● listening
                      </span>
                    )}
                    {srStatus === 'restarting' && (
                      <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '2rem', padding: '0.1rem 0.55rem', letterSpacing: '0.5px' }}>
                        ↻ connecting…
                      </span>
                    )}
                  </>
                ) : isPaused ? (
                  <><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} /> Paused</>
                ) : (
                  <><Edit3 size={13} /> Transcript {(isStopped) ? '— Edit before uploading' : ''}</>
                )}
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  disabled={isLive || isPaused || isUploading || isDone}
                  title={isLive ? "Cannot change language while recording" : "Select Speech Language"}
                  style={{
                    background: 'var(--studio-input-bg)', border: '1px solid var(--studio-input-border)',
                    color: 'var(--studio-text)', padding: '0.35rem 0.6rem', borderRadius: '0.5rem', outline: 'none',
                    fontSize: '0.75rem', fontWeight: 600, cursor: (isLive || isPaused) ? 'not-allowed' : 'pointer'
                  }}
                >
                  <option value="en-US" style={{color: '#000'}}>🇺🇸 English (US)</option>
                  <option value="en-IN" style={{color: '#000'}}>🇮🇳 English (India)</option>
                  <option value="hi-IN" style={{color: '#000'}}>🇮🇳 Hindi</option>
                </select>
                
                <button 
                  onClick={() => {
                    if (window.confirm("Are you sure you want to clear the entire transcription?")) {
                      finalTextRef.current = '';
                      setDisplayText('');
                    }
                  }}
                  disabled={isUploading || isDone}
                  title="Clear Transcript"
                  style={{
                    background: 'none', border: 'none', color: 'rgba(255,100,100,0.8)', cursor: isUploading || isDone ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.3rem',
                    transition: 'color 0.2s, transform 0.2s', opacity: (isUploading || isDone) ? 0.3 : 1
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,100,100,0.8)'; e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <textarea
                ref={transcriptAreaRef}
                value={displayText}
                onChange={e => {
                  // Always allow editing — SR results append to whatever is here.
                  // This is the fallback for when speech recognition fails (network error etc.)
                  finalTextRef.current = e.target.value;
                  setDisplayText(e.target.value);
                }}
                readOnly={isUploading || isDone}
                placeholder={
                  isIdle ? '📝 Your speech will appear here in real-time as you record...'
                  : isLive ? '🎙 Listening... speak now — or type here if speech recognition is unavailable'
                  : isPaused ? '✏️ You can type notes here while paused...'
                  : ''
                }
                style={{
                  width: '100%',
                  height: '260px',
                  padding: '1.25rem 1.5rem',
                  paddingRight: isLive ? '80px' : '1.25rem',
                  borderRadius: '1.25rem',
                  border: isLive
                    ? '2px solid rgba(239,68,68,0.5)'
                    : isPaused
                      ? '2px solid rgba(245,158,11,0.4)'
                      : isStopped
                        ? '2px solid rgba(167,139,250,0.4)'
                        : '1.5px solid var(--studio-textarea-border)',
                  background: isLive
                    ? 'rgba(239,68,68,0.04)'
                    : isPaused
                      ? 'rgba(245,158,11,0.04)'
                      : 'var(--studio-textarea-bg)',
                  color: 'var(--studio-text)',
                  fontSize: '1.1rem',
                  lineHeight: '1.85',
                  fontFamily: 'inherit',
                  resize: isUploading || isDone ? 'none' : 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.4s, background 0.4s',
                  cursor: isUploading || isDone ? 'default' : 'text',
                  boxShadow: isLive ? '0 0 0 4px rgba(239,68,68,0.08), inset 0 2px 8px rgba(0,0,0,0.1)' : 'inset 0 2px 8px rgba(0,0,0,0.05)',
                }}
              />
              {isLive && (
                <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem', fontWeight: 900, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444', animation: 'recPulse 0.8s infinite' }} />
                  REC
                </div>
              )}
              {/* Word count */}
              {displayText && (
                <div style={{ position: 'absolute', bottom: '0.75rem', right: '1rem', fontSize: '0.72rem', color: 'var(--studio-text-muted)', fontWeight: 600 }}>
                  {finalTextRef.current.trim().split(/\s+/).filter(Boolean).length} words
                </div>
              )}
            </div>
          </div>

          {/* ─── CONTROL BUTTONS ─── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {/* START */}
              {isIdle && (
                <button onClick={handleStart} className="btn-interactive"
                  style={{ flex: 1, minWidth: '200px', padding: '1.1rem 2rem', borderRadius: '1rem', fontWeight: 800, fontSize: '1.05rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                  <Mic size={22} /> Start Recording
                </button>
              )}

            {/* PAUSE (while recording) */}
            {isLive && (
              <button onClick={handlePause}
                style={{ flex: 1, padding: '1.1rem 2rem', borderRadius: '1rem', background: 'rgba(245,158,11,0.15)', border: '2px solid rgba(245,158,11,0.45)', color: '#f59e0b', fontWeight: 800, fontSize: '1.05rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.25)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(245,158,11,0.15)'}>
                <Pause size={22} /> Pause
              </button>
            )}

            {/* RESUME (while paused) */}
            {isPaused && (
              <button onClick={handleResume}
                style={{ flex: 1, padding: '1.1rem 2rem', borderRadius: '1rem', background: 'rgba(16,185,129,0.15)', border: '2px solid rgba(16,185,129,0.45)', color: '#10b981', fontWeight: 800, fontSize: '1.05rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.25)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(16,185,129,0.15)'}>
                <Play size={22} /> Resume
              </button>
            )}

            {/* STOP */}
            {(isLive || isPaused) && (
              <button onClick={handleStop}
                style={{ flex: 1, padding: '1.1rem 2rem', borderRadius: '1rem', background: 'rgba(239,68,68,0.15)', border: '2px solid rgba(239,68,68,0.45)', color: '#ef4444', fontWeight: 800, fontSize: '1.05rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.25)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}>
                <Square size={20} fill="#ef4444" /> Stop Recording
              </button>
            )}

            {/* UPLOAD */}
            {isStopped && (
              <button onClick={handleUpload} className="btn-interactive"
                style={{ flex: 2, padding: '1.1rem 2rem', borderRadius: '1rem', fontWeight: 800, fontSize: '1.05rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                <Upload size={22} /> Upload &amp; Generate AI Notes
              </button>
            )}

            {/* UPLOADING SPINNER */}
            {isUploading && (
              <div style={{ flex: 2, padding: '1.1rem 2rem', borderRadius: '1rem', background: 'rgba(99,102,241,0.15)', border: '1.5px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: '1rem' }}>
                <div style={{ width: '22px', height: '22px', border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Uploading lecture…
              </div>
            )}

            {/* DONE — new recording button */}
            {isDone && (
              <button onClick={() => {
                setPhase('idle');
                setTitle('');
                finalTextRef.current = '';
                setDisplayText('');
                audioBlobRef.current = null;
                setAudioUrl('');
                setRecordingTime(0);
                setStatusMsg('');
              }}
                style={{ flex: 1, padding: '1.1rem 2rem', borderRadius: '1rem', background: 'rgba(16,185,129,0.15)', border: '2px solid rgba(16,185,129,0.4)', color: '#10b981', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                <Mic size={20} /> Record Another Lecture
              </button>
            )}
            </div>

            {/* Mic / Battery Status under Start Button */}
            {(isIdle || isLive || isPaused) && battery !== null && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: battery.level <= 20 ? '#ef4444' : battery.level <= 50 ? '#f59e0b' : '#10b981', padding: '0.4rem 0.85rem', background: battery.level <= 20 ? 'rgba(239,68,68,0.08)' : battery.level <= 50 ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)', borderRadius: '2rem', border: `1px solid ${battery.level <= 20 ? 'rgba(239,68,68,0.2)' : battery.level <= 50 ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}`, width: 'max-content', margin: '0 auto' }}>
                <Mic size={14} />
                <span>{micName}</span>
                <span style={{ opacity: 0.5 }}>|</span>
                <span>{battery.charging ? '⚡' : battery.level <= 20 ? '🪫' : '🔋'} {battery.level}%</span>
              </div>
            )}
          </div>

          {/* ─── AUDIO PREVIEW ─── */}
          {audioUrl && isStopped && (
            <div style={{ background: 'var(--studio-tip-bg)', border: '1px solid var(--studio-border)', borderRadius: '1rem', padding: '1.25rem 1.5rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--studio-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem' }}>
                🎧 Preview Recording
              </div>
              <audio src={audioUrl} controls style={{ width: '100%', borderRadius: '0.5rem', filter: 'invert(0.9) hue-rotate(180deg) brightness(0.9)' }} />
            </div>
          )}

          {/* ─── STATUS MSG ─── */}
          {statusMsg && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '1rem 1.25rem', borderRadius: '0.875rem', background: statusType === 'success' ? 'rgba(16,185,129,0.12)' : statusType === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.12)', border: `1px solid ${statusType === 'success' ? 'rgba(16,185,129,0.3)' : statusType === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.3)'}` }}>
              {statusType === 'success' ? <CheckCircle size={18} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                : statusType === 'error' ? <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                : <AlertCircle size={18} color="#a78bfa" style={{ flexShrink: 0, marginTop: '2px' }} />}
              <p style={{ margin: 0, fontSize: '0.92rem', color: statusType === 'success' ? '#10b981' : statusType === 'error' ? '#ef4444' : '#a78bfa', fontWeight: 600, lineHeight: '1.5' }}>
                {statusMsg}
              </p>
            </div>
          )}

          {/* ─── TIPS (idle) ─── */}
          {isIdle && (
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {[
                { icon: '🎙', text: 'Speak clearly — your words appear in real-time' },
                { icon: '⏸', text: 'Pause anytime and Resume when ready' },
                { icon: '✏️', text: 'Edit the transcript after stopping to fix mistakes' },
                { icon: '🤖', text: 'AI generates 5/10/20-point notes, 5 flashcards & 5 MCQs' },
              ].map((tip, i) => (
                <div key={i} style={{ flex: '1 1 200px', padding: '0.85rem 1rem', background: 'var(--studio-tip-bg)', border: '1px solid var(--studio-border)', borderRadius: '0.875rem', display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                  <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: '1px' }}>{tip.icon}</span>
                  <span style={{ fontSize: '0.83rem', color: 'var(--studio-text-muted)', lineHeight: '1.5' }}>{tip.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes recPulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.4; transform:scale(0.8); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: rgba(255,255,255,0.25); }
      `}</style>
    </div>
  );
};


/* ─────────────────────────────────────────────
   TEACHER CLASS DETAIL — main page
───────────────────────────────────────────── */
const TeacherClassDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lectures, setLectures] = useState([]);
  const [studentsData, setStudentsData] = useState({ totalLectures: 0, students: [] });
  const [showStudio, setShowStudio] = useState(false);
  const [classroom, setClassroom] = useState(null);
  
  // Phase 3: Analytics state
  const [interventionAlerts, setInterventionAlerts] = useState({});
  const [isGeneratingAlert, setIsGeneratingAlert] = useState({});

  const fetchLectures = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/lectures?classroom_id=${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLectures(res.data);
    } catch (err) { console.error(err); }
  }, [id]);

  const fetchStudents = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/classrooms/${id}/students`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (Array.isArray(res.data)) {
        setStudentsData({ totalLectures: 0, students: res.data });
      } else {
        setStudentsData(res.data);
      }
    } catch (err) { console.error(err); }
  }, [id]);

  const fetchClassroom = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/classrooms`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const found = res.data.find(c => String(c.id) === String(id));
      if (found) setClassroom(found);
    } catch (err) { console.error(err); }
  }, [id]);

  useEffect(() => {
    fetchLectures();
    fetchStudents();
    fetchClassroom();
  }, [fetchLectures, fetchStudents, fetchClassroom]);

  const handleDeleteLecture = async (e, lectureId) => {
    e.stopPropagation();
    if (!window.confirm('Delete this lecture? All AI-generated data will be removed.')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/lectures/${lectureId}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchLectures();
    } catch (err) { console.error(err); }
  };

  const handleRetryLecture = async (e, lectureId) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/lectures/${lectureId}/retry`, {}, { headers: { Authorization: `Bearer ${token}` } });
      fetchLectures(); // Show as 'processing' immediately
      // Poll until status changes
      const poll = setInterval(async () => {
        const res = await axios.get(`/api/lectures?classroom_id=${id}`, { headers: { Authorization: `Bearer ${token}` } });
        setLectures(res.data);
        const lec = res.data.find(l => l.lecture_id === lectureId);
        if (!lec || lec.status !== 'processing') clearInterval(poll);
      }, 4000);
      setTimeout(() => clearInterval(poll), 120000); // Stop polling after 2 mins
    } catch (err) { console.error(err); alert('Retry failed: ' + (err.response?.data?.error || err.message)); }
  };

  const handleGenerateAlert = async (stu, attendancePercent, avgScoreStr) => {
    setIsGeneratingAlert(prev => ({ ...prev, [stu.student_id]: true }));
    try {
      const token = localStorage.getItem('token');
      const payload = {
        studentName: stu.name,
        attendanceStr: `\${attendancePercent}% (\${stu.lectures_completed || 0}/\${studentsData.totalLectures})`,
        avgScoreStr: avgScoreStr
      };
      const res = await axios.post(`/api/classrooms/\${id}/students/\${stu.student_id}/alert`, payload, {
        headers: { Authorization: `Bearer \${token}` }
      });
      setInterventionAlerts(prev => ({ ...prev, [stu.student_id]: res.data.alertPlan }));
    } catch (err) {
      console.error(err);
      alert('Failed to generate intervention plan.');
    } finally {
      setIsGeneratingAlert(prev => ({ ...prev, [stu.student_id]: false }));
    }
  };

  const { students, totalLectures } = studentsData;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)', color: 'var(--text-color)' }}>
      {showStudio && (
        <RecordingStudio
          classroomId={id}
          onClose={() => setShowStudio(false)}
          onUploaded={() => { fetchLectures(); }}
        />
      )}

      <Navbar />

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem' }}>

        {/* ─── HEADER ─── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <button onClick={() => navigate('/teacher/dashboard')}
            style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '1rem' }}>
            <ArrowLeft size={18} /> Back to Dashboard
          </button>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => navigate(`/teacher/class/${id}/analytics`)}
              style={{ padding: '0.65rem 1.25rem', background: 'var(--card-bg)', color: 'var(--text-color)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary-color)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}>
              📊 Analytics
            </button>
          </div>
        </div>

        {/* ─── CLASSROOM HERO ─── */}
        <div className="card-interactive" style={{
          border: '1.5px solid var(--border-color)',
          borderRadius: '1.5rem',
          padding: '2.5rem',
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '2rem',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative BG */}
          <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '180px', height: '180px', borderRadius: '50%', background: 'var(--primary-color)', opacity: 0.1, pointerEvents: 'none' }} />

          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '0.4rem' }}>
              Teacher's Classroom
            </div>
            <h1 style={{ margin: '0 0 0.5rem', fontSize: '2rem', fontWeight: 800, color: 'var(--text-color)' }}>
              {classroom?.name || 'Classroom'}
            </h1>
            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                🔑 Join Code: <strong style={{ color: 'var(--primary-color)', letterSpacing: '2px' }}>{classroom?.join_code || '—'}</strong>
              </span>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Users size={14} /> {students.length} student{students.length !== 1 ? 's' : ''}
              </span>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <BookOpen size={14} /> {lectures.length} lecture{lectures.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* ── BIG RECORD BUTTON ── */}
          <button className="btn-interactive"
            onClick={() => setShowStudio(true)}
            style={{
              padding: '1.1rem 2.5rem',
              borderRadius: '1.25rem',
              fontWeight: 800,
              fontSize: '1.1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}>
            <Mic size={22} />
            🎙 Record Lecture
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem' }}>

          {/* ─── LECTURES LIST ─── */}
          <div className="auth-card" style={{ maxWidth: '100%', padding: '2rem' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', fontSize: '1.3rem' }}>
              <BookOpen size={20} color="var(--primary-color)" /> Lectures
              <span style={{ marginLeft: 'auto', fontSize: '0.8rem', fontWeight: 600, color: 'var(--secondary-color)', background: 'var(--bg-color)', padding: '0.2rem 0.65rem', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
                {lectures.length} total
              </span>
            </h2>

            {lectures.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--secondary-color)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🎙</div>
                <p style={{ fontWeight: 600, margin: '0 0 0.35rem' }}>No lectures yet</p>
                <p style={{ fontSize: '0.85rem', margin: 0 }}>Click <strong>Record Lecture</strong> above to get started</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {lectures.map(lec => (
                  <div key={lec.lecture_id}
                    onClick={() => navigate(`/teacher/lecture/${lec.lecture_id}`)}
                    style={{ padding: '1.25rem 1.5rem', background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '1rem', display: 'flex', flexDirection: lec.status === 'processing' ? 'column' : 'row', gap: lec.status === 'processing' ? '1rem' : '0', justifyContent: 'space-between', alignItems: lec.status === 'processing' ? 'stretch' : 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary-color)'; e.currentTarget.style.transform = 'translateX(4px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.transform = 'translateX(0)'; }}>
                    {lec.status === 'processing' ? (
                      <div style={{ width: '100%', padding: '0.5rem 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                          <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-color)' }}>{lec.title}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--primary-color)', background: 'var(--input-bg)', border: '1px solid var(--border-color)', padding: '0.3rem 0.8rem', borderRadius: '2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: '12px', height: '12px', border: '2px solid var(--primary-color)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                            AI is processing
                          </span>
                        </div>
                        
                        {/* 3 Indicators UI */}
                        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                          <div style={{ flex: 1, height: '6px', background: 'var(--success)', borderRadius: '4px', boxShadow: '0 0 8px rgba(16,185,129,0.4)' }} />
                          <div style={{ flex: 1, height: '6px', background: 'var(--primary-color)', borderRadius: '4px', animation: 'pulse 1.5s infinite', boxShadow: '0 0 8px var(--btn-shadow)' }} />
                          <div style={{ flex: 1, height: '6px', background: 'var(--input-bg)', borderRadius: '4px' }} />
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600 }}>
                          <span style={{ color: 'var(--success)' }}>✓ Audio Saved</span>
                          <span style={{ color: 'var(--primary-color)', animation: 'pulse 1.5s infinite' }}>⚙️ Generating Notes & Quiz...</span>
                          <span style={{ color: 'var(--text-muted)' }}>★ Ready</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--primary-color)' }}>{lec.title}</span>
                            {lec.status === 'failed' && <span style={{ fontSize: '0.68rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '0.2rem 0.6rem', borderRadius: '1rem', fontWeight: 700 }}>✗ Generation Failed</span>}
                            {lec.status === 'completed' && <span style={{ fontSize: '0.68rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '0.2rem 0.6rem', borderRadius: '1rem', fontWeight: 700 }}>✓ AI Finish Processing. Notes are ready.</span>}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--secondary-color)' }}>
                            {new Date(lec.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                        <div style={{ color: 'var(--secondary-color)' }}>
                           <ArrowLeft size={18} style={{ transform: 'rotate(180deg)' }} />
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-color)' }}>View →</span>
                      {lec.status !== 'processing' && (
                        <button onClick={e => handleRetryLecture(e, lec.lecture_id)}
                          title="Refresh AI Notes & Quiz"
                          style={{ background: 'var(--card-bg)', border: '1px solid var(--primary-color)', color: 'var(--primary-color)', padding: '0.35rem 0.6rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          🔄 Refresh AI
                        </button>
                      )}
                      <button onClick={e => handleDeleteLecture(e, lec.lecture_id)}
                        title="Delete" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444', padding: '0.35rem 0.5rem', borderRadius: '0.5rem', cursor: 'pointer', lineHeight: 1 }}>
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─── STUDENTS SIDEBAR ─── */}
          <div className="auth-card" style={{ maxWidth: '100%', padding: '1.75rem', height: 'fit-content', position: 'sticky', top: '80px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', fontSize: '1.05rem' }}>
              <Users size={17} /> Students
              <span style={{ marginLeft: 'auto', background: 'var(--bg-color)', padding: '0.2rem 0.6rem', borderRadius: '1rem', fontSize: '0.78rem', fontWeight: 700, border: '1px solid var(--border-color)' }}>{students.length}</span>
            </h3>
            {students.length === 0 ? (
              <p style={{ color: 'var(--secondary-color)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0', lineHeight: '1.6' }}>
                No students yet.<br />Share the join code <strong style={{ color: 'var(--primary-color)', letterSpacing: '1px' }}>{classroom?.join_code}</strong> with students.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {students.map(stu => {
                  const attendancePercent = totalLectures === 0 ? 0 : Math.round(((stu.lectures_completed || 0) / totalLectures) * 100);
                  const avgScoreNum = stu.average_score || 0;
                  const isStruggling = avgScoreNum < 3.5 || attendancePercent < 50;
                  const avgScoreStr = stu.average_score ? stu.average_score.toFixed(1) : '0';

                  return (
                    <div key={stu.student_id} style={{ padding: '1rem', background: 'var(--bg-color)', borderRadius: '0.75rem', border: `1px solid ${isStruggling ? 'rgba(239,68,68,0.3)' : 'var(--border-color)'}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <img src={stu.profile_picture ? (stu.profile_picture.startsWith('http') ? stu.profile_picture : `http://localhost:5000${stu.profile_picture}`) : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(stu.name)}`} alt={stu.name} style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                        <div style={{ fontWeight: 600, fontSize: '0.95rem', color: isStruggling ? '#ef4444' : 'var(--text-color)' }}>{stu.name}</div>
                        {isStruggling && <AlertCircle size={14} color="#ef4444" style={{ marginLeft: 'auto' }} title="Struggling Student" />}
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 600, paddingLeft: '36px', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ color: 'var(--secondary-color)', fontSize: '0.65rem', textTransform: 'uppercase' }}>Attendance</span>
                          <span style={{ color: attendancePercent < 50 ? '#ef4444' : 'var(--text-color)' }}>{attendancePercent}% ({stu.lectures_completed || 0}/{totalLectures})</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ color: 'var(--secondary-color)', fontSize: '0.65rem', textTransform: 'uppercase' }}>Avg Score</span>
                          <span style={{ color: avgScoreNum >= 4 ? '#10b981' : avgScoreNum >= 3 ? '#f59e0b' : '#ef4444' }}>{avgScoreStr}/5</span>
                        </div>
                      </div>

                      {isStruggling && (
                        <div style={{ paddingLeft: '36px', marginTop: '0.75rem' }}>
                          {!interventionAlerts[stu.student_id] && !isGeneratingAlert[stu.student_id] && (
                             <button 
                               onClick={() => handleGenerateAlert(stu, attendancePercent, avgScoreStr)}
                               style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', padding: '0.4rem 0.8rem', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', width: '100%' }}>
                               🤖 Generate AI Intervention Plan
                             </button>
                          )}
                          
                          {isGeneratingAlert[stu.student_id] && (
                            <div style={{ color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ width: '10px', height: '10px', border: '2px solid var(--primary-color)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                              Analyzing Student Data...
                            </div>
                          )}

                          {interventionAlerts[stu.student_id] && (
                            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.75rem', color: 'var(--text-color)', lineHeight: '1.5', marginTop: '0.5rem' }}>
                              <strong style={{ color: 'var(--primary-color)', display: 'block', marginBottom: '0.25rem' }}>AI Suggestion:</strong>
                              {interventionAlerts[stu.student_id]}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
      `}</style>
    </div>
  );
};

export default TeacherClassDetail;
