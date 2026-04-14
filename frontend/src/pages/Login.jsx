import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Loader, LogIn, AlertTriangle } from 'lucide-react';
import { apiCall } from '../api';

const Login = ({ setIsAuthenticated }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [unverified, setUnverified] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setUnverified(false);

        try {
            const data = await apiCall('/auth/login', 'POST', { email, password });
            localStorage.setItem('splitwise_token', data.token);
            localStorage.setItem('splitwise_user', JSON.stringify(data.user));
            setIsAuthenticated(true);
            window.dispatchEvent(new Event('auth_change'));
            navigate('/dashboard');
        } catch (err) {
            setError(err.message);
            if (err.status === 403) {
                setUnverified(true);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-center" style={{ padding: '2rem' }}>
            <div className="glass-card" style={{ maxWidth: '400px', width: '100%' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ 
                        width: '60px', height: '60px', borderRadius: '16px', background: 'rgba(99, 102, 241, 0.1)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: 'var(--accent-primary)' 
                    }}>
                        <LogIn size={32} />
                    </div>
                    <h2 className="text-gradient" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Welcome Back</h2>
                    <p>Log in to manage your shared expenses</p>
                </div>

                {error && (
                    <div style={{ 
                        background: unverified ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                        border: `1px solid ${unverified ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`, 
                        padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', 
                        color: unverified ? '#f59e0b' : 'var(--danger)',
                        fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}>
                        {unverified ? <AlertTriangle size={18} /> : <span>⚠️</span>}
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ position: 'relative' }}>
                        <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input
                            type="email" placeholder="Email Address" className="input-field" 
                            style={{ paddingLeft: '3rem', marginBottom: 0 }}
                            value={email} onChange={e => setEmail(e.target.value)} required 
                        />
                    </div>

                    <div style={{ position: 'relative' }}>
                        <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input
                            type={showPassword ? "text" : "password"} 
                            placeholder="Password" 
                            className="input-field" 
                            style={{ paddingLeft: '3rem', paddingRight: '3rem', marginBottom: 0 }}
                            value={password} onChange={e => setPassword(e.target.value)} required 
                        />
                        <button 
                            type="button" 
                            onClick={() => setShowPassword(!showPassword)}
                            style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>

                    <div style={{ textAlign: 'right', marginTop: '-0.5rem' }}>
                        <Link to="/forgot-password" style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: '600' }}>
                            Forgot Password?
                        </Link>
                    </div>

                    <button 
                        type="submit" 
                        className="btn-primary" 
                        disabled={loading}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    >
                        {loading ? <Loader size={20} className="spinner" /> : 'Sign In'}
                    </button>
                </form>

                <div style={{ marginTop: '2.5rem', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                    <p style={{ fontSize: '0.95rem' }}>
                        New to SplitWise?{' '}
                        <Link to="/register" className="text-gradient" style={{ textDecoration: 'none', fontWeight: 'bold' }}>
                            Create Account
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
