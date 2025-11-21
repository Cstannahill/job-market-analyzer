import React from "react";
import { Layout } from "../components/Layout";
import Seo from '@/components/Seo';
import { Card, CardContent } from "@/components/ui/card";
import { PipelineWithDiagram } from "@/components/about/PipelineTimeline";
import { StackPanel } from "@/components/about/StackPanel";
import { RoadmapGrid } from "@/components/about/RoadmapGrid";
import FeatureCard from "@/components/about/FeatureCard";
import FeatureHero from "@/components/about/FeatureHero";
import SectionCard from "@/components/about/SectionCard";


const About: React.FC = () => {
    return (
        <Layout>
            <Seo
                title="About – Job Market Analyzer"
                description="Learn how Job Market Analyzer collects, processes, and exposes job-skill trend data."
                path="about"
                image="/public/og/about.avif"
            />
            {/* Hero Section */}
            <section className="relative overflow-hidden py-20 text-center">
                <FeatureHero />
            </section>

            {/* Core Capabilities */}

            <SectionCard title="Core Capabilities">
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    <FeatureCard
                        title="Skill Trend Discovery"
                        description="Aggregates frequency counts across time and regions — sparkline & bar charts reveal demand shifts and emerging technologies."
                    />
                    <FeatureCard
                        title="Co-occurring Skill Graph"
                        description="Extracted relationships between skills highlight realistic learning paths and stack complementarities."
                    />
                    <FeatureCard
                        title="Compensation Signals"
                        description="Parses salary ranges where available to estimate normalized averages and median-like indicators."
                    />
                    <FeatureCard
                        title="Role & Seniority Parsing"
                        description="Lightweight heuristics classify job levels and context, refining insights beyond raw keyword counts."
                    />
                    <FeatureCard
                        title="Remote vs On-site Insight"
                        description="Tracks remote percentage and location trends to assess distributed-friendliness in the industry."
                    />
                    <FeatureCard
                        title="Fast Exploration UI"
                        description="React + Vite + Recharts + Tailwind deliver a fast, modern data-driven browsing experience."
                    />
                </div>
            </SectionCard>


            {/* Data Pipeline Overview */}
            <SectionCard title="Data Pipeline Overview">

                <div className="grid gap-6">
                    <div className="w-full">
                        <PipelineWithDiagram
                            steps={[
                                { title: "Ingestion", description: "Serverless jobs fetch and normalize postings (HTML / JSON sources)." },
                                { title: "Extraction", description: "Hybrid rule + AI extractor identifies canonical skill tokens." },
                                { title: "Aggregation", description: "Daily batch reduces postings into trend tables by skill, region, and seniority." },
                                { title: "Enrichment", description: "Co-occurrence and salary signals integrated where present." },
                                { title: "API Layer", description: "Lightweight endpoints deliver trend data to the frontend." },
                            ]}
                        />
                    </div>

                    <div className="w-full lg:flex lg:justify-center lg:items-start lg:gap-6">
                        <div className="lg:w-2/3 xl:w-1/2">
                            <StackPanel
                                stackItems={[
                                    { name: "AWS Lambda", iconPath: "/icons/lambda.svg", type: "backend" },
                                    { name: "React (Vite)", iconPath: "/icons/react.svg", type: "frontend" },
                                    { name: "Tailwind CSS", iconPath: "/icons/tailwind.svg", type: "frontend" },
                                    { name: "TypeScript", iconPath: "/icons/typescript.svg", type: "frontend" },
                                    { name: "Vite", iconPath: "/icons/vite-m.svg", type: "frontend" },
                                    { name: "DynamoDB", iconPath: "/icons/dynamodb.svg", type: "storage" },
                                    { name: "API Gateway", iconPath: "/icons/api-gateway.svg", type: "backend" },
                                    { name: "S3", iconPath: "/icons/s3.svg", type: "storage" },
                                    { name: "EventBridge", iconPath: "/icons/eventbridge.svg", type: "backend" },
                                    { name: "CloudWatch", iconPath: "/icons/cloudwatch.svg", type: "backend" },
                                ]}
                                principles={[
                                    "Deterministic transforms first",
                                    "Lightweight, reviewable heuristics",
                                    "Minimal caching → cheap recompute",
                                ]}
                            />
                        </div>
                    </div>
                </div>
            </SectionCard>

            {/* Roadmap */}
            <SectionCard title="Roadmap">
                <RoadmapGrid
                    columns={2}
                    items={[
                        {
                            title: "Planned",
                            bullets: ["Geo heat maps", "Stack similarity explorer", "Pagination & saved views", "Downloadable CSV snapshots"],
                            status: "planned",
                        },
                        {
                            title: "Longer-Term",
                            bullets: ["ML-based skill normalization", "Salary percentile banding", "Time-series anomaly flagging", "Public API access"],
                            status: "in-progress",
                            progress: 12,
                        },
                    ]}
                />
            </SectionCard>
            {/* Methodology */}
            <SectionCard title="Methodology & Limitations">
                <Card className="bg-card/60 border border-border/60 backdrop-blur-sm">
                    <CardContent className="p-6 text-sm text-muted-foreground space-y-4 leading-relaxed">
                        <p>
                            Counts reflect postings containing a token, not the entire labor market. Salary data is sparse
                            and skewed — missing values are omitted rather than imputed. Seniority classification relies on
                            regex + keyword proximity (e.g., “senior”, “lead”, “junior”) and may misclassify hybrid
                            phrasing.
                        </p>
                        <p>
                            Interpret trends directionally and pair them with qualitative research and personal context for
                            best results.
                        </p>
                    </CardContent>
                </Card>
            </SectionCard>

            {/* Contact */}
            <SectionCard title="Contact & Contributions">
                <Card className="bg-card/60 border border-border/60 backdrop-blur-sm">
                    <CardContent className="p-6 text-sm text-muted-foreground leading-relaxed text-center">
                        <p>
                            Have suggestions or spot inaccuracies? Open an issue or submit a PR — thoughtful critique and
                            collaboration make this project better.
                        </p>
                    </CardContent>
                </Card>
            </SectionCard>
        </Layout>
    );
};

export default About;
