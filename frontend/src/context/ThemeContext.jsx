import { createContext, useContext, useEffect, useState } from 'react';

const THEME_KEY = 'app_theme';
const ThemeContext = createContext(null);

/** 'system' follows the device setting; 'light' / 'dark' override it. */
export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => {
        try {
            return localStorage.getItem(THEME_KEY) || 'system';
        } catch {
            return 'system';
        }
    });

    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'system') root.removeAttribute('data-theme');
        else root.setAttribute('data-theme', theme);
        try {
            localStorage.setItem(THEME_KEY, theme);
        } catch { /* storage unavailable: the choice just isn't remembered */ }
    }, [theme]);

    return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(ThemeContext);
