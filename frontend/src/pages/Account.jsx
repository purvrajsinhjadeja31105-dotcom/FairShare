import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Avatar, ErrorNotice } from '../components/ui';

const UPI_PATTERN = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

export default function Account() {
    const { user, updateUser, signOut } = useAuth();
    const { theme, setTheme } = useTheme();
    const navigate = useNavigate();
    const [upi, setUpi] = useState(user.upi_id || '');
    const [status, setStatus] = useState(null);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);

    const cleanUpi = upi.trim();
    const upiInvalid = cleanUpi !== '' && !UPI_PATTERN.test(cleanUpi);

    const saveUpi = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setStatus(null);
        try {
            const res = await api.updateProfile({ upi_id: cleanUpi });
            updateUser({ upi_id: res.upi_id });
            setStatus(res.upi_id ? 'Saved. Friends can now pay you with one tap.' : 'UPI ID removed.');
        } catch (err) {
            setError(err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <main className="page">
            <h1>Account</h1>

            <section className="card card-pad row">
                <Avatar name={user.username} id={user.id} />
                <div className="grow">
                    <div className="list-item-title">{user.username}</div>
                    <div className="list-item-meta">{user.email}</div>
                </div>
            </section>

            <form className="card card-pad stack" onSubmit={saveUpi}>
                <h2>Get paid by UPI</h2>
                <p className="muted small">Add your UPI ID so friends who owe you can pay in one tap from Google Pay, PhonePe or Paytm.</p>
                <label className="field">
                    <span className="label">UPI ID</span>
                    <input className="input" placeholder="yourname@okaxis" value={upi} onChange={e => setUpi(e.target.value)} aria-invalid={upiInvalid} />
                    {upiInvalid && <span className="error-text">That doesn&apos;t look like a UPI ID (it should look like name@bank).</span>}
                </label>
                <ErrorNotice error={error} />
                {status && <p className="positive small">{status}</p>}
                <button className="btn btn-primary" disabled={saving || upiInvalid || cleanUpi === (user.upi_id || '')}>{saving ? 'Saving…' : 'Save UPI ID'}</button>
            </form>

            <section className="card card-pad stack">
                <h2>Appearance</h2>
                <div className="segmented" role="group" aria-label="Theme">
                    {[['system', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']].map(([id, label]) => (
                        <button key={id} type="button" aria-pressed={theme === id} onClick={() => setTheme(id)}>{label}</button>
                    ))}
                </div>
            </section>

            <button className="btn btn-danger" onClick={() => { signOut(); navigate('/', { replace: true }); }}>
                <LogOut size={16} /> Log out
            </button>
        </main>
    );
}
