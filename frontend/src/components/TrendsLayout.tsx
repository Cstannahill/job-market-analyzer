// src/components/TrendsLayout.tsx
import React, { type ReactNode } from 'react';
import { Header } from './HeaderAlt';
import { Sidebar, SidebarProvider, SidebarTrigger, SidebarContent } from '@/components/ui/sidebar';

type Props = {
    children: React.ReactNode;
    sidebarContent?: ReactNode;
    sidebarTitle?: string;
};

/**
 * Layout for Trends page following shadcn/ui sidebar documentation.
 * SidebarProvider wraps Sidebar and main as siblings.
 */
export const TrendsLayout: React.FC<Props> = ({
    children,
    sidebarContent,
    sidebarTitle = "Sidebar"
}) => {
    return (
        <div className="min-h-screen flex flex-col">
            <div className="page">
                <Header />
                <SidebarProvider>
                    {sidebarContent && (
                        <Sidebar collapsible="icon">

                            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 ">
                                <h2 style={{ fontSize: "1.25rem", margin: ".25rem 0rem 0rem 1rem" }} className="text-sm font-medium text-slate-200 group-data-[collapsible=icon]:hidden">
                                    {sidebarTitle}
                                </h2>
                                <SidebarTrigger style={{ margin: ".25rem" }} />
                            </div>
                            <SidebarContent className="px-2">
                                {sidebarContent}
                            </SidebarContent>
                        </Sidebar>
                    )}
                    <main className="flex-1 w-full">
                        {children}
                    </main>
                </SidebarProvider></div>
        </div>
    );
};