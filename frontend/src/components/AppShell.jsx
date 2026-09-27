import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, UserRound } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useSocketEvents } from '../context/SocketContext';
import { useApiData } from '../hooks/useApiData';
import { api } from '../api';

const Brand = ({ to }) => (
    <Link to={to} className="brand" aria-label="FairShare home">
        <span className="brand-mark">₹</span> FairShare
    </Link>
);

/** Top bar for signed-in screens: brand (home), notifications with unread count, account. */
export const AppShell = ({ children }) => {
    const { isSignedIn } = useAuth();
    return (
        <>
            <header className="topbar">
                <div className="topbar-inner">
                    <Brand to={isSignedIn ? '/home' : '/'} />
                    {isSignedIn ? <SignedInActions /> : <SignedOutActions />}
                </div>
            </header>
            {children}
        </>
    );
};

const SignedInActions = () => {
    const navigate = useNavigate();
    const { data, reload } = useApiData(null, api.notifications);
    const [seenAll, setSeenAll] = useState(false);
    useSocketEvents(['update_notifications'], () => {
        setSeenAll(false);
        reload();
    });

    const unread = seenAll ? 0 : (data?.notifications || []).filter(n => !n.is_read).length;

    return (
        <div className="topbar-actions">
            <button
                className="btn btn-ghost icon-btn"
                aria-label={unread ? `Activity, ${unread} new` : 'Activity'}
                onClick={() => { setSeenAll(true); navigate('/activity'); }}
            >
                <Bell size={20} />
                {unread > 0 && <span className="badge-dot">{unread > 9 ? '9+' : unread}</span>}
            </button>
            <button className="btn btn-ghost icon-btn" aria-label="Account" onClick={() => navigate('/account')}>
                <UserRound size={20} />
            </button>
        </div>
    );
};

const SignedOutActions = () => (
    <div className="topbar-actions">
        <Link to="/login" className="btn btn-ghost btn-sm">Log in</Link>
        <Link to="/register" className="btn btn-primary btn-sm">Sign up</Link>
    </div>
);
