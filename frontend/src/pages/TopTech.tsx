import React from 'react';
import { Layout } from '../components/Layout';
import TopTechChart from '@/components/topTech/TopTechChart';
// import SectionCard from '@/components/about/SectionCard';
import Seo from '@/components/Seo';


const TopTech: React.FC = () => {
    return (
        <Layout>
            <Seo
                title="Top Tech — Job Market Analyzer"
                description="Discover the top technologies shaping the job market."
                path="/top-tech"
                image="/public/og/top-tech.avif"
            />
            {/* <SectionCard title="Top Tech"> */}
            <TopTechChart />
            {/* </SectionCard> */}
        </Layout>
    );
};

export default TopTech;
