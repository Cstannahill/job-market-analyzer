import React from 'react';
import Nav from './Nav';
import { Link } from 'react-router-dom';

export const Header: React.FC = () => {
    return (
        <header className="bg-white shadow-lg mb-3 rounded-lg p-2" role="banner">
            {/* Skip link for keyboard users */}
            <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:bg-white focus:px-3 focus:py-2 focus:rounded-md focus:shadow-md">Skip to content</a>

            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                <div className="flex flex-col">
                    <h1 className="text-xl font-semibold leading-tight">
                        <Link to="/" className="text-indigo-700 hover:text-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded">TrendDev</Link>
                    </h1>

                </div>
                <Nav />
            </div>
        </header>
    );
};
