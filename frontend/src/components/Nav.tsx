import React from 'react';
import useIsMobile from '@/hooks/useIsMobile';
import { NavLink } from 'react-router-dom';
import { Briefcase, ChartBarDecreasing, FileQuestionMark, FileUser, Home, TrendingUpDown } from 'lucide-react';
import { MobileNav } from '@/components/MobileNav';

const NavLinks: { to: string; label: string; icon: React.ReactNode }[] = [
    { to: '/', label: 'Home', icon: <Home /> },
    { to: '/top-tech', label: 'Top Tech', icon: <ChartBarDecreasing /> },
    { to: '/postings', label: 'Job Postings', icon: <Briefcase /> },
    { to: '/trends', label: 'Trends', icon: <TrendingUpDown /> },
    { to: '/resume', label: 'Upload Resume', icon: <FileUser /> },
    { to: '/about', label: 'About', icon: <FileQuestionMark /> },
];

export const Nav: React.FC = () => {
    const isMobile = useIsMobile();
    const navClassName = isMobile
        ? 'main-nav flex items-center justify-between w-full px-4'
        : 'main-nav flex items-center justify-center w-full';

    return (
        <nav className={navClassName} aria-label="Main navigation" role="navigation">
            {/* Desktop nav */}
            <div className="hidden md:flex mx-3 text-functional space-x-4">
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

            {/* Mobile nav (sheet/drawer) from shared MobileNav component */}
            <div className="lg:hidden ml-auto">
                <MobileNav links={NavLinks} />
            </div>
        </nav>
    );
};

export default Nav;