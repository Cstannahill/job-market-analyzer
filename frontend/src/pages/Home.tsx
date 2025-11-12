import React from 'react';
import Seo from '@/components/Seo';
import LandingPage from '../components/landing/LandingPage';

const Home: React.FC = () => {

    return (
        <>
            <Seo
                title="Home - TrendDev"
                description="Discover how Job Market Analyzer helps you navigate the job market."
                path=""
                image="/public/og/home.avif"
            />
            <LandingPage />
        </>
    );
};

export default Home;
