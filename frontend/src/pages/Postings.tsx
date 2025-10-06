import React from 'react';
import { Layout } from '../components/Layout';
import JobPostingsSection from '@/components/postings/JobPostingsSection';

const Postings: React.FC = () => {
    return (
        <Layout>
            <h2>All Job Postings</h2>
            <JobPostingsSection />
        </Layout>
    );
};

export default Postings;
