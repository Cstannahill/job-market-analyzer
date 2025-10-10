import React, { useEffect, useState } from 'react';
import { ThemeContext } from '@/contexts/ThemeContext';

type Theme = 'light' | 'dark';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<Theme>(() => {
        try {
            const stored = localStorage.getItem('theme') as Theme | null;
            if (stored) return stored;
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        } catch {
            return 'light';
        }
    });

    useEffect(() => {
        const root = document.documentElement;
        const body = document.body;

        // Explicitly toggle only the 'dark' class (Tailwind only needs 'dark').
        root.classList.toggle('dark', theme === 'dark');
        body.classList.toggle('dark', theme === 'dark');

        // Optional: set a data attribute for alternative styling or third-party libs
        root.setAttribute('data-theme', theme);

        try {
            localStorage.setItem('theme', theme);
        } catch {
            /* ignore */
        }
    }, [theme]);

    const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};
