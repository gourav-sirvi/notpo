import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, TrendingUp, BookOpen, Bookmark, Award } from 'lucide-react';
import Navbar from '../../components/Navbar';

// Traffic-light helpers
const getPerf = (score) => {
  if (score == null || isNaN(score)) return { label: 'N/A', color: '#9ca3af', bg: 'rgba(156,163,175,0.1)', emoji: '⬜' };
  if (score >= 80) return { label: 'Excellent', color: '#10b981', bg: 'rgba(16,185,129,0.1)', emoji: '🟢' };
  if (score >= 60) return { label: 'Good',      color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  emoji: '🔵' };
  if (score >= 40) return { label: 'Average',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  emoji: '🟡' };
  return           { label: 'At Risk',          color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   emoji: '🔴' };
};

const ProgressBar = ({ value, max }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const { color } = getPerf(pct);
  return (
    <div style={{ marginTop: '0.4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--secondary-color)' }}>
        <span>{value} / {max} completed</span>
        <span style={{ fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ height: '8px', borderRadius: '99px', background: 'var(--border-color)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '99px', transition: 'width 0.8s cubic-bezier(0.25,1,0.5,1)' }} />
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, color }) => (
  <div className="auth-card" style={{ maxWidth: '100%', padding: '1.5rem', textAlign: 'center' }}>
    <div style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>{icon}</div>
    <div style={{ fontSize: '2rem', fontWeight: 800, color: color || 'var(--primary-color)' }}>{value ?? '—'}</div>
    <div style={{ fontSize: '0.85rem', color: 'var(--secondary-color)', fontWeight: 500 }}>{label}</div>
  </div>
);

const StudentAnalytics = () => {
  const [stats, setStats] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    axios.get('/api/analytics/student', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => setStats(res.data)).catch(console.error);
  }, []);

  if (!stats) return <div style={{ minHeight: '100vh', background: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;

  const { progress, quizzes, bookmarks, classroom_performance = [] } = stats;
  const completionPct = progress?.total_lectures > 0
    ? Math.round((progress.completed_lectures / progress.total_lectures) * 100)
    : 0;
  const avgScore = quizzes?.avg_score
    ? Math.round(quizzes.avg_score * 10)
    : null;
  const perfColor = getPerf(avgScore).color;
  const perfLabel = getPerf(avgScore);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)', color: 'var(--text-color)' }}>
      <Navbar />
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, marginBottom: '2rem' }}>
          <ArrowLeft size={18} /> Back
        </button>

        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.4rem' }}>📊 My Learning Analytics</h1>
        <p style={{ color: 'var(--secondary-color)', marginBottom: '2rem' }}>Track your study progress and performance at a glance.</p>

        {/* Overall Status Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.25rem', borderRadius: '2rem', background: perfLabel.bg, border: `1px solid ${perfLabel.color}`, color: perfLabel.color, fontWeight: 700, fontSize: '0.95rem', marginBottom: '2rem' }}>
          {perfLabel.emoji} Overall: {perfLabel.label} {avgScore != null ? `(${avgScore}%)` : ''}
        </div>

        {/* Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
          <StatCard icon="📚" label="Lectures Completed" value={`${progress?.completed_lectures || 0} / ${progress?.total_lectures || 0}`} color={getPerf(completionPct).color} />
          <StatCard icon="🧠" label="Quizzes Taken" value={quizzes?.quizzes_taken || 0} />
          <StatCard icon="⭐" label="Quiz Average" value={avgScore != null ? `${avgScore}%` : '—'} color={perfColor} />
          <StatCard icon="🔖" label="Bookmarks" value={bookmarks || 0} color="#a78bfa" />
        </div>

        {/* Completion Progress Bar */}
        <div className="auth-card" style={{ maxWidth: '100%', padding: '2rem', marginBottom: '2rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}><BookOpen size={20} color="var(--primary-color)" /> Lecture Completion</h3>
          <ProgressBar value={progress?.completed_lectures || 0} max={progress?.total_lectures || 1} />
        </div>

        {/* Per-Classroom Performance */}
        {classroom_performance.length > 0 && (
          <div className="auth-card" style={{ maxWidth: '100%', padding: '2rem', marginBottom: '2rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}><TrendingUp size={20} color="var(--primary-color)" /> Progress by Classroom</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {classroom_performance.map((cls, i) => {
                const pct = cls.total_lectures > 0 ? Math.round((cls.completed / cls.total_lectures) * 100) : 0;
                const p = getPerf(pct);
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 600 }}>{cls.classroom_name}</span>
                      <span style={{ fontSize: '0.85rem', padding: '0.2rem 0.75rem', borderRadius: '2rem', background: p.bg, color: p.color, fontWeight: 700 }}>{p.emoji} {p.label}</span>
                    </div>
                    <ProgressBar value={cls.completed} max={cls.total_lectures} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quiz Score Bars */}
        {quizzes?.quizzes_taken > 0 && (
          <div className="auth-card" style={{ maxWidth: '100%', padding: '2rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}><Award size={20} color="var(--primary-color)" /> Quiz Performance</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {['Average Score', 'Completion Rate'].map((label, i) => {
                const val = i === 0 ? avgScore : completionPct;
                const p = getPerf(val);
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ width: '140px', fontSize: '0.9rem', color: 'var(--secondary-color)', flexShrink: 0 }}>{label}</span>
                    <div style={{ flex: 1, height: '20px', background: 'var(--border-color)', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${val || 0}%`, background: p.color, borderRadius: '99px', transition: 'width 0.8s ease', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '8px' }}>
                        <span style={{ color: 'white', fontSize: '0.75rem', fontWeight: 700 }}>{val}%</span>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: p.color, fontWeight: 700, width: '70px' }}>{p.emoji} {p.label}</span>
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

export default StudentAnalytics;
