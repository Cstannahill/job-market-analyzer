import React from 'react';
import Nav from './Nav';
import { Link } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { Moon, Sun } from 'lucide-react';

export const Header: React.FC = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <header
            className="bg-white dark:bg-gray-800 shadow-lg mb-3 rounded-lg w-full p-5 transition-colors duration-200"
            role="banner"
        >
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:bg-white dark:focus:bg-gray-800 focus:px-3 focus:py-2 focus:rounded-md focus:shadow-md"
            >
                Skip to content
            </a>

            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                <div className="flex flex-col">
                    <h1 className="text-xl font-semibold leading-tight">
                        <Link
                            to="/"
                            className="text-indigo-700 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded transition-colors"
                        >
                            TrendDev
                        </Link>
                    </h1>
                </div>

                <div className="flex items-center gap-4">
                    <Nav />

                    {/* Theme Toggle Button */}
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                    >
                        {theme === 'light' ? (
                            <Moon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                        ) : (
                            <Sun className="w-5 h-5 text-yellow-500" />
                        )}
                    </button>
                </div>
            </div>
        </header>
    );
};