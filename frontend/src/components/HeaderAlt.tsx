import React from 'react';
import Nav from './Nav';
import { Link } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { Moon, Sun } from 'lucide-react';
import trendDevLogo from '@/assets/trenddev.avif';
import useIsMobile from '@/hooks/useIsMobile';
import { Button } from '@/components/ui/button';
import { useAuthStore, useAuthUser } from '@/stores/authStore';

export const Header: React.FC = () => {

    const { theme, toggleTheme } = useTheme();
    const user = useAuthUser();
    const logout = useAuthStore((state) => state.logout);
    const isMobile = useIsMobile();
    const navClassName = isMobile
        ? 'flex items-center gap-4 mobile-menu-toggle'
        : 'flex items-center gap-4';
    const handleLogout = async () => {
        await logout();

    };
    return (
        <header className="w-full md:w-fit sticky top-0 z-50 border-b rounded-lg border-white/5" >
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:bg-indigo-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:z-50"
            >
                Skip to content
            </a>

            {/* Glassmorphism backdrop with gradient overlay */}
            <div className="absolute rounded-lg  border border-stone-700 inset-0 bg-linear-to-r from-slate-900/98 via-slate-900/95 to-slate-900/98 dark:from-slate-900/98 dark:via-slate-900/95 dark:to-slate-900/98 backdrop-blur-xl" />

            <div className="relative bg-stone-900 rounded-lg container mx-auto px-4 sm:px-6 lg:px-8">
                <div className={navClassName}>
                    <img src={trendDevLogo} className="h-10 w-10 m-0 rounded-md shadow-sm shadow-violet-800" alt="TrendDev Logo" />
                    <Link to="/" className="inline-flex items-center gap-3 no-underline focus:outline-none">



                        <span className="hidden sm:inline-block text-xl font-semibold text-indigo-700 dark:text-indigo-300">
                            TrendDev
                        </span>
                    </Link>


                    {/* Desktop Navigation - Centered */}
                    <div className="hidden lg:flex flex-1 justify-center px-8">
                        <Nav />
                    </div>

                    {/* Right Controls */}
                    <div className="flex items-center gap-2 lg:gap-3">
                        {!isMobile &&
                            !user && (
                                <Link to="/login" >
                                    <Button style={{ padding: "1.1rem 2.5rem" }} variant="secondary" className='p-2 w-16 h-8' size="lg">Login</Button>
                                </Link>
                            )}

                        {!isMobile &&
                            user && (
                                <Button style={{ padding: "0rem 2.5rem" }} variant="secondary" type="button" onClick={handleLogout} className='w-16 h-8' size="lg">Logout</Button>
                            )}
                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className="relative inline-flex items-center justify-center h-10 w-10 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 border border-white/10 hover:border-indigo-500/30 shadow-lg hover:shadow-indigo-500/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all duration-300 group"
                            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                        >
                            <div className="absolute inset-0 bg-liner-to-br from-indigo-500/0 to-purple-500/0 group-hover:from-indigo-500/10 group-hover:to-purple-500/10 rounded-xl transition-all duration-300" />
                            {theme === 'light' ? (
                                <Moon className="w-5 h-5 text-slate-300 group-hover:text-indigo-400 transition-colors relative z-10" />
                            ) : (
                                <Sun className="w-5 h-5 text-amber-400 group-hover:text-amber-300 transition-colors relative z-10" />
                            )}
                        </button>

                        {/* Mobile Menu Toggle */}
                        <div className="lg:hidden">
                            <Nav />
                        </div>
                    </div>
                </div>
            </div>

            {/* gradient accent line */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-liner-to-r from-transparent via-indigo-500/50 to-transparent" />
        </header>
    );
};