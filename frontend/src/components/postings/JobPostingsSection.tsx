import React, { useEffect, useState } from 'react';
import { getJobPostings, type ExtendedJobPosting } from '@/services/api';
import { JobPostingCard } from '@/components/postings/JobPostingCard';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/ui/select';

export const JobPostingsSection: React.FC = () => {
    const [jobPostings, setJobPostings] = useState<ExtendedJobPosting[]>([]);
    const [filteredPostings, setFilteredPostings] = useState<ExtendedJobPosting[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTech, setSelectedTech] = useState<string>('__all__');

    useEffect(() => {
        fetchJobPostings();
    }, []);

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

    // compute technology counts
    const techCounts = jobPostings.reduce<Record<string, number>>((acc, p) => {
        p.technologies.forEach(t => acc[t] = (acc[t] || 0) + 1);
        return acc;
    }, {});

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

    if (loading) {
        return (
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
        );
    }

    if (error) {
        return (
            <div className="error">
                <h2>Error Loading Data</h2>
                <p>{error}</p>
                <Button onClick={fetchJobPostings} variant="default">Retry</Button>
            </div>
        );
    }

    return (
        <>
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
                    <Button variant="outline" className="text-white" onClick={() => { setSearchTerm(''); setSelectedTech('__all__'); }}>
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
        </>
    );
};

export default JobPostingsSection;