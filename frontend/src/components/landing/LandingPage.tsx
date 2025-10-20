
import { getJobPostingsStats } from '@/services/jobStatsService';
import { ParticleBackground } from '@/components/ParticleBackground';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Brain, Briefcase, Code2 } from 'lucide-react';
import StatsCard from '@/components/shared/StatsCard';
import { LandingHeroText } from '@/components/landing/LandingHero';
import { LandingCTA } from '@/components/landing/LandingCTA';

function LandingPage() {
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
    gcTime: 1000 * 60 * 60, // 1 hour
    retry: 1,
  });

  const totalPostings = stats?.totalPostings || 0;
  // const totalTechnologies = stats?.totalTechnologies || 0;
  const totalSkills = stats?.totalSkills || 0;
  const technologyCounts = stats?.technologies || {};







  if (isError) {
    return (
      <Layout>
        <div className="error">
          <h2>Error Loading Data</h2>
          <p>{error instanceof Error ? error.message : 'Failed to fetch stats'}</p>
          <Button onClick={() => refetch()} variant="default">
            Retry
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <div className="max-h-none overflow-hidden">
      {/* Hero Section with Animated Background */}
      <section className="hero-section">
        <ParticleBackground />
        <div className="hero-content container">
          <LandingHeroText totalPostings={totalPostings} />
          {/* Animated Stats Cards */}
          <div className="stats-grid fade-in">
            {loading ? <div className="flex justify-center"><Spinner className="size-12 landing-spinner" /></div> : (
              <>
                <StatsCard
                  icon={Briefcase}
                  label="Total Postings"
                  value={totalPostings}
                  duration={2000}
                  changeText="↑ Updated daily"
                  changeType="positive"
                />
                <StatsCard
                  icon={Code2}
                  label="Technologies Tracked"
                  value={Object.keys(technologyCounts).length}
                  duration={2000}
                  changeText="↑ Tracked Live"
                  changeType="positive"
                />
                <StatsCard
                  icon={Brain}
                  label="Unique Skills"
                  value={totalSkills}
                  duration={2000}
                  changeText="↑ AI-Powered"
                  changeType="positive"
                /></>)}
            {/* Add more StatsCard components as needed */}
          </div>
        </div>
      </section>
      {/* Call to Action Section */}
      <LandingCTA />

    </div>
  );
}

export default LandingPage;