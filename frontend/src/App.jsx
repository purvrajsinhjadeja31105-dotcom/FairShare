import React, { useState, useEffect, useContext, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Sun, Moon, Bell, Menu, LogOut } from 'lucide-react';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import GroupView from './pages/GroupView';
import AddExpense from './pages/AddExpense';
import CreateGroup from './pages/CreateGroup';
import OwedSummary from './pages/OwedSummary';
import PersonalHistory from './pages/PersonalHistory';
import DebtDetail from './pages/DebtDetail';
import { ThemeContext } from './context/ThemeContext';
import { apiCall } from './api';
import { useSocket } from './context/SocketContext';
import './index.css';

// Redirect to dashboard if already logged in (for login/register pages)
const AuthRoute = ({ children }) => {
  const token = localStorage.getItem('splitwise_token');
  return token ? <Navigate to="/dashboard" /> : children;
};

// Redirect to login if not logged in (for protected pages)
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('splitwise_token');
  return token ? children : <Navigate to="/login" />;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('splitwise_token'));
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const socket = useSocket();
  const menuRef = useRef(null);

  useEffect(() => {
    const handleStorageChange = () => setIsAuthenticated(!!localStorage.getItem('splitwise_token'));
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      let isMounted = true;
      apiCall('/notifications').then(res => {
        if (!isMounted) return;
        const unread = res.notifications.filter(n => !n.is_read).length;
        setUnreadNotifs(unread);
      }).catch(console.error);
      return () => { isMounted = false; };
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (socket) {
      socket.on('update_notifications', () => {
        apiCall('/notifications').then(res => {
          const unread = res.notifications.filter(n => !n.is_read).length;
          setUnreadNotifs(unread);
        }).catch(console.error);
      });
      return () => socket.off('update_notifications');
    }
  }, [socket]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('splitwise_token');
    localStorage.removeItem('splitwise_user');
    setIsAuthenticated(false);
    window.location.href = '/';
  };

  return (
    <Router>
      <nav className="navbar">
        <Link to={isAuthenticated ? '/dashboard' : '/'} style={{ textDecoration: 'none' }}>
          <h2 className="text-gradient" style={{ margin: 0 }}>SplitWise</h2>
        </Link>
        <div ref={menuRef} style={{ position: 'relative' }}>
          {isAuthenticated && (
            <button
              className="btn-ghost icon-btn"
              onClick={() => setMenuOpen(prev => !prev)}
              aria-label="Open menu"
            >
              <Menu size={24} />
            </button>
          )}

          {isAuthenticated && menuOpen && (
            <div className="action-menu">
              <Link to="/notifications" className="action-menu-item" onClick={() => setMenuOpen(false)}>
                <Bell size={18} />
                <span>Notifications</span>
                {unreadNotifs > 0 && (
                  <span className="menu-badge">{unreadNotifs}</span>
                )}
              </Link>

              <button className="action-menu-item" onClick={() => { toggleTheme(); setMenuOpen(false); }}>
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                <span>Toggle theme</span>
              </button>

              <button className="action-menu-item" onClick={handleLogout}>
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            </div>
          )}

          {!isAuthenticated && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button 
                className="btn-ghost icon-btn" 
                onClick={toggleTheme} 
                aria-label="Toggle theme"
              >
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
              </button>
              <Link to="/login" style={{ textDecoration: 'none' }}><button className="btn-ghost">Login</button></Link>
              <Link to="/register" style={{ textDecoration: 'none' }}><button className="btn-primary">Sign Up</button></Link>
            </div>
          )}
        </div>
      </nav>

      <div className="app-container">
        <Routes>
          {/* Public landing — if already logged in, go to dashboard */}
          <Route
            path="/"
            element={isAuthenticated ? <Navigate to="/dashboard" /> : <Landing />}
          />

          {/* Auth pages — redirect to dashboard if already logged in */}
          <Route path="/login" element={<AuthRoute><Login setIsAuthenticated={setIsAuthenticated} /></AuthRoute>} />
          <Route path="/register" element={<AuthRoute><Register setIsAuthenticated={setIsAuthenticated} /></AuthRoute>} />
          <Route path="/forgot-password" element={<AuthRoute><ForgotPassword /></AuthRoute>} />
          <Route path="/reset-password" element={<AuthRoute><ResetPassword /></AuthRoute>} />

          {/* Protected pages */}
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/group/:id" element={<PrivateRoute><GroupView /></PrivateRoute>} />
          <Route path="/group/:id/add-expense" element={<PrivateRoute><AddExpense /></PrivateRoute>} />
          <Route path="/group/:id/edit-expense/:expenseId" element={<PrivateRoute><AddExpense /></PrivateRoute>} />
          <Route path="/create-group" element={<PrivateRoute><CreateGroup /></PrivateRoute>} />
          <Route path="/owed-by-others" element={<PrivateRoute><OwedSummary /></PrivateRoute>} />
          <Route path="/you-owe" element={<PrivateRoute><OwedSummary /></PrivateRoute>} />
          <Route path="/personal-history" element={<PrivateRoute><PersonalHistory /></PrivateRoute>} />
          <Route path="/group/:groupId/debt/:userId" element={<PrivateRoute><DebtDetail /></PrivateRoute>} />
          <Route path="/notifications" element={<PrivateRoute><NotificationsPage setUnreadNotifs={setUnreadNotifs} /></PrivateRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

const NotificationsPage = ({ setUnreadNotifs }) => {
  const [notifs, setNotifs] = useState([]);

  useEffect(() => {
    apiCall('/notifications').then(res => {
      setNotifs(res.notifications);
      apiCall('/notifications/read', 'POST').catch(console.error);
      setUnreadNotifs(0);
    }).catch(console.error);
  }, []);

  return (
    <div className="glass-card" style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2>Notifications</h2>
      {notifs.length === 0 ? <p>No notifications yet!</p> : (
        <ul>
          {notifs.map(n => (
            <li key={n.id} style={{
              opacity: n.is_read ? 0.7 : 1,
              borderLeft: n.is_read ? 'none' : '4px solid var(--accent-primary)',
              paddingLeft: '0.75rem',
              marginBottom: '0.75rem'
            }}>
              <p style={{ color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>{n.message}</p>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {new Date(n.created_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default App;
