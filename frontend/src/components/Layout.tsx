import React from 'react';
import { Header } from './Header';
import { Footer } from './Footer';

type Props = {
    children: React.ReactNode;
};

export const Layout: React.FC<Props> = ({ children }) => {
    return (
        <div className="app">
            <div className="page">
                <Header />
                <main className="container">{children}</main>
                <Footer />
            </div>
        </div>
    );
};
