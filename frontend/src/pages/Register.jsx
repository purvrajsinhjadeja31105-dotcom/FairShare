import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock, Eye, EyeOff, Loader, CheckCircle } from 'lucide-react';
import { apiCall } from '../api';

const Register = () => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters long');
            return;
        }

        setLoading(true);
        try {
            const data = await apiCall('/auth/register', 'POST', { username, email, password });
            setIsSuccess(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="flex-center" style={{ padding: '2rem' }}>
                <div className="glass-card" style={{ maxWidth: '500px', width: '100%', textAlign: 'center' }}>
                    <div style={{ 
                        width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: 'var(--success)' 
                    }}>
                        <CheckCircle size={48} />
                    </div>
                    <h2 className="text-gradient" style={{ fontSize: '2rem', marginBottom: '1rem' }}>Check Your Email</h2>
                    <p style={{ fontSize: '1.1rem', marginBottom: '2rem' }}>
                        We've sent a verification link to <strong>{email}</strong>. Please click the link in the email to activate your account.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <Link to="/login">
                            <button className="btn-primary" style={{ width: '100%' }}>Go to Login</button>
                        </Link>
                        <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                            Didn't receive the email? <span style={{ color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: '600' }} onClick={() => setIsSuccess(false)}>Try again</span>
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-center" style={{ padding: '2rem' }}>
            <div className="glass-card" style={{ maxWidth: '450px', width: '100%' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <h2 className="text-gradient" style={{ fontSize: '2.25rem', marginBottom: '0.5rem' }}>Create Account</h2>
                    <p>Start managing expenses with ease</p>
                </div>

                {error && (
                    <div style={{ 
                        background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', 
                        padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', color: 'var(--danger)',
                        fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}>
                        <span>⚠️ {error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ position: 'relative' }}>
                        <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input
                            type="text" placeholder="Username" className="input-field"
                            style={{ paddingLeft: '3rem', marginBottom: 0 }}
                            value={username} onChange={e => setUsername(e.target.value)} required
                        />
                    </div>

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

                    <div style={{ position: 'relative' }}>
                        <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input
                            type="password" 
                            placeholder="Confirm Password" 
                            className="input-field"
                            style={{ paddingLeft: '3rem', marginBottom: 0 }}
                            value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
                        />
                    </div>

                    <button 
                        type="submit" 
                        className="btn-primary" 
                        disabled={loading}
                        style={{ width: '100%', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    >
                        {loading ? <Loader size={20} className="spinner" /> : 'Register & Get Started'}
                    </button>
                </form>

                <div style={{ marginTop: '2rem', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                    <p style={{ fontSize: '0.95rem' }}>
                        Already have an account?{' '}
                        <Link to="/login" className="text-gradient" style={{ textDecoration: 'none', fontWeight: 'bold' }}>
                            Sign In
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Register;
