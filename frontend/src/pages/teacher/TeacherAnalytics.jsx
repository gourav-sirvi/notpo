import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, AlertTriangle, Users, BarChart2, Star } from 'lucide-react';
import Navbar from '../../components/Navbar';

// --- Helpers ---
const getPerf = (score) => {
  if (score == null || isNaN(score)) return { label: 'N/A',      color: '#9ca3af', bg: 'rgba(156,163,175,0.12)', emoji: '⬜' };
  if (score >= 80)  return { label: 'Excellent', color: '#10b981', bg: 'rgba(16,185,129,0.12)',  emoji: '🟢' };
  if (score >= 60)  return { label: 'Good',       color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  emoji: '🔵' };
  if (score >= 40)  return { label: 'Average',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  emoji: '🟡' };
  return              { label: 'At Risk',          color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   emoji: '🔴' };
};

const Bar = ({ value = 0, max = 100, color }) => (
  <div style={{ height: '10px', borderRadius: '99px', background: 'var(--border-color)', overflow: 'hidden', flex: 1 }}>
    <div style={{ height: '100%', width: `${Math.min(100, value)}%`, background: color, borderRadius: '99px', transition: 'width 0.8s cubic-bezier(0.25,1,0.5,1)' }} />
  </div>
);

const TeacherAnalytics = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    axios.get(`\/api/analytics/teacher/${classId}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      setStats(res.data);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [classId]);

  if (loading) return <div style={{ minHeight: '100vh', background: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  if (!stats) return null;

  const { students = [], engagement = [], quiz_performance = [], feedback = [] } = stats;

  // Compute overall score for each student (mix of completion % + quiz avg)
  const studentsWithScore = students.map(s => {
    const completionPct = s.total_lectures > 0 ? Math.round((s.completed_lectures / s.total_lectures) * 100) : 0;
    const quizPct = s.avg_score_pct ?? null;
    const overall = quizPct != null ? Math.round((completionPct + quizPct) / 2) : completionPct;
    return { ...s, completionPct, quizPct, overall };
  }).sort((a, b) => b.overall - a.overall);

  const atRisk = studentsWithScore.filter(s => s.overall < 40);
  const topStudents = studentsWithScore.slice(0, 3);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)', color: 'var(--text-color)' }}>
      <Navbar />
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, marginBottom: '2rem' }}>
          <ArrowLeft size={18} /> Back to Class
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.25rem' }}>📊 Class Analytics</h1>
            <p style={{ color: 'var(--secondary-color)' }}>Track student engagement, quiz performance, and lecture feedback at a glance.</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {[
              { icon: <Users size={20}/>, label: 'Students', val: students.length, color: '#3b82f6' },
              { icon: <BarChart2 size={20}/>, label: 'Lectures', val: engagement.length, color: '#10b981' },
              { icon: <AlertTriangle size={20}/>, label: 'At Risk', val: atRisk.length, color: '#ef4444' },
            ].map((s, i) => (
              <div key={i} className="auth-card" style={{ maxWidth: '100%', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '140px' }}>
                <div style={{ color: s.color }}>{s.icon}</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.5rem', color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--secondary-color)' }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AT-RISK ALERT BANNER */}
        {atRisk.length > 0 && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '1rem', padding: '1.25rem 1.5rem', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <AlertTriangle size={22} color="#ef4444" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <h3 style={{ color: '#ef4444', margin: '0 0 0.4rem', fontSize: '1rem' }}>⚠️ {atRisk.length} Student{atRisk.length > 1 ? 's' : ''} At Risk</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {atRisk.map(s => (
                  <span key={s.id} onClick={() => setSelectedStudent(s)} style={{ padding: '0.25rem 0.75rem', background: 'rgba(239,68,68,0.15)', color: '#ef4444', borderRadius: '2rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(239,68,68,0.3)' }}>
                    🔴 {s.name} ({s.overall}%)
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STUDENT LIST TABLE */}
        <div className="auth-card" style={{ maxWidth: '100%', padding: '2rem', marginBottom: '2rem', overflowX: 'auto' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '1.4rem' }}>
            <Users size={22} color="var(--primary-color)" /> Student Performance
          </h2>

          {studentsWithScore.length === 0 ? (
            <p style={{ color: 'var(--secondary-color)', textAlign: 'center' }}>No students enrolled yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                  {['Student', 'Lectures Done', 'Lecture %', 'Quiz Avg', 'Status', ''].map((h, i) => (
                    <th key={i} style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--secondary-color)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {studentsWithScore.map(s => {
                  const p = getPerf(s.overall);
                  return (
                    <tr
                      key={s.id}
                      onClick={() => setSelectedStudent(selectedStudent?.id === s.id ? null : s)}
                      style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer', background: selectedStudent?.id === s.id ? 'var(--input-bg)' : 'transparent', transition: 'background 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--input-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = selectedStudent?.id === s.id ? 'var(--input-bg)' : 'transparent'}
                    >
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 600 }}>{s.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--secondary-color)' }}>{s.institution || s.email}</div>
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{s.completed_lectures} / {s.total_lectures}</td>
                      <td style={{ padding: '1rem', minWidth: '130px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Bar value={s.completionPct} color={getPerf(s.completionPct).color} />
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, width: '36px', color: getPerf(s.completionPct).color }}>{s.completionPct}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 700, color: s.quizPct != null ? getPerf(s.quizPct).color : 'var(--secondary-color)' }}>
                        {s.quizPct != null ? `${s.quizPct}%` : '—'}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ padding: '0.3rem 0.8rem', borderRadius: '2rem', background: p.bg, color: p.color, fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {p.emoji} {p.label}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--secondary-color)', fontWeight: 600 }}>
                        {selectedStudent?.id === s.id ? '▲ Hide' : '▼ Details'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Expanded Student Detail */}
          {selectedStudent && (
            <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: 'var(--bg-color)', borderRadius: '1rem', border: `1px solid ${getPerf(selectedStudent.overall).color}`, animation: 'fadeIn 0.3s' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>📋 {selectedStudent.name} — Performance Card</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                {[
                  { label: 'Lecture Completion', val: selectedStudent.completionPct, suffix:'%' },
                  { label: 'Quiz Average',        val: selectedStudent.quizPct,       suffix:'%' },
                  { label: 'Quizzes Taken',        val: selectedStudent.quizzes_taken, suffix: '' },
                  { label: 'Overall Score',        val: selectedStudent.overall,       suffix:'%' },
                ].map((item, i) => {
                  const p = getPerf(item.val);
                  return (
                    <div key={i} style={{ padding: '1rem', background: p.bg, borderRadius: '0.75rem', border: `1px solid ${p.color}30` }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--secondary-color)', marginBottom: '0.25rem' }}>{item.label}</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: p.color }}>{item.val != null ? `${item.val}${item.suffix}` : '—'}</div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: p.color }}>{p.emoji} {p.label}</div>
                    </div>
                  );
                })}
              </div>
              {selectedStudent.overall < 40 && (
                <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.08)', borderRadius: '0.75rem', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: '0.9rem' }}>
                  ⚠️ <strong>At Risk:</strong> {selectedStudent.name} has low completion and quiz performance. Consider following up directly.
                </div>
              )}
            </div>
          )}
        </div>

        {/* LECTURE ENGAGEMENT TABLE */}
        {engagement.length > 0 && (
          <div className="auth-card" style={{ maxWidth: '100%', padding: '2rem', marginBottom: '2rem' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '1.4rem' }}>
              <BarChart2 size={22} color="var(--primary-color)" /> Lecture Engagement
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {engagement.map((lec, i) => {
                const quizLec = quiz_performance.find(q => q.title === lec.title);
                const feedbackLec = feedback.find(f => f.title === lec.title);
                const quizAvg = quizLec?.avg_score != null ? Math.round(quizLec.avg_score * 10) : null;
                const rating = feedbackLec?.avg_rating;
                const completionPct = lec.total_engagement > 0 ? Math.round((lec.completions / lec.total_engagement) * 100) : 0;
                return (
                  <div key={i} style={{ padding: '1rem 1.25rem', background: 'var(--input-bg)', borderRadius: '0.75rem', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 700 }}>{lec.title}</span>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {rating != null && (
                          <span style={{ padding: '0.2rem 0.75rem', borderRadius: '2rem', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontSize: '0.78rem', fontWeight: 700 }}>
                            ⭐ {rating.toFixed(1)}/5
                          </span>
                        )}
                        {quizAvg != null && (
                          <span style={{ padding: '0.2rem 0.75rem', borderRadius: '2rem', background: getPerf(quizAvg).bg, color: getPerf(quizAvg).color, fontSize: '0.78rem', fontWeight: 700 }}>
                            Quiz Avg: {quizAvg}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.82rem', color: 'var(--secondary-color)' }}>
                      <span style={{ whiteSpace: 'nowrap' }}>{lec.completions} completed</span>
                      <Bar value={completionPct} color={getPerf(completionPct).color} />
                      <span style={{ color: getPerf(completionPct).color, fontWeight: 700, whiteSpace: 'nowrap' }}>{completionPct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherAnalytics;
