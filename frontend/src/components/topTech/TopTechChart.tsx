import { Button } from '@/components/ui/button';
import { Card, CardDescription } from '@/components/ui/card';
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

        <Card className="bg-card/90 my-3 about-section-card backdrop-blur-sm border border-chart-4 shadow-sm hover:shadow-md transition">
            <CardDescription className="section-subtitle text-center text-white/25 nf-mono">Most in-demand skills across all job postings</CardDescription>

            <Card className="bg-card/90 my-3 about-section-card backdrop-blur-sm border border-chart-4 shadow-sm hover:shadow-md transition">
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
            </Card>
        </Card>


    );
};

export default TopTechChart;
