import React, { type CSSProperties } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import type { BaseJobListing } from '@/shared-types';
import { ExternalLink, MapPin, Briefcase, DollarSign, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MetaPillContainer } from '@/components/postings/MetaPillContainer';
import { cn } from '@/lib/utils';
import { Layout } from '@/components/Layout';
import CompanyBadgeSvgr from '@/components/postings/CompanyBadgeSvgr';
import TechBadgeSvgr from '@/components/postings/TechBadgeSvgr';
import { hasTechIcon } from '@/lib/utils/techBadgeHelpers';

type LocationState = {
    posting?: BaseJobListing;
};

const Panel: React.FC<{ title: string; children: React.ReactNode; className?: string, style?: CSSProperties }> = ({ title, children, className, style }) => (
    <div style={style} className={cn("rounded-xl border border-stone-700/50 bg-linear-to-br from-stone-900/60 via-zinc-900/50 to-neutral-950/60 p-6 shadow-lg backdrop-blur-sm", className)}>
        <h3 className="mb-4 text-lg font-bold text-white/90 uppercase tracking-wider border-b border-white/10 pb-2">{title}</h3>
        {children}
    </div>
);

const TagGrid: React.FC<{ items: string[]; variant?: "primary" | "secondary" }> = ({ items, variant = "primary" }) => (
    <div className="flex flex-wrap gap-2">
        {items.map((item, index) => (
            <Badge
                style={{ padding: ".25rem .75rem" }}
                key={`${item}-${index}`}
                variant={variant === "primary" ? "default" : "secondary"}
                className={cn(
                    "rounded-md px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all hover:scale-105",
                    variant === "primary"
                        ? "bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 hover:bg-indigo-600/40"
                        : "bg-slate-800/60 text-white/80 border border-slate-700/50 hover:bg-slate-700/60"
                )}
            >
                {item.slice(0, 30)}
            </Badge>
        ))}
    </div>
);

const InfoCard: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; style: CSSProperties }> = ({ icon, label, value, style }) => (
    <div style={style} className="flex items-start gap-3 rounded-lg bg-linear-to-br from-slate-900/40 to-stone-900/40 p-4 border border-white/5">
        <div className="mt-0.5 text-indigo-400">{icon}</div>
        <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wider text-white/50 mb-1">{label}</p>
            <div className="font-semibold text-white/90 wrap-break-word">{value || 'Not specified'}</div>
        </div>
    </div>
);

const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
};

const JobPostingDetail: React.FC = () => {
    const { jobId } = useParams<{ jobId: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const posting = (location.state as LocationState | undefined)?.posting;

    if (!posting || (jobId && posting.jobId !== jobId)) {
        return (
            <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-6 px-4 text-center text-white/90">
                <p className="text-lg font-semibold">We couldn't find that posting.</p>
                <Button onClick={() => navigate('/postings')} variant="default">
                    Back to Postings
                </Button>
            </div>
        );
    }

    const sourceLink = posting.source_url && posting.source_url.trim() !== '' ? (
        <a
            href={posting.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-indigo-300 underline underline-offset-2 hover:text-indigo-200 transition-colors"
        >
            <ExternalLink className="h-4 w-4 shrink-0" />
            <span className="break-all">View original posting</span>
        </a>
    ) : (
        'Unknown'
    );

    const techsWithIcons = posting.technologies?.filter(hasTechIcon) || [];

    return (
        <Layout>
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 text-white sm:px-6 lg:px-12">
                <div className="flex items-center justify-between">
                    <Button
                        variant="ghost"
                        className="text-white/80 hover:text-white hover:bg-white/10 transition-all"
                        onClick={() => navigate(-1)}
                    >
                        ← Back
                    </Button>
                    <Link to="/postings" className="text-sm text-indigo-400 hover:text-indigo-300 underline-offset-4 hover:underline transition-colors">
                        View all postings
                    </Link>
                </div>

                <Card style={{ padding: ".5rem .5rem" }} className="mx-auto w-full rounded-2xl border border-white/10 bg-linear-to-b from-stone-900/95 via-zinc-900/90 to-neutral-950/95 text-white shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-sm">
                    <CardContent className="space-y-8 p-8 lg:p-12">
                        {/* Header with Company Logo */}
                        <header className="space-y-6">
                            <div className="flex flex-col sm:flex-row items-start gap-6">
                                <div className="shrink-0">
                                    <CompanyBadgeSvgr
                                        className='text-white'
                                        name={posting.company_name.toLowerCase()}
                                        roundStyle="lg"
                                        size={80}
                                        hideLabel
                                    />       <p className="text-xl text-white/70 font-semibold">
                                        {posting.company_name.toProperCase()}
                                    </p>
                                </div>
                                <div className="flex-1 space-y-3">
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div className="space-y-2">

                                            <h1 className="text-4xl font-black leading-tight text-white lg:text-5xl">
                                                {posting.job_title.toProperCase()}
                                            </h1>

                                        </div>
                                        <div className="grid grid-cols-2 lg:grid-cols-7 justify-end">
                                            <div className='col-start-2 lg:col-start-7'>
                                                <MetaPillContainer posting={posting} date={formatDate(posting.processed_date)} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </header>

                        {/* Key Information Grid */}
                        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <InfoCard
                                style={{ padding: ".5rem .5rem" }}
                                icon={<DollarSign className="h-5 w-5" />}
                                label="Compensation"
                                value={posting.salary_range && posting.salary_range !== "Unknown" ? posting.salary_range : 'Not specified'}
                            />
                            <InfoCard
                                style={{ padding: ".5rem .5rem" }}
                                icon={<Briefcase className="h-5 w-5" />}
                                label="Seniority"
                                value={posting.seniority_level}
                            />
                            <InfoCard
                                style={{ padding: ".5rem .5rem" }}
                                icon={<MapPin className="h-5 w-5" />}
                                label="Location"
                                value={
                                    <div className="space-y-1">
                                        <div>{posting.location || 'Not specified'}</div>
                                        <Badge variant="secondary" className="bg-indigo-600/20 text-indigo-300 border-indigo-500/30 text-xs">
                                            {posting.remote_status || 'Not specified'}
                                        </Badge>
                                    </div>
                                }
                            />
                            <InfoCard
                                style={{ padding: ".5rem .5rem" }}
                                icon={<Building2 className="h-5 w-5" />}
                                label="Industry"
                                value={String(posting.industry).toProperCase()}
                            />
                        </section>

                        {/* Source Link */}
                        <div style={{ padding: ".5rem .5rem", margin: ".5rem 0" }}
                            className="flex items-center justify-between rounded-lg bg-linear-to-r from-indigo-900/20 to-purple-900/20 p-4 border border-indigo-500/20">
                            <span className="text-sm text-white/60 uppercase tracking-wide">{`Original Source:  ${posting.job_board_source}`}</span>
                            <div className="text-sm">{sourceLink}</div>
                        </div>

                        {/* Job Description */}
                        <Panel style={{ padding: ".5rem .5rem", margin: ".5rem 0" }}
                            title="Job Description" className="bg-linear-to-br from-stone-900/70 via-zinc-900/60 to-neutral-950/70">
                            <p className="whitespace-pre-line text-base leading-relaxed text-white/90">
                                {posting.job_description || 'No description provided.'}
                            </p>
                        </Panel>

                        {/* Technologies with Icons */}
                        {techsWithIcons.length > 0 && (
                            <Panel style={{ padding: ".5rem .5rem", margin: ".5rem 0" }}
                                title="Technologies & Skills" className="bg-linear-to-br from-indigo-950/30 via-stone-900/60 to-neutral-950/70">
                                <div className="flex flex-wrap gap-4">
                                    {techsWithIcons.map((tech, index) => (
                                        <div key={`${tech}-${index}`} className="flex flex-col items-center justify-around gap-2 p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                                            <TechBadgeSvgr name={tech} size={50} roundStyle='full' className="text-white" />
                                            {/* <span className="text-xs text-white/80 font-medium">{tech}</span> */}
                                        </div>
                                    ))}
                                </div>
                            </Panel>
                        )}

                        {/* All Technologies */}
                        {posting.technologies?.length ? (
                            <Panel style={{ padding: ".5rem .5rem", zIndex: "50", margin: ".5rem 0" }}
                                title="All Technologies" className="bg-linear-to-br from-stone-900/70 via-zinc-900/60 to-neutral-950/70">
                                <TagGrid items={posting.technologies} />
                            </Panel>
                        ) : null}

                        {/* Skills */}
                        {posting.skills?.length ? (
                            <Panel style={{ padding: ".5rem .5rem", zIndex: "75", margin: ".5rem 0" }}
                                title="Skills" className="bg-linear-to-br from-stone-900/70 via-zinc-900/60 to-neutral-950/70">
                                <TagGrid items={posting.skills} variant="secondary" />
                            </Panel>
                        ) : null}

                        {/* Requirements */}
                        {posting.requirements?.length ? (
                            <Panel style={{ padding: ".5rem .5rem" }}
                                title="Requirements" className="bg-linear-to-br from-stone-900/70 via-zinc-900/60 to-neutral-950/70">
                                <TagGrid items={posting.requirements} variant="secondary" />
                            </Panel>
                        ) : null}
                    </CardContent>
                </Card>
            </div>
        </Layout>
    );
};

export default JobPostingDetail;