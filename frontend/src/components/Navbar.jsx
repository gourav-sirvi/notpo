import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, User, LogOut, Mic } from 'lucide-react';

const Navbar = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState('');
  const [profilePicture, setProfilePicture] = useState('');
  const [battery, setBattery] = useState(null);

  useEffect(() => {
    const handleStorageChange = () => {
      const user = JSON.parse(localStorage.getItem('user'));
      if (user) {
        setRole(user.role);
        setProfilePicture(user.profile_picture || '');
      }
    };
    handleStorageChange();
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1rem 2rem',
      background: 'var(--card-bg)',
      backdropFilter: 'blur(16px)',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      borderBottom: '1px solid var(--border-color)'
    }}>
      <div 
        onClick={() => navigate('/')} 
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
      >
        <div style={{ background: 'var(--primary-color)', borderRadius: '8px', padding: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <Mic size={20} color="#fff" />
        </div>
        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary-color)' }}>
          NoteMic Pro
        </span>
        {role && (
          <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '1rem', background: 'var(--primary-color)', color: '#fff', textTransform: 'uppercase', fontWeight: 600}}>
            {role}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button 
          onClick={() => navigate('/')}
          className="nav-link"
          style={{ background: 'none', border: 'none', color: 'var(--secondary-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, padding: '0.6rem 1rem', borderRadius: '0.75rem', transition: 'all 0.3s ease' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-color)'; e.currentTarget.style.color = 'var(--primary-color)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--secondary-color)'; }}
        >
          <Home size={18} /> Home
        </button>
        <button 
          onClick={() => navigate('/profile')}
          className="nav-link"
          style={{ background: 'none', border: 'none', color: 'var(--secondary-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, padding: '0.6rem 1rem', borderRadius: '0.75rem', transition: 'all 0.3s ease' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-color)'; e.currentTarget.style.color = 'var(--primary-color)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--secondary-color)'; }}
        >
          {profilePicture ? (
            <img 
              src={profilePicture.startsWith('http') ? profilePicture : `http://localhost:5000${profilePicture}`}
              alt="Profile"
              style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
            />
          ) : (
            <User size={18} />
          )}
          Account
        </button>
        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', margin: '0 0.5rem' }}></div>
        <button 
          onClick={handleLogout}
          style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, padding: '0.6rem 1rem', borderRadius: '0.75rem', transition: 'all 0.3s ease' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <LogOut size={18} /> Exit
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
