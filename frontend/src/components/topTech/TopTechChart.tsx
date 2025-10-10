import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { getJobPostingsStats } from '@/services/api';
import { useQuery } from '@tanstack/react-query';
import React from 'react';


const TopTechChart: React.FC = () => {

    const {
        data: stats,
        isLoading: loading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey: ['job-postings-stats'],
        queryFn: () => getJobPostingsStats(),
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 30, // 30 minutes
        retry: 1,
    });

    // const totalPostings = stats?.totalPostings || 0;
    // const totalTechnologies = stats?.totalTechnologies || 0;
    // const totalSkills = stats?.totalSkills || 0;
    const technologyCounts = stats?.technologyCounts || {};


    const topTechnologies = Object.entries(technologyCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    if (loading) {
        return (

            <div className="loading">
                <Spinner className="size-8" />
                <p>Loading job postings...</p>
            </div>
        );
    }

    if (isError) {
        return (

            <div className="error">
                <h2>Error Loading Data</h2>
                <p>{error instanceof Error ? error.message : 'Failed to fetch stats'}</p>
                <Button onClick={() => refetch()} variant="default">
                    Retry
                </Button>
            </div>
        );
    }
    return (

        <section className="top-tech-section container tech-chart-card">
            <div className="section-header">
                <h2>Top Technologies</h2>
                <p className="section-subtitle">Most in-demand skills across all job postings</p>
            </div>

            <div className="tech-chart tech-chart-card">
                {topTechnologies.map(([tech, count], index) => {
                    const maxCount = topTechnologies[0][1];
                    const percentage = (count / maxCount) * 100;

                    return (
                        <div key={tech} className="tech-bar-container  fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                            <div className="tech-bar-header">
                                <span className="tech-name">{tech}</span>
                                <span className="tech-count">{count}</span>
                            </div>
                            <div className="tech-bar-wrapper">
                                <div
                                    className="tech-bar"
                                    style={{
                                        width: `${percentage}%`,
                                        animationDelay: `${index * 100}ms`
                                    }}
                                >
                                    <div className="tech-bar-glow"></div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section >


    );
};

export default TopTechChart;
