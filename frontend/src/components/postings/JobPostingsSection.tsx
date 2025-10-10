
import React, { useEffect, useMemo, useState } from 'react';
import {
    useInfiniteQuery,
    useQuery,
    useQueryClient,
    type QueryFunctionContext,
} from '@tanstack/react-query';
import { getJobPostingsPage, getJobPostingsStats, type ExtendedJobPosting } from '@/services/api';
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
    // keep your original local state shape
    const [jobPostings, setJobPostings] = useState<ExtendedJobPosting[]>([]);
    const [filteredPostings, setFilteredPostings] = useState<ExtendedJobPosting[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTech, setSelectedTech] = useState<string>('__all__');

    const [pageSize, setPageSize] = useState<number>(20);
    const [pageIndex, setPageIndex] = useState<number>(1); // visible 1-based index

    const queryClient = useQueryClient();

    // ---------- READ STATS FROM CACHE (no fetch) ----------
    const cachedStats = queryClient.getQueryData<Stats>(['job-postings-stats']);

    const { data: stats, isLoading: statsLoading } = useQuery<Stats, Error>({
        queryKey: ['job-postings-stats'],
        queryFn: () => getJobPostingsStats(),
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
        enabled: !cachedStats, // Only fetch if not already cached
        initialData: cachedStats, // Use cached data immediately if available
    });
    if (statsLoading && !cachedStats) {
        console.log(`Stats Loading: ${statsLoading}`);
    }
    // Alternatively, you can use queryClient.getQueryData to read synchronously:
    // const stats = queryClient.getQueryData<Stats>(['job-postings-stats']);

    // ---------- INFINITE QUERY (cursor-keyed by lastKey) ----------
    const queryKey = ['job-postings', pageSize] as const;

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
        initialPageParam: null as string | null, // Required in v5
        getNextPageParam: (lastPage: Page) => lastPage.lastKey ?? undefined,
        staleTime: 1000 * 60 * 2,
        gcTime: 1000 * 60 * 30,
    });

    const pages = data?.pages ?? [];
    const currentPage = pages[pageIndex - 1];
    const pageItems = useMemo(() => currentPage?.items ?? [], [currentPage]);

    // sync local loading/error (stats no longer contribute to loading state)
    useEffect(() => {
        setLoading(rqIsLoading || isRefetching);
        setError(rqIsError ? String(rqError?.message ?? rqError) : null);
    }, [rqIsLoading, rqIsError, rqError, isRefetching]);

    // when the current page payload changes, keep your jobPostings in sync
    // Note: filteredPostings will be the same as jobPostings for server-side pagination
    // Client-side filtering only works on the current page
    useEffect(() => {
        setJobPostings(pageItems);
        // Apply filters to current page
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

    // const techCounts = useMemo(() => {
    //     if (stats?.technologyCounts && Object.keys(stats.technologyCounts).length > 0) {
    //         return stats.technologyCounts;
    //     }
    //     return jobPostings.reduce<Record<string, number>>((acc, p) => {
    //         p.technologies.forEach((t) => (acc[t] = (acc[t] || 0) + 1));
    //         return acc;
    //     }, {});
    // }, [stats, jobPostings]);
    // Calculate total pages if needed (stats.totalPostings / pageSize)
    const totalPages = stats?.totalPostings
        ? Math.ceil(stats.totalPostings / pageSize)
        : undefined;

    // When filters change, reset to page 1 and clear cache
    useEffect(() => {
        if (searchTerm || (selectedTech && selectedTech !== '__all__')) {
            setPageIndex(1);
            // Note: With server-side pagination, client-side filtering only affects the current page
            // For true filtered pagination, you'd need to implement server-side filtering
        }
    }, [searchTerm, selectedTech]);

    // ---------- fetchPage helper (sequentially fetches pages until requested page exists) ----------
    const fetchPage = async (page: number) => {
        console.log(`🔍 fetchPage called with page ${page}, current pageIndex: ${pageIndex}`);

        if (page < 1) return;

        // quick path: if cached, just set pageIndex
        const cached = queryClient.getQueryData<{ pages: Page[] }>(queryKey);
        if (cached?.pages && cached.pages.length >= page) {
            console.log(`✅ Page ${page} is cached, setting pageIndex`);
            setPageIndex(page);
            return;
        }

        try {
            setError(null);

            // how many pages are currently cached
            let currentPages = cached?.pages?.length ?? pages.length ?? 0;
            console.log(`📊 Currently cached pages: ${currentPages}, need to get to page ${page}`);

            // trigger initial fetch if nothing is present
            if (currentPages === 0 && !data) {
                console.log(`🔄 No data cached, triggering initial refetch`);
                await refetch();
                const afterRefetch = queryClient.getQueryData<{ pages: Page[] }>(queryKey);
                currentPages = afterRefetch?.pages?.length ?? 0;
            }

            // sequentially fetch next pages (cursor pagination requires sequential loads)
            while (currentPages < page) {
                const after = queryClient.getQueryData<{ pages: Page[] }>(queryKey);
                const lastPg = after?.pages?.[currentPages - 1];
                const lastKey = lastPg?.lastKey;
                console.log(`🔄 Fetching page ${currentPages + 1}, lastKey: ${lastKey ? 'present' : 'null'}`);

                if (!lastKey && currentPages !== 0) {
                    console.log(`⚠️ No lastKey and currentPages > 0, stopping pagination`);
                    break; // no more pages
                }
                // fetch the next page (await to sequence)
                await fetchNextPage();
                const afterNext = queryClient.getQueryData<{ pages: Page[] }>(queryKey);
                const newCount = afterNext?.pages?.length ?? currentPages;
                if (newCount === currentPages) {
                    console.log(`⚠️ No new pages added, stopping pagination`);
                    // nothing added (no next token) — avoid infinite loop
                    break;
                }
                console.log(`✅ New page fetched, now have ${newCount} pages`);
                currentPages = newCount;
            }

            const finalPages = queryClient.getQueryData<{ pages: Page[] }>(queryKey)?.pages?.length ?? 0;
            console.log(`📊 Final page count: ${finalPages}, setting pageIndex to ${finalPages >= page ? page : Math.max(1, finalPages)}`);

            if (finalPages >= page) {
                setPageIndex(page);
            } else {
                setPageIndex(Math.max(1, finalPages));
            }
        } catch (err) {
            console.error(`❌ Error in fetchPage:`, err);
            setError(err instanceof Error ? err.message : 'Failed to load job postings');
        }
    };

    // initial load & reload on pageSize change
    useEffect(() => {
        fetchPage(1).catch(() => { });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSize]);

    // prefetch next page after current successful load (snappier UX)
    useEffect(() => {
        if (!currentPage) return;
        if (currentPage.lastKey) {
            fetchNextPage().catch(() => { });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage?.items?.length, currentPage?.lastKey]);

    // ---------- UI (keeps your original branches) ----------
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

    const PaginationControls = (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }} />

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                <Button
                    onClick={() => fetchPage(Math.max(1, pageIndex - 1))}
                    disabled={pageIndex === 1 || rqIsLoading || isFetchingNextPage}
                >
                    Prev
                </Button>
                <div>
                    Page {pageIndex}
                    {totalPages ? ` of ~${totalPages}` : ''}
                </div>
                <Button
                    onClick={() => fetchPage(pageIndex + 1)}
                    disabled={!currentPage?.lastKey || isFetchingNextPage || rqIsLoading}
                >
                    {isFetchingNextPage ? 'Loading...' : 'Next'}
                </Button>
            </div>

            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                <div style={{ fontSize: 13, color: '#666', marginRight: 8 }}>Results per page</div>
                <Select
                    value={String(pageSize)}
                    onValueChange={(v) => {
                        setPageIndex(1);
                        setPageSize(Number(v));
                        // clear cached pages for this key so react-query refetches with new pageSize
                        queryClient.removeQueries({ queryKey });
                    }}
                >
                    <SelectTrigger className="tech-filter" style={{ width: 120 }}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );

    return (
        <>
            {/* Filters */}
            <div className="filters-section">
                {/* Note: Client-side filtering only works on the current page with server-side pagination */}
                {/* For true filtered results across all pages, implement server-side filtering */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
                    <Label htmlFor="search-input" className="label-inline">
                        Search (current page only)
                    </Label>
                    <Input
                        id="search-input"
                        placeholder="Search by title, skill, or technology..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>

                {/* <Select value={selectedTech} onValueChange={(v) => setSelectedTech(v)}>
                    <SelectTrigger className="tech-filter">
                        <SelectValue placeholder="All Technologies" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__all__">All Technologies</SelectItem>
                        {Object.keys(techCounts)
                            .sort()
                            .map((tech) => (
                                <SelectItem key={tech} value={tech}>
                                    {tech} ({techCounts[tech]})
                                </SelectItem>
                            ))}
                    </SelectContent>
                </Select> */}

                {(searchTerm || (selectedTech && selectedTech !== '__all__')) && (
                    <Button
                        variant="outline"
                        className="text-white"
                        onClick={() => {
                            setSearchTerm('');
                            setSelectedTech('__all__');
                        }}
                    >
                        Clear Filters
                    </Button>
                )}
            </div>

            {/* Results */}

            {/* Top Pagination */}
            {PaginationControls}

            {/* Job Postings Card */}
            <div className="post-list-card">
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
            </div>

            <div className="results-info">
                Showing {jobPostings.length} job postings (page {pageIndex})
                {typeof stats?.totalPostings === 'number' ? ` — Total: ${stats.totalPostings}` : null}
            </div>
            {PaginationControls}
        </>
    );
};

export default JobPostingsSection;