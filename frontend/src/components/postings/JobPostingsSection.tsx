import React, { useEffect, useMemo, useState } from 'react';
import {
    useInfiniteQuery,
    useQuery,
    useQueryClient,
    type QueryFunctionContext,
} from '@tanstack/react-query';
import { getJobPostingsPage } from '@/services/jobPostingsService';
import { getJobPostingsStats } from '@/services/jobStatsService';
import type { BaseJobListing, JobStats } from '@job-market-analyzer/types';
import { JobPostingCard } from '@/components/postings/JobPostingCard';
import {
    JobPostingsControls,
    type JobPostingsFilters,
} from '@/components/postings/JobPostingsControls';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

type Filters = JobPostingsFilters;

const createDefaultFilters = (): Filters => ({
    tech: null,
    query: '',
    workModes: [],
    seniorityLevels: [],
});

const serializeFilterValues = (values: string[]): string =>
    values.length ? [...values].sort().join('|') : 'ALL';

const haveSameItems = (a: string[], b: string[]): boolean => {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((value, index) => value === sortedB[index]);
};

type Page = {
    items: BaseJobListing[];
    count: number;
    lastKey?: string | null;
};

export const JobPostingsSection: React.FC = () => {
    const [jobPostings, setJobPostings] = useState<BaseJobListing[]>([]);
    const [filteredPostings, setFilteredPostings] = useState<BaseJobListing[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // ---- NEW: single source of truth for filters
    const [filters, setFilters] = useState<Filters>(() => createDefaultFilters());

    // ---- Back-compat local state (derived), so the rest of your UI remains unchanged
    const searchTerm = filters.query;
    const selectedTech = filters.tech ?? '__all__';

    const [pageSize, setPageSize] = useState<number>(20);
    const [pageIndex, setPageIndex] = useState<number>(1);

    const queryClient = useQueryClient();

    const cachedStats = queryClient.getQueryData<JobStats>(['job-postings-stats']);
    const { data: stats } = useQuery<JobStats, Error>({
        queryKey: ['job-postings-stats'],
        queryFn: () => getJobPostingsStats(),
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
        enabled: !cachedStats,
        initialData: cachedStats,
    });

    const serializedWorkModes = serializeFilterValues(filters.workModes);
    const serializedSeniorities = serializeFilterValues(filters.seniorityLevels);

    // ---- KEY CHANGE: include filters in queryKey so cache partitions by selection
    const queryKey = [
        'job-postings',
        pageSize,
        filters.tech ?? 'ALL',
        serializedWorkModes,
        serializedSeniorities,
    ] as const;

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
            // ---- KEY CHANGE: pass tech to the service only when present
            return getJobPostingsPage({
                limit: pageSize,
                lastKey: pageParam ?? undefined,
                tech: filters.tech ?? undefined,   // <--- this switches Lambda path
                workModes: filters.workModes,
                seniorityLevels: filters.seniorityLevels,
                // status?: keep your default in the service or pass it here if needed
            });
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

        // Free-text search remains client-side
        if (filters.query) {
            const lower = filters.query.toLowerCase();
            filtered = filtered.filter((posting) => {
                const skills = posting.skills ?? [];
                const technologies = posting.technologies ?? [];
                return (
                    posting.job_title.toLowerCase().includes(lower) ||
                    skills.some((s) => s.toLowerCase().includes(lower)) ||
                    technologies.some((t) => t.toLowerCase().includes(lower))
                );
            });
        }

        // Tech:
        // If filters.tech is set, the server already returned only that tech; no need to filter again.
        // If you still want belt-and-suspenders client filter, leave this block:
        if (filters.tech === null ? false : true) {
            // no-op; already filtered server-side
        } else {
            // legacy local tech filter for "__all__"
            // (nothing to do)
        }

        setFilteredPostings(filtered);
    }, [pageItems, filters]);

    const totalPages = stats?.totalPostings
        ? Math.ceil(stats.totalPostings / pageSize)
        : undefined;

    // When filters change, reset to page 1.
    useEffect(() => {
        setPageIndex(1);
    }, [filters, pageSize]);

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

    // Kick page 1 on page-size change
    useEffect(() => {
        fetchPage(1).catch(() => { });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSize, filters.tech, serializedWorkModes, serializedSeniorities]); // include filters so first page is fetched when switching dataset

    useEffect(() => {
        if (!currentPage) return;
        if (currentPage.lastKey) {
            fetchNextPage().catch(() => { });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage?.items?.length, currentPage?.lastKey]);

    // ---- NEW: single handler to receive combobox commits from JobPostingsControls
    const handleFiltersCommit = (next: Filters) => {
        const techChanged = next.tech !== filters.tech;
        const workModesChanged = !haveSameItems(next.workModes, filters.workModes);
        const seniorityChanged = !haveSameItems(next.seniorityLevels, filters.seniorityLevels);

        setFilters(next);
        setPageIndex(1);

        if (techChanged || workModesChanged || seniorityChanged) {
            queryClient.removeQueries({ queryKey });
        }
    };

    const handleClearFilters = () => {
        handleFiltersCommit(createDefaultFilters());
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
                <div className="job-loading-grid">
                    <Skeleton className="job-loading-card" />
                    <Skeleton className="job-loading-card" />
                    <Skeleton className="job-loading-card" />
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
                // legacy props (derived) so you don’t have to refactor the control yet
                searchTerm={searchTerm}
                filters={filters}
                onSearchChange={(q) =>
                    handleFiltersCommit({
                        ...filters,
                        query: q,
                    })
                }
                selectedTech={selectedTech}
                onTechChange={(t) =>
                    handleFiltersCommit({
                        ...filters,
                        tech: t === '__all__' ? null : t,
                    })
                }
                techCounts={stats?.technologies}
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
                showClearFilters={Boolean(
                    filters.query ||
                    filters.tech ||
                    filters.workModes.length ||
                    filters.seniorityLevels.length
                )}

                // ---- NEW: pass-through for the combobox (when you swap it in)
                onFiltersCommit={handleFiltersCommit}
            />

            {/* Job Postings Card */}
            {filteredPostings.length === 0 ? (
                <div className="empty-state">
                    <p>No job postings match your filters.</p>
                </div>
            ) : (
                <div className="job-grid grid grid-cols-1">
                    {filteredPostings.map((posting) => (
                        <JobPostingCard key={`${posting.jobId}`} posting={posting} />
                    ))}
                </div>
            )}

            <div className="results-info">
                Showing {jobPostings.length} job postings (page {pageIndex})
                {typeof stats?.totalPostings === 'number' ? ` — Total: ${stats.totalPostings}` : null}
            </div>

            {/* Bottom Pagination */}
            <div className="pagination-container flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:grid lg:grid-cols-3 py-4">
                <div className="pagination-controls flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-center lg:col-start-2">
                    <Button
                        onClick={() => fetchPage(Math.max(1, pageIndex - 1))}
                        disabled={pageIndex === 1 || rqIsLoading || isFetchingNextPage}
                        aria-label="Previous page"
                        className="pagination-button px-3 py-1 rounded-lg text-sm font-semibold transition-transform transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-400/30 disabled:opacity-50 disabled:translate-y-0"
                    >
                        Prev
                    </Button>

                    <div
                        className="relative px-4 py-1 rounded-lg text-sm font-semibold text-foreground bg-white/5 ring-1 ring-white/6 shadow-sm flex items-center justify-center min-w-[120px]"
                        aria-live="polite"
                    >
                        <span className="sr-only">Current page:</span>
                        <p style={{ margin: "auto 0" }} className="align-middle items-center">
                            {`Page ${pageIndex} `}
                            {totalPages ? <span className="text-xs ml-2">{` of ${totalPages}`}</span> : null}</p>
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

                <div className="pagination-size flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                    <div id='pagi-label' className="text-sm text-foreground whitespace-nowrap">Results per page</div>
                    <select
                        aria-labelledby='pagi-label'
                        aria-label="Select Page Size"
                        value={pageSize}
                        onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                        className="pagination-size-select rounded-md text-sm font-medium bg-transparent border border-white/10 px-3 py-1"
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
