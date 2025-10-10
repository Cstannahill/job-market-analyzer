import React from 'react';
import Nav from './Nav';
import { Link } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { Moon, Sun } from 'lucide-react';

export const Header: React.FC = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        // modern header constrained to page width: sticky so it stays in flow and won't span full window
        <header className="w-full sticky top-0 z-40" role="banner">
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:bg-white dark:focus:bg-gray-800 focus:px-3 focus:py-2 focus:rounded-md focus:shadow-md"
            >
                Skip to content
            </a>

            <div className="container header-container mx-auto px-4 py-3 flex items-center gap-4 backdrop-blur-sm bg-white/40 dark:bg-gray-900/40 shadow-sm rounded-md transition-colors duration-300">
                {/* left: logo */}
                <div className="flex items-center gap-4">
                    <Link to="/" className="inline-flex items-center gap-3 no-underline focus:outline-none">
                        <span className="h-10 w-10 rounded-md bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center text-white font-bold shadow-md">
                            TD
                        </span>
                        <span className="hidden sm:inline-block text-xl font-semibold text-indigo-700 dark:text-indigo-300">
                            TrendDev
                        </span>
                    </Link>
                </div>

                {/* center: nav (takes available space and centers its content) */}
                <div className="flex-1 flex justify-center">
                    <Nav />
                </div>

                {/* right: controls */}
                <div className="flex items-center gap-4">
                    {/* Theme Toggle Button (rounded, subtle) */}
                    <button
                        onClick={toggleTheme}
                        className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-white/60 dark:bg-gray-800/60 hover:bg-white/80 dark:hover:bg-gray-800/80 border border-white/10 dark:border-black/20 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                    >
                        {theme === 'light' ? (
                            <Moon className="w-5 h-5 text-gray-700" />
                        ) : (
                            <Sun className="w-5 h-5 text-yellow-400" />
                        )}
                    </button>
                </div>
            </div>
        </header>
    );
};