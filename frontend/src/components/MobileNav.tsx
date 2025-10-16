import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { Button } from "./ui/button";
import { Menu } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useLocation } from 'react-router-dom';

type LinkItem = { to: string; label: string; icon: React.ReactNode };

export const MobileNav: React.FC<{ links: LinkItem[] }> = ({ links }) => {
    const { pathname } = useLocation();
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
                    </nav>
                </SheetContent>
            </Sheet>
        </div>)
}