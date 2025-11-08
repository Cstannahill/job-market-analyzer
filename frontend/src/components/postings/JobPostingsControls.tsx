import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { TechnologyStatItem } from '@/shared-types';
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/ui/select';
import { TechSearchCombobox, type TechSearchValue } from '@/components/postings/TechSearchCombobox';

export interface JobPostingsControlsProps {
    // Search state
    searchTerm: string;
    onSearchChange: (value: string) => void;
    searchPlaceholder?: string;

    // Technology filter state
    selectedTech: string;
    onTechChange: (value: string) => void;
    techCounts?: TechnologyStatItem[] | undefined;

    // Pagination state
    pageIndex: number;
    totalPages?: number;
    pageSize: number;
    pageSizeOptions?: number[];
    onPageSizeChange: (size: number) => void;

    // Pagination actions
    onPreviousPage: () => void;
    onNextPage: () => void;

    // Pagination control state
    isPreviousDisabled: boolean;
    isNextDisabled: boolean;
    isLoading?: boolean;
    nextButtonLabel?: string;

    // Clear filters
    onClearFilters: () => void;
    showClearFilters: boolean;
    onFiltersCommit: (next: TechSearchValue) => void;
}

export const JobPostingsControls: React.FC<JobPostingsControlsProps> = ({

    techCounts = [],
    pageIndex,
    totalPages,
    pageSize,
    pageSizeOptions = [10, 20, 50],
    onPageSizeChange,
    onPreviousPage,
    onNextPage,
    onFiltersCommit,
    isPreviousDisabled,
    isNextDisabled,
    // isLoading = false,
    nextButtonLabel = "Next",
}) => {
    const [filters, setFilters] = useState<TechSearchValue>({ tech: null, query: "" });

    const handleCommit = React.useCallback(
        (next: TechSearchValue) => {
            setFilters(next);
            onFiltersCommit(next);
        },
        [onFiltersCommit]
    );
    const PaginationControls = (
        <div className="flex flex-col sm:flex-row items-center gap-3 py-3 pagination-container justify-center">
            {/* Navigation controls - centered */}
            <div className="flex items-center gap-3 justify-center">
                <Button
                    onClick={onPreviousPage}
                    disabled={isPreviousDisabled}
                    aria-label="Previous page"
                    className="pagination-button px-3 py-1 rounded-lg text-sm font-semibold transition-transform transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-400/30 disabled:opacity-50 disabled:translate-y-0"
                >
                    Prev
                </Button>

                <div
                    className="relative px-4 py-1 rounded-lg text-sm font-semibold bg-white/5 ring-1 ring-white/6 shadow-sm flex items-center justify-center min-w-[120px]"
                    aria-live="polite"
                >
                    <span className="sr-only">Current page:</span>
                    {`Page ${pageIndex} `}
                    {totalPages ? <span className="text-xs ml-2">{` of ${totalPages}`}</span> : null}
                </div>

                <Button
                    onClick={onNextPage}
                    disabled={isNextDisabled}
                    aria-label="Next page"
                    className="pagination-button px-3 py-1 rounded-lg text-sm font-semibold transition-transform transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-400/30 disabled:opacity-50"
                >
                    {nextButtonLabel}
                </Button>
            </div>

            {/* Page size controls - centered below on mobile, beside on desktop */}
            <div className="flex items-center justify-center gap-3">
                <div className="text-sm text-white/60 whitespace-nowrap">Results per page</div>

                <Select
                    value={String(pageSize)}
                    onValueChange={(v) => onPageSizeChange(Number(v))}
                >
                    <SelectTrigger
                        className="w-20 rounded-md text-sm font-medium bg-transparent border border-white/10 px-3 py-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-400/20"
                    >
                        <SelectValue />
                    </SelectTrigger>

                    <SelectContent className="bg-slate-800 text-white rounded-md shadow-lg">
                        {pageSizeOptions.map((size) => (
                            <SelectItem key={size} value={String(size)}>
                                {size}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );

    return (
        <>
            {/* Filters Section */}


            <TechSearchCombobox
                value={filters}
                onChange={setFilters}
                onCommit={handleCommit}
                options={techCounts.map(t => ({ value: t.name ?? t.id, label: t.name ?? t.id, count: t.count }))}
                widthClass="w-[360px]"
            />

            {/* Top Pagination */}
            {PaginationControls}
        </>
    );
};