import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';
import Profile from './pages/Profile';
import ProfileSetup from './pages/ProfileSetup';
import ThemeToggle from './components/ThemeToggle';

// Teacher Components
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import TeacherClassDetail from './pages/teacher/TeacherClassDetail';
import TeacherLectureDetail from './pages/teacher/TeacherLectureDetail';
import TeacherAnalytics from './pages/teacher/TeacherAnalytics';

// Student Components
import StudentDashboard from './pages/student/StudentDashboard';
import StudentClassDetail from './pages/student/StudentClassDetail';
import StudyLecture from './pages/student/StudyLecture';
import StudentAnalytics from './pages/student/StudentAnalytics';

// Guest Wrapper - Prevent logged-in users from seeing Auth pages
const GuestRoute = ({ children }) => {
  const user = JSON.parse(localStorage.getItem('user'));
  if (user) return <Navigate to={`/${user.role}/dashboard`} replace />;
  return children;
};

// Role-based Layout Wrapper
const RoleProtectedRoute = ({ allowedRole, children }) => {
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== allowedRole) {
    return <Navigate to={`/${user.role}/dashboard`} replace />;
  }
  return children;
};

// Root Redirect Component
const RootRedirect = () => {
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={`/${user.role}/dashboard`} replace />;
};

function App() {
  return (
    <Router>
      <ThemeToggle />
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<GuestRoute><Auth initialMode="login" /></GuestRoute>} />
        <Route path="/signup" element={<GuestRoute><Auth initialMode="signup" /></GuestRoute>} />
        
        {/* Profile Routes - Accessible to both */}
        <Route path="/profile" element={
          localStorage.getItem('user') ? <Profile /> : <Navigate to="/login" replace />
        } />
        <Route path="/profile/setup" element={
          localStorage.getItem('user') ? <ProfileSetup /> : <Navigate to="/login" replace />
        } />
        
        {/* Teacher Routes */}
        <Route path="/teacher/dashboard" element={<RoleProtectedRoute allowedRole="teacher"><TeacherDashboard /></RoleProtectedRoute>} />
        <Route path="/teacher/class/:id" element={<RoleProtectedRoute allowedRole="teacher"><TeacherClassDetail /></RoleProtectedRoute>} />
        <Route path="/teacher/class/:classId/analytics" element={<RoleProtectedRoute allowedRole="teacher"><TeacherAnalytics /></RoleProtectedRoute>} />
        <Route path="/teacher/lecture/:id" element={<RoleProtectedRoute allowedRole="teacher"><TeacherLectureDetail /></RoleProtectedRoute>} />
        
        {/* Student Routes */}
        <Route path="/student/dashboard" element={<RoleProtectedRoute allowedRole="student"><StudentDashboard /></RoleProtectedRoute>} />
        <Route path="/student/analytics" element={<RoleProtectedRoute allowedRole="student"><StudentAnalytics /></RoleProtectedRoute>} />
        <Route path="/student/class/:id" element={<RoleProtectedRoute allowedRole="student"><StudentClassDetail /></RoleProtectedRoute>} />
        <Route path="/student/lecture/:id" element={<RoleProtectedRoute allowedRole="student"><StudyLecture /></RoleProtectedRoute>} />
        
        {/* Fallbacks */}
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </Router>
  );
}

export default App;
