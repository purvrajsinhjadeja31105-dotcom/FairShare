import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../auth/AuthContext';

const SocketContext = createContext(null);

const socketUrl = () => {
    const apiBase = import.meta.env.VITE_API_BASE_URL;
    if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
    // A relative API base ("/api") means the dev server proxies to the backend: connect to this same origin
    if (apiBase?.startsWith('/')) return window.location.origin;
    if (apiBase) return apiBase.replace(/\/api\/?$/, '');
    return import.meta.env.DEV ? 'http://localhost:5000' : 'https://fairshare-backend-9bgf.onrender.com';
};

/** One authenticated Socket.io connection while signed in; the server pushes "something changed" events. */
export const SocketProvider = ({ children }) => {
    const { token } = useAuth();
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        if (!token) return undefined;
        const connection = io(socketUrl(), { auth: { token } });
        setSocket(connection);
        return () => {
            connection.disconnect();
            setSocket(null);
        };
    }, [token]);

    return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useSocket = () => useContext(SocketContext);

/** Calls `onEvent` whenever any of the given server events arrives. */
// eslint-disable-next-line react-refresh/only-export-components
export const useSocketEvents = (events, onEvent) => {
    const socket = useSocket();
    const handlerRef = useRef(onEvent);
    useEffect(() => {
        handlerRef.current = onEvent;
    });

    const eventKey = events.join(',');
    useEffect(() => {
        if (!socket) return undefined;
        const handler = (payload) => handlerRef.current(payload);
        const names = eventKey.split(',');
        names.forEach(name => socket.on(name, handler));
        return () => names.forEach(name => socket.off(name, handler));
    }, [socket, eventKey]);
};
