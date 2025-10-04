import React from 'react';

export const Header: React.FC = () => {
    return (
        <header className="app-header">
            <div className="container">
                <h1>Job Market Analyzer</h1>
                <p className="subtitle">Analyzing job postings</p>
            </div>
        </header>
    );
};
