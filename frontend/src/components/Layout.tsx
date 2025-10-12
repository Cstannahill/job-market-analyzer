import React from 'react';
import { Header } from './HeaderAlt';
import { Footer } from './Footer';

type Props = {
    children: React.ReactNode;
};

export const Layout: React.FC<Props> = ({ children }) => {
    return (
        <div className="app min-h-screen  transition-colors duration-200">
            <div className="page">
                <Header />
                <main id="main-content" className="container mx-auto px-4 py-6">

                    {children}
                </main>
                <Footer />
            </div>
        </div>
    );
};