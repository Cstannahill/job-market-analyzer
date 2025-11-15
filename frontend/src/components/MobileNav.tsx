import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { Button } from "./ui/button";
import { Menu } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { useLocation } from 'react-router-dom';
import { useAuthStore, useAuthUser } from '@/stores/authStore';

type LinkItem = { to: string; label: string; icon: React.ReactNode };

type MobileNavProps = {
    links: LinkItem[];
    resumeLinks?: LinkItem[];
};

export const MobileNav: React.FC<MobileNavProps> = ({ links, resumeLinks = [] }) => {
    const { pathname } = useLocation();
    const user = useAuthUser();
    const logout = useAuthStore((state) => state.logout);

    const handleLogout = async () => {
        await logout();

    };
    const isActive = (path: string) => pathname === path;
    return (
        <div className="md:hidden w-full flex">
            <Sheet>
                <SheetTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon"
                        aria-label="Menu"
                        className="justify-self-end border-slate-600/30 bg-slate-900/20 hover:border-cyan-400 hover:bg-slate-900/40 hover:text-cyan-300 transition-all"
                    >
                        <Menu className="h-5 w-5" />
                    </Button>
                </SheetTrigger>
                <SheetContent
                    side="right"
                    className="w-[80%] sm:w-[350px] border-l border-slate-800/30 bg-[#0d1217]"
                >
                    <SheetHeader>
                        <SheetTitle className="text-xl text-cyan-300">
                            Navigation Menu
                        </SheetTitle>
                    </SheetHeader>
                    <nav className="flex flex-col gap-4">
                        {links.map((link) => (
                            <NavLink
                                key={link.to}
                                to={link.to}
                                className={`text-lg font-medium px-3 py-2 rounded-md transition-colors flex items-center gap-3 ${isActive(link.to)
                                    ? "bg-[#1a2432] text-cyan-300"
                                    : "text-foreground hover:bg-[#151f2c] hover:text-cyan-300"
                                    }`}
                            >
                                <span className="bg-slate-900/30 p-2 rounded-md">
                                    {link.icon}
                                </span>
                                {link.label}
                            </NavLink>
                        ))}
                        {resumeLinks.length > 0 && (
                            <div className="pt-4 border-t border-slate-800/30">
                                <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">
                                    Resume
                                </p>
                                <div className="flex flex-col gap-3">
                                    {resumeLinks.map((link) => (
                                        <NavLink
                                            key={link.to}
                                            to={link.to}
                                            className={`text-base font-medium px-3 py-2 rounded-md transition-colors flex items-center gap-3 ${isActive(link.to)
                                                ? "bg-[#1a2432] text-cyan-300"
                                                : "text-foreground hover:bg-[#151f2c] hover:text-cyan-300"
                                                }`}
                                        >
                                            <span className="bg-slate-900/30 p-2 rounded-md">
                                                {link.icon}
                                            </span>
                                            {link.label}
                                        </NavLink>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="flex border-t border-slate-800/30  justify-center mobile-nav-auth-div">
                            {!user ? (
                                <Link to="/login" >
                                    <Button variant="secondary" className='p-2 w-[40vw] h-8' size="lg">Login</Button>
                                </Link>
                            ) : (
                                <Button variant="secondary" type="button" onClick={handleLogout} className='p-2 w-[40vw] h-8' size="lg">Logout</Button>
                            )}
                        </div>
                    </nav>
                </SheetContent>
            </Sheet>
        </div>)
}
