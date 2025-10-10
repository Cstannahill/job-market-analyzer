import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { Spinner } from './components/ui/spinner';
import { getJobPostingsStats } from './services/api';
import { Layout } from './components/Layout';
import './App.css';

function App() {
  // Fetch stats using React Query - this will be shared across all components
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

  const totalPostings = stats?.totalPostings || 0;
  const totalTechnologies = stats?.totalTechnologies || 0;
  const totalSkills = stats?.totalSkills || 0;
  const technologyCounts = stats?.technologyCounts || {};

  const topTechnologies = Object.entries(technologyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

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
    <Layout>
      {/* Stats Section */}
      <div className="stats-section">
        <Card className="stat-card">
          <CardContent>
            <div className="stat-value">{totalPostings}</div>
            <div className="stat-label">Total Postings</div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent>
            <div className="stat-value">{totalTechnologies}</div>
            <div className="stat-label">Technologies</div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent>
            <div className="stat-value">{totalSkills}</div>
            <div className="stat-label">Skills Extracted</div>
          </CardContent>
        </Card>
      </div>

      {/* Top Technologies */}
      {topTechnologies.length > 0 && (
        <div className="top-tech-section">
          <h2>Top Technologies</h2>
          <div className="tech-chart">
            {topTechnologies.map(([tech, count]) => (
              <div key={tech} className="tech-bar-container">
                <div className="tech-label">
                  <span>{tech}</span>
                  <span className="tech-count">{count}</span>
                </div>
                <div className="tech-bar-wrapper">
                  <div
                    className="tech-bar"
                    style={{
                      width: `${(count / topTechnologies[0][1]) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}

export default App;