import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, MailCheck } from 'lucide-react';
import { api } from '../../api';
import { useAuth, pendingInvite, sessionEnded } from '../../auth/AuthContext';
import { ErrorNotice } from '../../components/ui';

const AuthLayout = ({ title, subtitle, children, footer }) => (
    <main className="page page-narrow">
        <section className="card auth-card">
            <div className="stack" style={{ gap: '0.3rem', textAlign: 'center' }}>
                <h1>{title}</h1>
                {subtitle && <p className="muted small">{subtitle}</p>}
            </div>
            {children}
        </section>
        {footer && <p className="small muted" style={{ textAlign: 'center' }}>{footer}</p>}
    </main>
);

const PasswordInput = ({ label, value, onChange, autoComplete }) => {
    const [visible, setVisible] = useState(false);
    return (
        <label className="field">
            <span className="label">{label}</span>
            <span className="input-affix">
                <input className="input" type={visible ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} required style={{ paddingRight: '2.75rem' }} />
                <button type="button" className="btn btn-ghost icon-btn" onClick={() => setVisible(v => !v)} aria-label={visible ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: 2, minHeight: 36, width: 36 }}>
                    {visible ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
            </span>
        </label>
    );
};

export function Login() {
    const { signIn } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [unverified, setUnverified] = useState(false);
    const [loading, setLoading] = useState(false);
    const [resendMsg, setResendMsg] = useState('');
    const [showSessionEnded] = useState(sessionEnded.wasEnded);
    useEffect(() => sessionEnded.clear(), []);

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setUnverified(false);
        try {
            signIn(await api.login(email.trim(), password));
            const invite = pendingInvite.take();
            navigate(invite ? `/join/${invite}` : location.state?.from || '/home', { replace: true });
        } catch (err) {
            setError(err);
            setUnverified(err.status === 403);
        } finally {
            setLoading(false);
        }
    };

    const resend = async () => {
        setResendMsg('');
        try {
            setResendMsg((await api.resendVerification(email.trim())).message);
        } catch (err) {
            setResendMsg(err.message);
        }
    };

    return (
        <AuthLayout title="Welcome back" subtitle="Log in to see who owes whom" footer={<>New here? <Link to="/register">Create an account</Link></>}>
            <form className="stack" onSubmit={submit}>
                {showSessionEnded && <div className="notice notice-info">Your session ended. Please log in again.</div>}
                <label className="field">
                    <span className="label">Email</span>
                    <input className="input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
                </label>
                <PasswordInput label="Password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
                <ErrorNotice error={error} />
                {unverified && (
                    <div className="notice notice-pending stack" style={{ gap: '0.4rem' }}>
                        <span>Check your inbox (and spam) for the verification link.</span>
                        <button type="button" className="btn btn-sm btn-secondary" onClick={resend}>Resend verification email</button>
                        {resendMsg && <span className="small">{resendMsg}</span>}
                    </div>
                )}
                <button className="btn btn-primary btn-block" disabled={loading}>{loading ? 'Logging in…' : 'Log in'}</button>
                <Link to="/forgot-password" className="small" style={{ textAlign: 'center' }}>Forgot your password?</Link>
            </form>
        </AuthLayout>
    );
}

export function Register() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [sentTo, setSentTo] = useState(null);

    const submit = async (e) => {
        e.preventDefault();
        if (password.length < 6) return setError(new Error('Password must be at least 6 characters long.'));
        setLoading(true);
        setError(null);
        try {
            const res = await api.register(username.trim(), email.trim(), password);
            setSentTo({ email: email.trim(), emailSent: res.emailSent !== false, message: res.message });
        } catch (err) {
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    if (sentTo) {
        return (
            <AuthLayout title="Check your email">
                <div className="empty" style={{ padding: 0 }}>
                    <div className="empty-icon"><MailCheck size={26} /></div>
                    <p>{sentTo.emailSent
                        ? <>We sent a verification link to <strong>{sentTo.email}</strong>. Click it, then log in.</>
                        : sentTo.message}</p>
                    <p className="small muted">Not there? Check spam, or use &ldquo;Resend&rdquo; on the login page.</p>
                    <Link className="btn btn-primary btn-block" to="/login">Go to login</Link>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout title="Create your account" subtitle="Split bills with friends in seconds" footer={<>Already have an account? <Link to="/login">Log in</Link></>}>
            <form className="stack" onSubmit={submit}>
                <label className="field">
                    <span className="label">Your name</span>
                    <input className="input" autoComplete="name" value={username} onChange={e => setUsername(e.target.value)} minLength={2} maxLength={50} required />
                    <span className="hint">This is how friends will see you.</span>
                </label>
                <label className="field">
                    <span className="label">Email</span>
                    <input className="input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
                </label>
                <PasswordInput label="Password (6+ characters)" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
                <ErrorNotice error={error} />
                <button className="btn btn-primary btn-block" disabled={loading}>{loading ? 'Creating account…' : 'Create account'}</button>
            </form>
        </AuthLayout>
    );
}

export function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            setMessage((await api.forgotPassword(email.trim())).message);
        } catch (err) {
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout title="Reset your password" subtitle="We'll email you a link to choose a new one" footer={<Link to="/login">Back to login</Link>}>
            {message ? <div className="notice notice-success">{message}</div> : (
                <form className="stack" onSubmit={submit}>
                    <label className="field">
                        <span className="label">Email</span>
                        <input className="input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
                    </label>
                    <ErrorNotice error={error} />
                    <button className="btn btn-primary btn-block" disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</button>
                </form>
            )}
        </AuthLayout>
    );
}

export function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState(token ? null : new Error('This reset link is invalid. Request a new one.'));
    const [done, setDone] = useState(false);
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (password.length < 6) return setError(new Error('Password must be at least 6 characters long.'));
        if (password !== confirm) return setError(new Error('The passwords do not match.'));
        setLoading(true);
        setError(null);
        try {
            await api.resetPassword(token, password);
            setDone(true);
            setTimeout(() => navigate('/login'), 2500);
        } catch (err) {
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout title="Choose a new password" footer={<Link to="/login">Back to login</Link>}>
            {done ? <div className="notice notice-success">Password changed. Taking you to login…</div> : (
                <form className="stack" onSubmit={submit}>
                    <PasswordInput label="New password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
                    <PasswordInput label="Confirm new password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
                    <ErrorNotice error={error} />
                    <button className="btn btn-primary btn-block" disabled={loading || !token}>{loading ? 'Saving…' : 'Save new password'}</button>
                </form>
            )}
        </AuthLayout>
    );
}
