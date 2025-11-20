import React from 'react';
import useIsMobile from '@/hooks/useIsMobile';
import { NavLink } from 'react-router-dom';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Briefcase, ChartBarDecreasing, FileQuestionMark, FileUser, Home, TrendingUpDown, ListChecks, ChevronDown } from 'lucide-react';
import { MobileNav } from '@/components/MobileNav';

const NavLinks: { to: string; label: string; icon: React.ReactNode }[] = [
    { to: '/', label: 'Home', icon: <Home className="h-4 w-4" /> },
    { to: '/top-tech', label: 'Top Tech', icon: <ChartBarDecreasing className="h-4 w-4" /> },
    { to: '/postings', label: 'Job Postings', icon: <Briefcase className="h-4 w-4" /> },
    { to: '/trends', label: 'Trends', icon: <TrendingUpDown className="h-4 w-4" /> },
    // { to: '/resume', label: 'Upload Resume', icon: <FileUser /> },
    { to: '/about', label: 'About', icon: <FileQuestionMark className="h-4 w-4" /> },
];

const ResumeLinks: { to: string; label: string; icon: React.ReactNode }[] = [
    { to: '/resumes/upload', label: 'Upload Resume', icon: <FileUser className="h-4 w-4" /> },
    { to: '/resumes/manage', label: 'Manage Uploaded', icon: <ListChecks className="h-4 w-4" /> },
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
                        <li key={l.to}>
                            <NavLink
                                key={l.to}
                                to={l.to}
                                end={l.to === '/'}
                                className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
                            >
                                {l.icon}
                                {l.label}
                            </NavLink>
                        </li>


                    ))}

                    {/* Resume dropdown */}
                    <li className="relative">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    className="nav-link flex items-center gap-1"
                                    aria-label="Resume menu"
                                >
                                    <FileUser className="h-4 w-4" />
                                    Resume
                                    <ChevronDown className="h-4 w-4 opacity-70" />
                                </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent align="start" className="w-48">
                                <DropdownMenuLabel style={{ padding: ".5rem .5rem" }}>Resume</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild style={{ padding: ".5rem .5rem" }}>
                                    <NavLink to="/resumes/upload" className="flex items-center gap-2">
                                        <FileUser className="h-4 w-4" />
                                        Upload Resume
                                    </NavLink>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild style={{ padding: ".5rem .5rem" }}>
                                    {/* If your route differs, change /resumes to what you actually use */}
                                    <NavLink to="/resumes/manage" className="flex items-center gap-2">
                                        <ListChecks className="h-4 w-4" />
                                        Manage Uploaded
                                    </NavLink>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </li>

                </ul>
            </div >

            {/* Mobile nav (sheet/drawer) from shared MobileNav component */}
            <div className="lg:hidden ml-auto">
                <MobileNav links={NavLinks} resumeLinks={ResumeLinks} />
            </div>
        </nav >
    );
};

export default Nav;
