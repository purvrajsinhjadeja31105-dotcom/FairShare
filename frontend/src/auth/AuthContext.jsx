import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { TOKEN_KEY } from '../api/client';
import { clearAllCaches } from '../utils/cache';

const USER_KEY = 'fairshare_user';
const PENDING_INVITE_KEY = 'fairshare_pending_invite';
const SESSION_ENDED_KEY = 'fairshare_session_ended';

const readUser = () => {
    try {
        return JSON.parse(localStorage.getItem(USER_KEY));
    } catch {
        return null;
    }
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
    const [user, setUser] = useState(readUser);

    const signIn = useCallback(({ token: newToken, user: newUser }) => {
        clearAllCaches(); // drop anything cached by a previous account on this browser
        localStorage.setItem(TOKEN_KEY, newToken);
        localStorage.setItem(USER_KEY, JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);
    }, []);

    const signOut = useCallback(() => {
        clearAllCaches(); // never leave this account's data behind for the next person on this browser
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setToken(null);
        setUser(null);
    }, []);

    const updateUser = useCallback((changes) => {
        setUser(prev => {
            const next = { ...prev, ...changes };
            localStorage.setItem(USER_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    // Session expired or token rejected by the server: log out and tell the user on the login page
    useEffect(() => {
        const onExpired = () => {
            try { sessionStorage.setItem(SESSION_ENDED_KEY, '1'); } catch { /* message is optional */ }
            signOut();
        };
        window.addEventListener('auth_expired', onExpired);
        return () => window.removeEventListener('auth_expired', onExpired);
    }, [signOut]);

    // Tabs share localStorage: logging in or out in another tab changes who this tab's requests act as.
    // Reload so this tab shows the account it is actually using, instead of a mix of two accounts.
    useEffect(() => {
        const onStorage = (event) => {
            if (event.key !== TOKEN_KEY && event.key !== null) return; // null = storage cleared
            if (localStorage.getItem(TOKEN_KEY) !== token) window.location.reload();
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [token]);

    const value = useMemo(() => ({ token, user, isSignedIn: Boolean(token && user), signIn, signOut, updateUser }), [token, user, signIn, signOut, updateUser]);
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

/** Set when the server ended the session; the login page shows a notice, then clears it. */
// eslint-disable-next-line react-refresh/only-export-components
export const sessionEnded = {
    wasEnded: () => {
        try { return sessionStorage.getItem(SESSION_ENDED_KEY) === '1'; } catch { return false; }
    },
    clear: () => {
        try { sessionStorage.removeItem(SESSION_ENDED_KEY); } catch { /* storage unavailable */ }
    }
};

// An invite link opened while logged out is remembered until the user has signed in
// (sign-up needs email verification first, so this survives a page reload).
// eslint-disable-next-line react-refresh/only-export-components
export const pendingInvite = {
    save: (code) => localStorage.setItem(PENDING_INVITE_KEY, code),
    take: () => {
        const code = localStorage.getItem(PENDING_INVITE_KEY);
        localStorage.removeItem(PENDING_INVITE_KEY);
        return code;
    }
};
