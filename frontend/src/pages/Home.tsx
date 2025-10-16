import React from 'react';
import App from '../App';
import Seo from '@/components/Seo';

const Home: React.FC = () => {
    <Seo
        title="Home — Job Market Analyzer"
        description="Discover how Job Market Analyzer helps you navigate the job market."
        path="/"
        image="/public/og/home.avif"
    />
    return <App />;
};

export default Home;
