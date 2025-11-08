import React from 'react';
import { Layout } from '../components/Layout';
import JobPostingsSection from '@/components/postings/JobPostingsSection';
import SectionCard from '@/components/about/SectionCard';
import Seo from '@/components/Seo';

const Postings: React.FC = () => {

    return (
        <Layout>
            <Seo
                title="Job Postings — Job Market Analyzer"
                description="Explore the latest job postings and trends in the job market."
                path="/postings"
                image="/public/og/postings.avif"
            />
            <SectionCard title="Job Postings">
                <JobPostingsSection />
            </SectionCard>
        </Layout>
    );
};

export default Postings;
