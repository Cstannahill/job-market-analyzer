import { useState, useEffect } from 'react';
import { JobPostingCard } from './components/JobPostingCard';
import { Card, CardContent } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Button } from './components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from './components/ui/select';
import { Spinner } from './components/ui/spinner';
import { Skeleton } from './components/ui/skeleton';
import { getJobPostings, getTechnologyCounts, type JobPosting } from './services/api';
import { Layout } from './components/Layout';
import './App.css';

function App() {
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([]);
  const [filteredPostings, setFilteredPostings] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTech, setSelectedTech] = useState<string>('__all__');

  // Fetch job postings on mount
  useEffect(() => {
    fetchJobPostings();
  }, []);

  // Filter postings when search or tech filter changes
  useEffect(() => {
    let filtered = jobPostings;

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(posting =>
        posting.title.toLowerCase().includes(lowerSearch) ||
        posting.skills.some(skill => skill.toLowerCase().includes(lowerSearch)) ||
        posting.technologies.some(tech => tech.toLowerCase().includes(lowerSearch))
      );
    }

    if (selectedTech && selectedTech !== '__all__') {
      filtered = filtered.filter(posting => posting.technologies.includes(selectedTech));
    }

    setFilteredPostings(filtered);
  }, [searchTerm, selectedTech, jobPostings]);

  const fetchJobPostings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getJobPostings();
      setJobPostings(data);
      setFilteredPostings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job postings');
    } finally {
      setLoading(false);
    }
  };

  // filter logic is handled inline in useEffect

  const techCounts = getTechnologyCounts(jobPostings);
  const topTechnologies = Object.entries(techCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (loading) {
    return (
      <Layout>
        <div className="loading">
          <Spinner className="size-8" />
          <p>Loading job postings...</p>

          <div style={{ width: '100%', marginTop: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              <Skeleton className="h-56" />
              <Skeleton className="h-56" />
              <Skeleton className="h-56" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="error">
          <h2>Error Loading Data</h2>
          <p>{error}</p>
          <Button onClick={fetchJobPostings} variant="default">
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
            <div className="stat-value">{jobPostings.length}</div>
            <div className="stat-label">Total Postings</div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent>
            <div className="stat-value">{Object.keys(techCounts).length}</div>
            <div className="stat-label">Technologies</div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent>
            <div className="stat-value">{jobPostings.reduce((sum, p) => sum + p.skills.length, 0)}</div>
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

      {/* Filters */}
      <div className="filters-section">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
          <Label htmlFor="search-input" className="label-inline">Search</Label>
          <Input
            id="search-input"
            placeholder="Search by title, skill, or technology..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <Select value={selectedTech} onValueChange={(v) => setSelectedTech(v)}>
          <SelectTrigger className="tech-filter">
            <SelectValue placeholder="All Technologies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Technologies</SelectItem>
            {Object.keys(techCounts)
              .sort()
              .map(tech => (
                <SelectItem key={tech} value={tech}>
                  {tech} ({techCounts[tech]})
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        {(searchTerm || (selectedTech && selectedTech !== '__all__')) && (
          <Button variant="outline" onClick={() => { setSearchTerm(''); setSelectedTech('__all__'); }}>
            Clear Filters
          </Button>
        )}
      </div>

      {/* Results */}
      <div className="results-info">Showing {filteredPostings.length} of {jobPostings.length} job postings</div>

      {/* Job Postings Card */}
      <div className="post-list-card">
        {filteredPostings.length === 0 ? (
          <div className="empty-state">
            <p>No job postings match your filters.</p>
          </div>
        ) : (
          <div className="job-grid">
            {filteredPostings.map(posting => (
              <JobPostingCard key={posting.Id} posting={posting} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default App;