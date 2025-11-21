import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { TechnologyStatItem } from '@job-market-analyzer/types';
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
    SelectLabel,
    SelectGroup,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { TechSearchCombobox, type TechSearchValue } from '@/components/postings/TechSearchCombobox';

export type WorkModeFilter = "remote" | "hybrid" | "onsite";
export type SeniorityLevelFilter = "junior" | "mid" | "senior" | "lead";

export type JobPostingsFilters = TechSearchValue & {
    workModes: WorkModeFilter[];
    seniorityLevels: SeniorityLevelFilter[];
};

const WORK_MODE_OPTIONS: { label: string; value: WorkModeFilter }[] = [
    { label: "Remote", value: "remote" },
    { label: "Hybrid", value: "hybrid" },
    { label: "On-Site", value: "onsite" },
];

const SENIORITY_OPTIONS: { label: string; value: SeniorityLevelFilter }[] = [
    { label: "Junior", value: "junior" },
    { label: "Mid", value: "mid" },
    { label: "Senior", value: "senior" },
    { label: "Lead", value: "lead" },
];

export interface JobPostingsControlsProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    searchPlaceholder?: string;
    filters: JobPostingsFilters;

    selectedTech: string;
    onTechChange: (value: string) => void;
    techCounts?: TechnologyStatItem[] | undefined;

    pageIndex: number;
    totalPages?: number;
    pageSize: number;
    pageSizeOptions?: number[];
    onPageSizeChange: (size: number) => void;

    onPreviousPage: () => void;
    onNextPage: () => void;

    isPreviousDisabled: boolean;
    isNextDisabled: boolean;
    isLoading?: boolean;
    nextButtonLabel?: string;

    onClearFilters: () => void;
    showClearFilters: boolean;
    onFiltersCommit: (next: JobPostingsFilters) => void;
}

export const JobPostingsControls: React.FC<JobPostingsControlsProps> = ({

    filters: externalFilters,
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
    const [filters, setFilters] = useState<JobPostingsFilters>(externalFilters);

    React.useEffect(() => {
        setFilters(externalFilters);
    }, [externalFilters]);

    const commitFilters = React.useCallback(
        (updater: (prev: JobPostingsFilters) => JobPostingsFilters) => {
            setFilters((prev) => {
                const next = updater(prev);
                onFiltersCommit(next);
                return next;
            });
        },
        [onFiltersCommit]
    );

    const handleCommit = React.useCallback(
        (next: TechSearchValue) => {
            commitFilters((prev) => ({ ...prev, ...next }));
        },
        [commitFilters]
    );

    const handleWorkModeToggle = React.useCallback(
        (mode: WorkModeFilter, checked: boolean | "indeterminate") => {
            commitFilters((prev) => {
                const withoutMode = prev.workModes.filter((m) => m !== mode);
                const shouldAdd = checked === true;
                const workModes = shouldAdd ? [...withoutMode, mode] : withoutMode;
                return { ...prev, workModes };
            });
        },
        [commitFilters]
    );

    const handleSeniorityToggle = React.useCallback(
        (level: SeniorityLevelFilter, checked: boolean | "indeterminate") => {
            commitFilters((prev) => {
                const withoutLevel = prev.seniorityLevels.filter((l) => l !== level);
                const shouldAdd = checked === true;
                const seniorityLevels = shouldAdd ? [...withoutLevel, level] : withoutLevel;
                return { ...prev, seniorityLevels };
            });
        },
        [commitFilters]
    );

    const PaginationControls = (
        <div className="lg:grid lg:grid-cols-3 flex flex-col items-center gap-3 py-3 pagination-container justify-center">
            {/* Navigation controls - centered */}
            <div className="flex items-center gap-3 justify-center lg:col-start-2">
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
                    <p style={{ margin: "auto 0" }} className="align-middle items-center">
                        {`Page ${pageIndex} `}
                        {totalPages ? <span className="text-xs ml-2">{` of ${totalPages}`}</span> : null}</p>
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
            <div className="flex items-center gap-3 lg:col-start-3">
                <SelectGroup className="inline-flex items-center gap-2">
                    <SelectLabel className="text-sm text-foreground whitespace-nowrap">Results per page</SelectLabel>

                    <Select
                        value={String(pageSize)}
                        onValueChange={(v) => onPageSizeChange(Number(v))}
                    >
                        <SelectTrigger
                            aria-label="Select Page Size"
                            style={{ padding: "0 0 0 1rem", border: "1px solid black" }}
                            className="w-20 rounded-md text-sm font-medium bg-transparent border border-black px-3 py-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-400/20"
                        >
                            <SelectValue />
                        </SelectTrigger>

                        <SelectContent style={{ maxWidth: "calc(var(--spacing) * 20)" }} className="bg-slate-800 text-white rounded-md shadow-lg w-20">
                            {pageSizeOptions.map((size) => (
                                <SelectItem style={{ padding: "0 0 0 .5rem" }} key={size} value={String(size)}>
                                    {size}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </SelectGroup>
            </div>
        </div>
    );

    return (
        <>
            {/* Filters Section */}

            <div style={{ padding: "1rem 0 0 0" }} className="w-full">
                <div className="w-full grid gap-6 lg:grid-cols-3">
                    <div className="col-span-1 lg:col-span-2 lg:col-start-3 flex flex-col gap-4">
                        <div>
                            <p className="text-xs uppercase tracking-wide text-foreground mb-2">
                                Work Arrangement
                            </p>
                            <div className="flex flex-wrap gap-4" role="group" aria-label="Work arrangement filters">
                                {WORK_MODE_OPTIONS.map((option) => {
                                    const checkboxId = `work-mode-${option.value}`;
                                    return (
                                        <div key={option.value} className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                                            <Checkbox
                                                id={checkboxId}
                                                className="bg-stone-600"
                                                checked={filters.workModes.includes(option.value)}
                                                onCheckedChange={(checked) => handleWorkModeToggle(option.value, checked)}
                                            />
                                            <label htmlFor={checkboxId}>{option.label}</label>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <p className="text-xs uppercase tracking-wide text-foreground/60 mb-2">
                                Seniority Level
                            </p>
                            <div className="flex flex-wrap gap-4" role="group" aria-label="Seniority level filters">
                                {SENIORITY_OPTIONS.map((option) => {
                                    const checkboxId = `seniority-${option.value}`;
                                    return (
                                        <div key={option.value} className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                                            <Checkbox
                                                id={checkboxId}
                                                className="bg-stone-600"
                                                checked={filters.seniorityLevels.includes(option.value)}
                                                onCheckedChange={(checked) => handleSeniorityToggle(option.value, checked)}
                                            />
                                            <label htmlFor={checkboxId}>{option.label}</label>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div>
                            <TechSearchCombobox
                                value={filters}
                                className="w-full"
                                onChange={(next) => setFilters((prev) => ({ ...prev, ...next }))}
                                onCommit={handleCommit}
                                options={techCounts.map(t => ({ value: t.name ?? t.id, label: t.name ?? t.id, count: t.count }))}
                                widthClass="w-full sm:w-[360px]"
                                contentWidthClass="w-full sm:w-[360px]"
                            />
                        </div>
                    </div>
                    <div className="col-span-1 lg:col-start-5 flex w-full justify-start lg:justify-end mb-4 lg:mb-0">

                    </div>
                </div>
            </div>
            {/* Top Pagination */}
            {PaginationControls}
        </>
    );
};
