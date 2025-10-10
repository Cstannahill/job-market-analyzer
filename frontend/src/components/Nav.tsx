import React, { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';

const NavLinks: { to: string; label: string }[] = [
    { to: '/', label: 'Home' },
    { to: '/top-tech', label: 'Top Tech' },
    { to: '/postings', label: 'Job Postings' },
    { to: '/trends', label: 'Trends' },
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
                            to={l.to}
                            end={l.to === '/'}
                            className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
                        >
                            {l.label}
                        </NavLink>



                    ))}
                </ul>
            </div>

            {/* Mobile toggle */}
            <div className="md:hidden flex items-center">
                <button
                    aria-expanded={open}
                    aria-controls="mobile-menu"
                    onClick={() => setOpen((v) => !v)}
                    className="inline-flex items-center justify-center p-2 rounded-full text-gray-700 hover:bg-gray-100/60 dark:hover:bg-gray-700/60 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all"
                >
                    <span className="sr-only">Open main menu</span>
                    {/* Icon: simple hamburger/close with smoother stroke */}
                    <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                        {open ? (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
                        )}
                    </svg>
                </button>
            </div>

            {/* Mobile menu, centered card */}
            {open && (
                <>
                    <div className="fixed inset-0 bg-black/40 z-40" aria-hidden="true" />
                    <div
                        id="mobile-menu"
                        ref={menuRef}
                        className="fixed z-50 left-1/2 transform -translate-x-1/2 top-20 w-[90%] max-w-sm bg-white dark:bg-gray-800 rounded-xl shadow-2xl ring-1 ring-white/10"
                    >
                        <div className="px-4 py-5">
                            <ul className="flex flex-col gap-2">
                                {NavLinks.map((l) => (
                                    <li key={l.to}>
                                        <NavLink
                                            to={l.to}
                                            end={l.to === '/'}
                                            onClick={() => setOpen(false)}
                                            className={({ isActive }) => [
                                                'block px-4 py-2 rounded-lg text-base font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors',
                                                isActive
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700/50',
                                            ].join(' ')}
                                        >
                                            {l.label}
                                        </NavLink>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </>
            )}
        </nav>
    );
};

export default Nav;
