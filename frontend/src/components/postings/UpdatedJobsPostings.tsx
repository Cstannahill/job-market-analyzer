import React, { useEffect, useMemo, useState } from 'react';
import {
    useInfiniteQuery,
    useQuery,
    useQueryClient,
    type QueryFunctionContext,
} from '@tanstack/react-query';
import { getJobPostingsPage, getJobPostingsStats, type ExtendedJobPosting } from '@/services/api';
import { JobPostingCard } from '@/components/postings/JobPostingCard';
import { JobPostingsControls } from '@/components/postings/JobPostingsControls';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

type Page = {
    items: ExtendedJobPosting[];
    count: number;
    lastKey?: string | null;
};

type Stats = {
    totalPostings: number;
    totalTechnologies: number;
    totalSkills: number;
    technologyCounts: Record<string, number>;
    skillCounts?: Record<string, number>;
    items?: ExtendedJobPosting[];
};

export const JobPostingsSection: React.FC = () => {
    const [jobPostings, setJobPostings] = useState<ExtendedJobPosting[]>([]);
    const [filteredPostings, setFilteredPostings] = useState<ExtendedJobPosting[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTech, setSelectedTech] = useState<string>('__all__');

    const [pageSize, setPageSize] = useState<number>(20);
    const [pageIndex, setPageIndex] = useState<number>(1);

    const queryClient = useQueryClient();

    const cachedStats = queryClient.getQueryData<Stats>(['job-postings-stats']);

    const { data: stats, isLoading: statsLoading } = useQuery<Stats, Error>({
        queryKey: ['job-postings-stats'],
        queryFn: () => getJobPostingsStats(),
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
        enabled: !cachedStats,
        initialData: cachedStats,
    });

    const queryKey = ['job-postings', pageSize] as const;
    console.log(statsLoading);
    const {
        data,
        isLoading: rqIsLoading,
        isError: rqIsError,
        error: rqError,
        fetchNextPage,
        isFetchingNextPage,
        refetch,
        isRefetching,
    } = useInfiniteQuery<Page, Error>({
        queryKey,
        queryFn: async (context: QueryFunctionContext) => {
            const pageParam = context.pageParam as string | null | undefined;
            return getJobPostingsPage({ limit: pageSize, lastKey: pageParam ?? undefined });
        },
        initialPageParam: null as string | null,
        getNextPageParam: (lastPage: Page) => lastPage.lastKey ?? undefined,
        staleTime: 1000 * 60 * 2,
        gcTime: 1000 * 60 * 30,
    });

    const pages = data?.pages ?? [];
    const currentPage = pages[pageIndex - 1];
    const pageItems = useMemo(() => currentPage?.items ?? [], [currentPage]);

    useEffect(() => {
        setLoading(rqIsLoading || isRefetching);
        setError(rqIsError ? String(rqError?.message ?? rqError) : null);
    }, [rqIsLoading, rqIsError, rqError, isRefetching]);

    useEffect(() => {
        setJobPostings(pageItems);
        let filtered = pageItems;

        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(
                (posting) =>
                    posting.title.toLowerCase().includes(lowerSearch) ||
                    posting.skills.some((skill) => skill.toLowerCase().includes(lowerSearch)) ||
                    posting.technologies.some((tech) => tech.toLowerCase().includes(lowerSearch))
            );
        }

        if (selectedTech && selectedTech !== '__all__') {
            filtered = filtered.filter((posting) => posting.technologies.includes(selectedTech));
        }

        setFilteredPostings(filtered);
    }, [pageItems, searchTerm, selectedTech]);

    const techCounts = useMemo(() => {
        if (stats?.technologyCounts && Object.keys(stats.technologyCounts).length > 0) {
            return stats.technologyCounts;
        }
        return jobPostings.reduce<Record<string, number>>((acc, p) => {
            p.technologies.forEach((t) => (acc[t] = (acc[t] || 0) + 1));
            return acc;
        }, {});
    }, [stats, jobPostings]);

    const totalPages = stats?.totalPostings
        ? Math.ceil(stats.totalPostings / pageSize)
        : undefined;

    useEffect(() => {
        if (searchTerm || (selectedTech && selectedTech !== '__all__')) {
            setPageIndex(1);
        }
    }, [searchTerm, selectedTech]);

    const fetchPage = async (page: number) => {
        if (page < 1) return;

        const cached = queryClient.getQueryData<{ pages: Page[] }>(queryKey);
        if (cached?.pages && cached.pages.length >= page) {
            setPageIndex(page);
            return;
        }

        try {
            setError(null);
            let currentPages = cached?.pages?.length ?? pages.length ?? 0;

            if (currentPages === 0 && !data) {
                await refetch();
                const afterRefetch = queryClient.getQueryData<{ pages: Page[] }>(queryKey);
                currentPages = afterRefetch?.pages?.length ?? 0;
            }

            while (currentPages < page) {
                const after = queryClient.getQueryData<{ pages: Page[] }>(queryKey);
                const lastPg = after?.pages?.[currentPages - 1];
                const lastKey = lastPg?.lastKey;

                if (!lastKey && currentPages !== 0) {
                    break;
                }

                await fetchNextPage();
                const afterNext = queryClient.getQueryData<{ pages: Page[] }>(queryKey);
                const newCount = afterNext?.pages?.length ?? currentPages;

                if (newCount === currentPages) {
                    break;
                }

                currentPages = newCount;
            }

            const finalPages = queryClient.getQueryData<{ pages: Page[] }>(queryKey)?.pages?.length ?? 0;

            if (finalPages >= page) {
                setPageIndex(page);
            } else {
                setPageIndex(Math.max(1, finalPages));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load job postings');
        }
    };

    useEffect(() => {
        fetchPage(1).catch(() => { });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSize]);

    useEffect(() => {
        if (!currentPage) return;
        if (currentPage.lastKey) {
            fetchNextPage().catch(() => { });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage?.items?.length, currentPage?.lastKey]);

    // Handlers for the controls component
    const handleClearFilters = () => {
        setSearchTerm('');
        setSelectedTech('__all__');
    };

    const handlePageSizeChange = (size: number) => {
        setPageIndex(1);
        setPageSize(size);
        queryClient.removeQueries({ queryKey });
    };

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
                <Button onClick={() => fetchPage(pageIndex)} variant="default">
                    Retry
                </Button>
            </div>
        );
    }

    return (
        <>
            <JobPostingsControls
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                selectedTech={selectedTech}
                onTechChange={setSelectedTech}
                techCounts={techCounts}
                pageIndex={pageIndex}
                totalPages={totalPages}
                pageSize={pageSize}
                onPageSizeChange={handlePageSizeChange}
                onPreviousPage={() => fetchPage(Math.max(1, pageIndex - 1))}
                onNextPage={() => fetchPage(pageIndex + 1)}
                isPreviousDisabled={pageIndex === 1 || rqIsLoading || isFetchingNextPage}
                isNextDisabled={!currentPage?.lastKey || isFetchingNextPage || rqIsLoading}
                nextButtonLabel={isFetchingNextPage ? 'Loading...' : 'Next'}
                onClearFilters={handleClearFilters}
                showClearFilters={!!(searchTerm || (selectedTech && selectedTech !== '__all__'))}
            />

            {/* Job Postings Card */}
            {filteredPostings.length === 0 ? (
                <div className="empty-state">
                    <p>No job postings match your filters.</p>
                </div>
            ) : (
                <div className="job-grid">
                    {filteredPostings.map((posting) => (
                        <JobPostingCard key={posting.Id} posting={posting} />
                    ))}
                </div>
            )}

            <div className="results-info">
                Showing {jobPostings.length} job postings (page {pageIndex})
                {typeof stats?.totalPostings === 'number' ? ` — Total: ${stats.totalPostings}` : null}
            </div>

            {/* Bottom Pagination - mirroring the top controls with responsive layout */}
            <div className="flex flex-col sm:flex-row items-center gap-3 py-3 pagination-container">
                <div className="flex items-center gap-3 justify-center sm:flex-1 sm:justify-center">
                    <Button
                        onClick={() => fetchPage(Math.max(1, pageIndex - 1))}
                        disabled={pageIndex === 1 || rqIsLoading || isFetchingNextPage}
                        aria-label="Previous page"
                        className="pagination-button px-3 py-1 rounded-lg text-sm font-semibold transition-transform transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-400/30 disabled:opacity-50 disabled:translate-y-0"
                    >
                        Prev
                    </Button>

                    <div
                        className="relative px-4 py-1 rounded-lg text-sm font-semibold text-white bg-white/5 ring-1 ring-white/6 shadow-sm flex items-center justify-center min-w-[120px]"
                        aria-live="polite"
                    >
                        <span className="sr-only">Current page:</span>
                        {`Page ${pageIndex} `}
                        {totalPages ? <span className="text-xs text-white/70 ml-2">{` of ${totalPages}`}</span> : null}
                    </div>

                    <Button
                        onClick={() => fetchPage(pageIndex + 1)}
                        disabled={!currentPage?.lastKey || isFetchingNextPage || rqIsLoading}
                        aria-label="Next page"
                        className="pagination-button px-3 py-1 rounded-lg text-sm font-semibold transition-transform transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-400/30 disabled:opacity-50"
                    >
                        {isFetchingNextPage ? 'Loading...' : 'Next'}
                    </Button>
                </div>

                <div className="flex items-center justify-center sm:justify-end gap-3 w-full sm:w-auto sm:flex-1">
                    <div className="text-sm text-white/60 whitespace-nowrap">Results per page</div>
                    <select
                        value={pageSize}
                        onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                        className="w-20 rounded-md text-sm font-medium bg-transparent border border-white/10 px-3 py-1"
                    >
                        <option value="10">10</option>
                        <option value="20">20</option>
                        <option value="50">50</option>
                    </select>
                </div>
            </div>
        </>
    );
};

export default JobPostingsSection;