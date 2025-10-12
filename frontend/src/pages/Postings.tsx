import React from 'react';
import { Layout } from '../components/Layout';
import JobPostingsSection from '@/components/postings/UpdatedJobsPostings';
import SectionCard from '@/components/about/SectionCard';

const Postings: React.FC = () => {
    return (
        <Layout>
            <SectionCard title="Job Postings">
                <JobPostingsSection />
            </SectionCard>
        </Layout>
    );
};

export default Postings;
