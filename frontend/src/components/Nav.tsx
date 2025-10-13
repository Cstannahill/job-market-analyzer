import React, { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const NavLinks: { to: string; label: string }[] = [
    { to: '/', label: 'Home' },
    { to: '/top-tech', label: 'Top Tech' },
    { to: '/postings', label: 'Job Postings' },
    { to: '/trends', label: 'Trends' },
    { to: '/resume', label: 'Upload Resume' },
    { to: '/about', label: 'About' },
];

export const Nav: React.FC = () => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const menuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
            if (!open) return;

            if (e.key === 'Tab' && menuRef.current) {
                const focusable = menuRef.current.querySelectorAll<HTMLElement>(
                    'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
                );
                if (focusable.length === 0) return;

                const first = focusable[0];
                const last = focusable[focusable.length - 1];

                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        const onClick = (e: MouseEvent) => {
            if (!containerRef.current) return;
            if (open && !containerRef.current.contains(e.target as Node)) setOpen(false);
        };

        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onClick);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', onClick);
        };
    }, [open]);

    useEffect(() => {
        if (open && menuRef.current) {
            // focus first focusable element in the menu
            const focusable = menuRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
            if (focusable.length) focusable[0].focus();
            // prevent background scroll when menu open
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }, [open]);

    return (
        <nav className="main-nav" aria-label="Main navigation" role="navigation" ref={containerRef}>
            {/* Desktop nav */}
            <div className="hidden md:flex mx-3 text-fu">
                <ul className="flex items-center list-none m-0 p-0 space-x-3">
                    {NavLinks.map((l) => (

                        <NavLink
                            key={l.to}
                            to={l.to}
                            end={l.to === '/'}
                            className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
                        >
                            {l.label}
                        </NavLink>



                    ))}
                </ul>
            </div>

            {/* Mobile Menu Toggle */}
            <div className="lg:hidden">
                <button
                    aria-expanded={open}
                    aria-controls="mobile-menu"
                    aria-label={open ? 'Close menu' : 'Open menu'}
                    onClick={() => setOpen((v) => !v)}
                    className="relative inline-flex items-center justify-center h-10 w-10 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 hover:border-indigo-500/30 shadow-lg hover:shadow-indigo-500/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all duration-300 group"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-purple-500/0 group-hover:from-indigo-500/10 group-hover:to-purple-500/10 rounded-xl transition-all duration-300" />
                    {open ? (
                        <X className="w-5 h-5 text-slate-300 group-hover:text-indigo-400 transition-colors relative z-10" />
                    ) : (
                        <Menu className="w-5 h-5 text-slate-300 group-hover:text-indigo-400 transition-colors relative z-10" />
                    )}
                </button>
            </div>

            {/* Mobile Menu Drawer */}
            {open && (
                <>
                    {/* Backdrop with blur - staggered animation */}
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                        style={{
                            animation: 'fadeIn 0.3s ease-out forwards'
                        }}
                        aria-hidden="true"
                        onClick={() => setOpen(false)}
                    />

                    {/* Slide-out Drawer Panel */}
                    <aside
                        id="mobile-menu"
                        ref={menuRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Mobile navigation menu"
                        className="fixed z-50 top-0 right-0 h-screen w-[85vw] max-w-sm lg:hidden"
                        style={{
                            animation: 'slideInFromRight 0.3s ease-out forwards'
                        }}
                    >
                        <div className="relative h-full bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 shadow-2xl border-l border-white/10 flex flex-col overflow-hidden">
                            {/* Gradient accent - vertical */}
                            <div className="absolute top-0 left-0 bottom-0 w-px bg-gradient-to-b from-transparent via-indigo-500 to-transparent" />

                            {/* Header section with close button */}
                            <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg">
                                        <span className="text-white font-bold text-sm">TD</span>
                                    </div>
                                    <span className="text-lg font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                                        Menu
                                    </span>
                                </div>
                                <button
                                    onClick={() => setOpen(false)}
                                    className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-slate-800/50 hover:bg-slate-700/80 border border-white/10 hover:border-indigo-500/30 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    aria-label="Close menu"
                                >
                                    <X className="w-5 h-5 text-slate-300 hover:text-white transition-colors" />
                                </button>
                            </div>

                            {/* Navigation links - scrollable if needed */}
                            <nav className="flex-1 overflow-y-auto bg-card px-4 py-6 text-center">
                                <ul className="flex flex-col gap-10 border-t-2 text-center">
                                    {NavLinks.map((link, index) => (
                                        <li
                                            key={link.to}
                                            style={{
                                                animationDelay: `${index * 50}ms`,
                                            }}
                                            className="animate-in slide-in-from-right-4 fade-in duration-300 border-b-2 text-center"
                                        >
                                            <NavLink
                                                to={link.to}
                                                end={link.to === '/'}
                                                onClick={() => setOpen(false)}
                                                className={({ isActive }) => [
                                                    'relative block px-5 py-4  text-white transition-all duration-300 group',
                                                    'focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900',
                                                    isActive
                                                        ? 'text-white shadow-xl shadow-indigo-500/20'
                                                        : "",
                                                ].join(' ')}
                                            >
                                                {({ isActive }) => (
                                                    <>
                                                        {/* Active background with enhanced glow */}
                                                        {isActive && (
                                                            <>
                                                                <span className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 rounded-sm opacity-100" />
                                                                <span className="absolute -inset-0.5 bg-gradient-to-r from-indigo-600/50 via-purple-600/50 to-indigo-600/50  blur-sm" />
                                                            </>
                                                        )}

                                                        {/* Hover background with slide-in effect */}
                                                        {!isActive && (
                                                            <>
                                                                <span className="absolute inset-0 bg-slate-800/0 group-hover:bg-slate-800/60  transition-all duration-300" />
                                                                <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full scale-y-0 group-hover:scale-y-100 transition-transform duration-300 origin-top" />
                                                            </>
                                                        )}

                                                        {/* Text with navigation arrow */}
                                                        <span className="relative z-10 flex items-center justify-between font-semibold">
                                                            <span className="flex items-center gap-3 text-center">
                                                                {link.label}
                                                            </span>
                                                            {isActive ? (
                                                                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                </svg>
                                                            ) : (
                                                                <svg className="w-5 h-5 flex-shrink-0 text-slate-500 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                                </svg>
                                                            )}
                                                        </span>
                                                    </>
                                                )}
                                            </NavLink>
                                        </li>
                                    ))}
                                </ul>
                            </nav>

                            {/* Footer section - optional branding or info */}
                            <div className="px-6 py-4 border-t border-white/5">
                                <p className="text-xs text-slate-500 text-center">
                                    TrendDev © 2025
                                </p>
                            </div>
                        </div>

                    </aside>

                </>
            )}
        </nav>
    );
};

export default Nav;