import React from 'react';
import { Layout } from '../components/Layout';
import { Card, CardContent } from '@/components/ui/card';

const Feature: React.FC<{ title: string; children: React.ReactNode; icon?: React.ReactNode; }>
    = ({ title, children, icon }) => (
        <Card className="h-full hover:shadow-md transition-shadow">
            <CardContent className="pt-4">
                <div className="flex items-start gap-3 mb-2">
                    {icon && <div className="text-primary mt-1">{icon}</div>}
                    <h3 className="text-base font-semibold tracking-tight">{title}</h3>
                </div>
                <div className="text-sm leading-relaxed text-muted-foreground">{children}</div>
            </CardContent>
        </Card>
    );

const About: React.FC = () => {
    return (
        <Layout>
            {/* Hero */}
            <section className="relative mb-12 mt-4">
                <div className="relative z-10">
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent text-center">
                        About TrendDev
                    </h1>
                    <div className="text-xs text-muted-foreground mb-4 text-center">Project started: <time dateTime="2025-10-03">October 3, 2025</time></div>
                    <p className="max-w-3xl mx-auto text-base sm:text-lg text-gray-600 dark:text-gray-300 leading-relaxed text-center">
                        TrendDev turns raw job postings into structured, queryable insights. It surfaces trending skills,
                        salary signals, co-occurrence networks and geographic or seniority-based demand so developers, teams and learners
                        can make sharper career and hiring decisions.
                    </p>
                </div>
                <div className="absolute inset-y-0 right-0 -z-0 opacity-20 blur-2xl pointer-events-none bg-gradient-to-bl from-indigo-300 via-sky-200 to-transparent rounded-full w-72 h-72" />
            </section>

            {/* Core Features */}
            <section className="mb-14">
                <h2 className="text-xl font-semibold mb-4 tracking-tight text-center">Core Capabilities</h2>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    <Feature title="Skill Trend Discovery">
                        Aggregates frequency counts over time and regions; sparkline & bar charts show demand shifts and adjacent skill clusters.
                    </Feature>
                    <Feature title="Co‑occurring Skill Graph">
                        Extracted skill relationships highlight realistic learning paths and stack complementarities.
                    </Feature>
                    <Feature title="Compensation Signals">
                        Normalizes and averages salary ranges when present; displays quick median-like approximations for comparison.
                    </Feature>
                    <Feature title="Role & Seniority Parsing">
                        Lightweight heuristics categorize seniority and role context to refine demand analysis beyond raw counts.
                    </Feature>
                    <Feature title="Remote vs On‑site Insight">
                        Tracks remote percentage to help evaluate distributed friendliness of stacks and roles.
                    </Feature>
                    <Feature title="Fast Exploration UI">
                        Vite + React + Recharts + Tailwind deliver a responsive experience with instant filtering and detail drill‑down.
                    </Feature>
                </div>
            </section>

            {/* Data Pipeline */}
            <section className="mb-14">
                <h2 className="text-xl font-semibold mb-4 tracking-tight text-center">Data Pipeline Overview</h2>
                <div className="grid gap-6 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardContent className="pt-5 space-y-4 text-sm leading-relaxed">
                            <ol className="list-decimal list-inside space-y-2">
                                <li><strong>Ingestion:</strong> Lambda functions fetch & normalize raw postings (HTML / JSON sources).</li>
                                <li><strong>Extraction:</strong> Rule + AI hybrid skill extractor identifies canonical skill tokens.</li>
                                <li><strong>Aggregation:</strong> Daily batch reduces postings into trend rows keyed by skill, region, seniority.</li>
                                <li><strong>Enrichment:</strong> Co‑occurrence maps & salary signals added where available.</li>
                                <li><strong>API Layer:</strong> Lightweight fetch endpoints consumed by the React frontend.</li>
                            </ol>
                            <p className="text-muted-foreground">
                                The pipeline favors transparency & reproducibility over opaque scoring. Wherever approximations exist (e.g. salary merging) we aim to surface raw-ish derived values rather than hidden indices.
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-5 text-sm space-y-3">
                            <div>
                                <h3 className="font-semibold text-sm mb-1 text-center">Stack</h3>
                                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                    <li>AWS Lambda (ingestion & aggregation)</li>
                                    <li>TypeScript throughout</li>
                                    <li>React + Vite frontend</li>
                                    <li>Recharts for data viz</li>
                                    <li>Tailwind for utility styling</li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm mb-1 text-center">Data Principles</h3>
                                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                    <li>Deterministic transforms first</li>
                                    <li>Lightweight, reviewable heuristics</li>
                                    <li>Minimal caching; recompute cheap artifacts</li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Methodology */}
            <section className="mb-14">
                <h2 className="text-xl font-semibold mb-4 tracking-tight text-center">Methodology & Caveats</h2>
                <Card>
                    <CardContent className="pt-5 space-y-4 text-sm leading-relaxed text-muted-foreground">
                        <p>Counts reflect observed postings containing a token, not holistic labor market demand. Salary data is sparse and skewed: missing ranges default to omission rather than imputation. Seniority classification uses regex + keyword proximity (e.g. <em>senior</em>, <em>lead</em>, <em>junior</em>) and may misclassify hybrid phrasing.</p>
                        <p>Use trends directionally. Always combine with qualitative research, company-level nuance, and your own career context.</p>
                    </CardContent>
                </Card>
            </section>

            {/* Roadmap */}
            <section className="mb-14">
                <h2 className="text-xl font-semibold mb-4 tracking-tight text-center">Roadmap</h2>
                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardContent className="pt-5 text-sm space-y-3">
                            <h3 className="font-semibold text-center">Planned</h3>
                            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                <li>Geo heat maps</li>
                                <li>Stack composition similarity explorer</li>
                                <li>Pagination & saved views</li>
                                <li>Downloadable CSV snapshots</li>
                            </ul>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-5 text-sm space-y-3">
                            <h3 className="font-semibold text-center">Longer Term</h3>
                            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                <li>ML-based skill normalization</li>
                                <li>Salary range percentile banding</li>
                                <li>Time-series anomaly flagging</li>
                                <li>API keys & external access</li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Contact */}
            <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4 tracking-tight text-center">Contact & Feedback</h2>
                <Card>
                    <CardContent className="pt-5 text-sm text-muted-foreground leading-relaxed">
                        <p>Have suggestions, spot inaccuracies, or want to collaborate? Open an issue or submit a PR. Thoughtful critique is welcome—this project improves when assumptions are challenged.</p>
                    </CardContent>
                </Card>
            </section>
        </Layout>
    );
};

export default About;
