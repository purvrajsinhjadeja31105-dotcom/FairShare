import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App.jsx';
import { AuthProvider } from './auth/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <ThemeProvider>
            <AuthProvider>
                <SocketProvider>
                    <App />
                </SocketProvider>
            </AuthProvider>
        </ThemeProvider>
    </StrictMode>
);
