import React, { type CSSProperties } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import type { BaseJobListing } from '@job-market-analyzer/types';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MetaPillContainer } from '@/components/postings/MetaPillContainer';
import { cn } from '@/lib/utils';
import { Layout } from '@/components/Layout';

type LocationState = {
    posting?: BaseJobListing;
};

const Panel: React.FC<{ title: string; children: React.ReactNode; className?: string, style?: CSSProperties }> = ({ title, children, className, style }) => (

    <div style={style} className={cn("rounded-xl border border-stone-500/75 bg-slate-900/70 p-6 shadow-inner", className)}>
        <h3 className="mb-3 text-xl font-semibold text-white">{title}</h3>
        {children}
    </div>
);

const TagGrid: React.FC<{ items: string[]; variant?: "primary" | "secondary" }> = ({ items, variant = "primary" }) => (
    <div className="flex flex-wrap gap-2 text-wrap">
        {items.map((item, index) => (
            <Badge
                style={{ padding: "0rem 1rem" }}
                key={`${item}-${index}`}
                variant={variant === "primary" ? "default" : "secondary"}
                className={cn(
                    "rounded-full px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-wrap overflow-x-clip",
                    variant === "primary"
                        ? "bg-indigo-500/20 text-indigo-100"
                        : "bg-slate-800/80 text-white/90"
                )}
            >
                {item.slice(0, 25)}
            </Badge>
        ))}
    </div>
);

const InfoRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="grid gap-2 text-sm text-white/80 sm:grid-cols-[160px_auto] lg:text-base">
        <span className="font-semibold uppercase tracking-wide text-white/40">{label}</span>
        <span className="font-semibold text-white wrap-word-break">{value || 'Unknown'}</span>
    </div>
);
const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const monthDay = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
    return monthDay;
};
const JobPostingDetail: React.FC = () => {
    const { jobId } = useParams<{ jobId: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const posting = (location.state as LocationState | undefined)?.posting;

    if (!posting || (jobId && posting.jobId !== jobId)) {
        return (
            <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-6 px-4 text-center text-white/90">
                <p className="text-lg font-semibold">We couldn’t find that posting.</p>
                <Button onClick={() => navigate('/postings')} variant="default">
                    Back to Postings
                </Button>
            </div>
        );
    }

    const companyName = posting.company_name ?? "Unknown company";

    const sourceLink =
        posting.source_url && posting.source_url.trim() !== '' ? (
            <a
                href={posting.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 break-all text-indigo-300 underline underline-offset-2 hover:text-indigo-100"
            >
                <ExternalLink className="h-4 w-4" />
                {posting.source_url}
            </a>
        ) : (
            'Unknown'
        );

    return (
        <Layout>
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 text-white sm:px-6 lg:px-12">
                <div className="flex items-center justify-between">
                    <Button variant="ghost" className="text-white hover:bg-white/10" onClick={() => navigate(-1)}>
                        ← Back
                    </Button>
                    <Link to="/postings" className="text-sm text-indigo-300 underline-offset-4 hover:underline">
                        View all postings
                    </Link>
                </div>

                <Card style={{ padding: "1rem 1rem" }} className="mx-auto w-full  rounded-xl border border-white/10 bg-linear-to-b from-stone-900/95 via-zinc-800/90 to-neutral-950/90 text-white shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
                    <CardContent className="space-y-8 p-6 lg:p-12">
                        <header className="space-y-4">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="space-y-2">
                                    <p className="text-xs uppercase tracking-[0.3em] text-white/60">
                                        Source: {posting.job_board_source || 'Unknown source'}
                                    </p>
                                    <h1 className="text-3xl font-black leading-tight text-white lg:text-4xl">
                                        {posting.job_title.toProperCase()}
                                    </h1>
                                </div>
                                <MetaPillContainer posting={posting} date={formatDate(posting.processed_date)} />
                            </div>

                            <div style={{ padding: ".5rem 1rem", margin: "1rem 0" }} className="flex flex-wrap items-center gap-3 text-sm text-white/80">
                                <span>{companyName.toProperCase()}</span>
                                <span className="text-white/40">·</span>
                                <span>{posting.location || 'Location unknown'}</span>
                                <span className="text-white/40">·</span>
                                <span>{posting.remote_status || 'Remote status unknown'}</span>
                                <span className="text-white/40">·</span>
                                <Badge variant="secondary" className="bg-white/10 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-wide text-white">
                                    {posting.industry || 'Industry unknown'}
                                </Badge>
                            </div>
                        </header>

                        <section style={{ padding: ".5rem 1rem", margin: "1rem 0" }} className="grid gap-4 rounded-3xl border border-white/5 bg-white/5/60 p-5 lg:grid-cols-2">
                            <InfoRow label="Seniority" value={posting.seniority_level || 'Unknown'} />
                            <InfoRow label="Compensation" value={posting.salary_range || 'Unknown'} />
                            <InfoRow label="Source" value={posting.job_board_source?.toProperCase() || 'Unknown'} />
                            <InfoRow label="Source URL" value={sourceLink} />
                        </section>

                        <Panel style={{ padding: ".5rem 1rem", margin: "1rem 0" }} title="Job Description" className="bg-linear-to-b from-stone-900/95 via-zinc-800/90 to-neutral-950/90">
                            <p className="whitespace-pre-line text-base leading-relaxed text-white/90">
                                {posting.job_description || 'No description provided.'}
                            </p>
                        </Panel>

                        {posting.requirements?.length ? (
                            <Panel style={{ padding: ".5rem 1rem", margin: ".5rem 0", textWrap: "balance" }} title="Requirements" className="bg-linear-to-b from-stone-900/95 via-zinc-800/90 to-neutral-950/90">
                                <TagGrid items={posting.requirements} variant="secondary" />
                            </Panel>
                        ) : null}

                        {posting.technologies?.length ? (
                            <Panel style={{ padding: ".5rem 1rem", margin: "0.5rem 0" }} title="Technologies" className="bg-linear-to-b from-stone-900/95 via-zinc-800/95 to-neutral-950/90">
                                <TagGrid items={posting.technologies} />
                            </Panel>
                        ) : null}

                        {posting.skills?.length ? (
                            <Panel style={{ padding: ".5rem 1rem", margin: "0.5rem 0" }} title="Skills" className="bg-linear-to-b from-stone-900/95 via-zinc-800/95 to-neutral-950/90">
                                <TagGrid items={posting.skills} variant="secondary" />
                            </Panel>
                        ) : null}
                    </CardContent>
                </Card>
            </div>
        </Layout>
    );
};

export default JobPostingDetail;
