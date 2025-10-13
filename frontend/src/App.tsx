
import { getJobPostingsStats } from './services/api';
import { AnimatedCounter } from './components/AnimatedCounter';
import { ParticleBackground } from './components/ParticleBackground';

import './App.css';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Brain, Briefcase, Code2 } from 'lucide-react';

function App() {
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




  if (loading) {
    return (
      <Layout>
        <div className="loading">
          <Spinner className="size-8" />
          <p>Loading job postings...</p>
        </div>
      </Layout>
    );
  }

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
    <div className="app">
      {/* Hero Section with Animated Background */}
      <section className="hero-section">
        <ParticleBackground />

        <div className="hero-content container">
          <div className="hero-text fade-in">
            <h1 className="hero-title">
              Navigate Your Tech Career with <span className="gradient-text">Real Data</span>
            </h1>
            <p className="hero-subtitle">
              Discover trending skills, salary insights, and market demand across {totalPostings.toLocaleString()} job postings
            </p>
          </div>

          {/* Animated Stats Cards */}
          <div className="stats-grid fade-in">
            <div className="stat-card glass card-hover card-stylish">
              <div className="stat-card-header ">
                {/* <StatsIcon type="postings" /> */}
                <Briefcase className="text-zinc-800 h-8 w-8" />
                <span className="stat-label text-center">Total Postings</span>
              </div>
              <div className="stat-value">
                <AnimatedCounter end={totalPostings} duration={2000} />
              </div>
              <div className="stat-change positive">↑ Updated daily</div>
            </div>

            <div className="stat-card glass card-hover card-stylish">
              <div className="stat-card-header">
                <Code2 className="text-zinc-800 h-8 w-8" />
                {/* <StatsIcon type="technologies" /> */}

                <span className="stat-label">Technologies</span>
              </div>
              <div className="stat-value">
                <AnimatedCounter end={Object.keys(technologyCounts).length} duration={2000} />
              </div>
              <div className="stat-change positive">↑ Tracked live</div>
            </div>

            <div className="stat-card glass card-hover card-stylish">
              <div className="stat-card-header">
                <Brain className="text-zinc-800 h-8 w-8" />
                {/* <StatsIcon type="skills" /> */}
                <span className="stat-label">Skills Extracted</span>
              </div>
              <div className="stat-value nf-mono">
                <AnimatedCounter end={totalSkills} duration={2000} />
              </div>
              <div className="stat-change positive">↑ AI-powered</div>
            </div>
          </div>
        </div>

      </section>
      {/* Call to Action Section */}
      <div className="hero-cta flex justify-center">
        <div className="cta-card glass text-center p-8 rounded-2xl shadow-lg card-stylish">
          <h3>Ready to explore the market?</h3>
          <p>Dive deeper into job postings and skill trends</p>
          <div className="cta-buttons flex flex-wrap justify-center gap-4 mt-4">
            <a href="/top-tech" className="btn btn-primary">Explore Top Tech</a>
            <a href="/postings" className="btn btn-primary">Browse Jobs</a>
            <a href="/trends" className="btn btn-secondary">View Trends</a>
          </div>
        </div>
      </div>

    </div>
  );
}

export default App;