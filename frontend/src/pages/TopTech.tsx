import React from 'react';
import { Layout } from '../components/Layout';
import TopTechChart from '@/components/topTech/TopTechChart';
import SectionCard from '@/components/about/SectionCard';

const TopTech: React.FC = () => {
    return (
        <Layout>
            <SectionCard title="Top Tech">
                <TopTechChart />
            </SectionCard>
        </Layout>
    );
};

export default TopTech;
