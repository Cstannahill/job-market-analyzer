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
            {/* <DrawSingleIcon /> */}
            {/* <div style={{ left: "20rem" }} className="fixed inset-y-0 xl:flex-row items-center z-20"
            >
                <TechGrid />
            </div> */}
            {/* <div style={{ right: "20rem" }} className="fixed inset-y-0 xl:flex-col items-center z-20"
            >
                <TechGrid2 />
            </div> */}

            <LandingPage />
        </>
    );
};

export default Home;
