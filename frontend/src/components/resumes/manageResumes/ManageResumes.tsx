// src/components/resumes/manageResumes/ManageResumes.tsx
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getUserResumes } from "@/services/resumeService";
import { useAuthUser } from "@/stores/authStore";
import type { GetUserResumesResponse, ResumeRecord } from "@job-market-analyzer/types";

import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";



import { ResumeCard } from "./ResumeCard";
import { H2 } from "@/components/ui/typography";

function sortByUploadedAtDesc(a: ResumeRecord, b: ResumeRecord) {
    const ta = a.uploadedAt ? Date.parse(a.uploadedAt) : 0;
    const tb = b.uploadedAt ? Date.parse(b.uploadedAt) : 0;
    return tb - ta;
}

export const ManageResumes = () => {
    const user = useAuthUser();
    const userId = user?.userId ?? "";
    const [index, setIndex] = useState(0); // current visible resume (0-based)

    const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
        queryKey: ["get-user-resumes", userId],
        enabled: !!userId,
        queryFn: () => getUserResumes(userId),
        staleTime: 5 * 60 * 1000,
        gcTime: 60 * 60 * 1000,
        retry: 1,
        select: (raw: GetUserResumesResponse) => {
            const items = [...(raw.items ?? [])].sort(sortByUploadedAtDesc);
            return { ...raw, items };
        },
    });

    // Flatten + guards
    const items = data?.items ?? [];
    const total = items.length;
    const current = items[index];

    // Keep index in bounds when data refetches/changes
    useEffect(() => {
        if (index > total - 1) setIndex(Math.max(total - 1, 0));
    }, [total, index]);

    // Keyboard navigation (← →)
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
            if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, Math.max(total - 1, 0)));
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [total]);

    // Build Select options (originalFileName with SK fallback for uniqueness)
    const selectOptions = useMemo(
        () =>
            items.map((r, i) => ({
                value: String(i),
                label: r.originalFileName ?? r.SK ?? `Resume ${i + 1}`,
            })),
        [items]
    );

    if (!userId) {
        return <div className="p-6 text-sm text-muted-foreground">You must be logged in.</div>;
    }

    if (isLoading) {
        return (
            <div className="w-full flex justify-center items-center py-10">
                <Skeleton className="h-[50vh] w-full max-w-5xl flex items-center justify-center">
                    <Spinner className="size-14" />
                </Skeleton>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="p-6 space-y-3">
                <div className="text-red-600 font-medium">Failed to load resumes.</div>
                <Button variant="secondary" onClick={() => refetch()} disabled={isFetching}>
                    {isFetching ? "Refreshing…" : "Try again"}
                </Button>
                <pre className="mt-2 text-xs opacity-70">{String(error)}</pre>
            </div>
        );
    }

    if (total === 0) {
        return (
            <div className="p-6">
                <div className="rounded-xl border p-8 text-center text-muted-foreground">
                    No resumes yet. Upload your first resume to see it here.
                </div>
            </div>
        );
    }

    // Pagination helpers (client-side, pageSize = 1)
    // const page = index + 1;
    // const totalPages = total;
    const canPrev = index > 0;
    const canNext = index < total - 1;
    const goPrev = () => canPrev && setIndex((i) => i - 1);
    const goNext = () => canNext && setIndex((i) => i + 1);
    // const goPage = (p: number) => setIndex(Math.min(Math.max(p - 1, 0), total - 1));

    return (
        <div className="w-full mx-auto p-4 sm:p-6 md:p-8">
            {/* Header / Controls */}
            <div className="flex gap-4 flex-col items-center justify-between">
                <div className="flex items-center gap-3">
                    <H2 className="text-xl sm:text-2xl font-semibold" text={"Manage Resumes"} underline={false} />
                    <span className="text-sm text-muted-foreground items-center">({total} total)</span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Quick jump by filename */}
                    <Select value={String(index)} onValueChange={(v) => setIndex(Number(v))}>
                        <SelectTrigger style={{ padding: "0 0.5rem" }} className="w-56">
                            <SelectValue placeholder="Select resume…" />
                        </SelectTrigger>
                        <SelectContent style={{ padding: "1rem" }} className="p-12">
                            {selectOptions.map((opt) => (
                                <SelectItem style={{ margin: "1rem 0" }} key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="flex items-center gap-2">
                        <Button style={{ padding: "1rem" }} variant="outline" onClick={goPrev} disabled={!canPrev} aria-label="Previous resume">
                            Prev
                        </Button>
                        {/* <Button style={{ padding: "1rem" }} variant="outline" onClick={() => refetch()} disabled={isFetching}>
                            {isFetching ? "Refreshing…" : "Refresh"}
                        </Button> */}
                        <Button style={{ padding: "1rem" }} onClick={goNext} disabled={!canNext} aria-label="Next resume">
                            Next
                        </Button>
                    </div>
                </div>
            </div>

            {/* Single-card viewport */}
            <div className="mt-6" style={{ margin: ".25rem 0" }}>
                <ResumeCard key={current?.SK} resume={current} />
            </div>

            {/* Pagination footer (client-side) */}

        </div >
    );
};
