import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
    Accordion,
    AccordionItem,
    AccordionTrigger,
    AccordionContent,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Mail, FileText, CalendarClock, MapPin, FileType, Award, ChevronRight } from "lucide-react";
import type { ResumeRecord } from "@job-market-analyzer/types";
import Bullet from "@/assets/lists/24.svg";

// --- small helpers ---
const formatIso = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString() : "—";

const titleCase = (s: string) =>
    s.replace(/\b\w/g, (m) => m.toUpperCase());

const levelToPct = (level?: string) => {
    switch ((level ?? "").toLowerCase()) {
        case "advanced":
            return 90;
        case "intermediate":
            return 65;
        case "beginner":
            return 35;
        default:
            return 50;
    }
};

type Props = {
    resume: ResumeRecord;
    className?: string;
    // optional actions
    onOpenOriginal?: (s3Key: string) => void;
    onSetPrimary?: (resume: ResumeRecord) => void;
};

export function ResumeCard({
    resume,
    className,
    onOpenOriginal,
    onSetPrimary,
}: Props) {
    const {
        originalFileName,
        contentType,
        uploadedAt,
        updatedAt,
        contactInfo,
        education,
        experience,
        skills,
        insights,
    } = resume;

    const oneLine = insights?.summary?.oneLine;
    const threeLine = insights?.summary?.threeLine;
    const overallImpression = insights?.summary?.overallImpression;

    const techs = skills?.technologies ?? [];
    const softs = skills?.softSkills ?? [];
    const techBadges = techs.slice(0, 24); // keep it tidy on card
    const remainingTechCount = Math.max(techs.length - techBadges.length, 0);

    return (
        <Card style={{ padding: "2rem" }} className={cn("rounded-2xl shadow-sm border-muted w-full", className)}>
            <CardHeader className="p-5 sm:p-6">
                <div className="lg:flex lg:flex-col lg:gap-3 flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-sm lg:text-2xl lg:text-nowrap text-wrap">
                            {originalFileName ?? "Resume"}
                        </CardTitle>
                        <CardDescription className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground text-wrap lg:text-nowrap">
                            <span className="inline-flex items-center gap-1 flex-wrap">
                                <FileType className="size-4" />
                                {contentType ?? "—"}
                            </span>
                            <Separator orientation="vertical" className="h-4" />
                            <span className="inline-flex items-center gap-1">
                                <CalendarClock className="size-4" />
                                Uploaded: {formatIso(uploadedAt)}
                            </span>
                            {updatedAt && (
                                <>
                                    <Separator orientation="vertical" className="h-4" />
                                    <span className="inline-flex items-center gap-1">
                                        <CalendarClock className="size-4" />
                                        Updated: {formatIso(updatedAt)}
                                    </span>
                                </>
                            )}
                        </CardDescription>
                    </div>

                    <div className="flex gap-2">
                        {onOpenOriginal && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => resume.s3Key && onOpenOriginal(resume.s3Key)}
                            >
                                <FileText className="mr-2 size-4" />
                                Open Original
                            </Button>
                        )}
                        {onSetPrimary && (
                            <Button variant="default" size="sm" onClick={() => onSetPrimary(resume)}>
                                <ChevronRight className="mr-2 size-4" />
                                Use This
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>

            <Separator />

            <CardContent className="p-0">
                {/* Tabs: Overview / Experience / Insights */}
                <Tabs defaultValue="overview" className="w-full">
                    <div className="px-5 sm:px-6 pt-4">
                        <div className="w-full  overflow-x-auto lg:flex lg:justify-center">
                            <TabsList className="grid w-full grid-cols-5  min-w-[420px] flex-nowrap gap-2 lg:w-auto">
                                <TabsTrigger style={{ fontSize: "0.875rem", padding: "0 .875rem" }} className="text-sm lg:text-lg px-2" value="overview">Overview</TabsTrigger>
                                <TabsTrigger style={{ fontSize: "0.875rem", padding: "0 .875rem" }} className="text-sm lg:text-lg" value="experience">Experience</TabsTrigger>
                                <TabsTrigger style={{ fontSize: "0.875rem", padding: "0 .875rem" }} className="text-sm lg:text-lg" value="insights">Insights</TabsTrigger>
                                <TabsTrigger style={{ fontSize: "0.875rem", padding: "0 .875rem" }} className="text-sm lg:text-lg" value="salary">Salary</TabsTrigger>
                                <TabsTrigger style={{ fontSize: "0.875rem", padding: "0 .875rem" }} className="text-sm lg:text-lg" value="career">Career Path</TabsTrigger>
                            </TabsList>
                        </div>
                    </div>

                    {/* OVERVIEW */}
                    <TabsContent value="overview" className="mt-0">
                        <div className="px-1 lg:px-6 py-4 space-y-6">
                            {/* Summary */}
                            {(oneLine || threeLine) && (
                                <section>
                                    <h3 style={{ margin: "0.5rem 0" }} className="text-sm font-medium text-muted-foreground mb-2">Summary</h3>
                                    {oneLine && <p className="text-base leading-relaxed">{oneLine}</p>}
                                    {threeLine && (
                                        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                                            {threeLine}
                                        </p>
                                    )}
                                    {overallImpression && (
                                        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                                            {overallImpression}
                                        </p>
                                    )}
                                </section>
                            )}

                            {/* Contact */}
                            {(contactInfo?.email || contactInfo?.phone) && (
                                <>
                                    <Separator style={{ margin: "0.5rem 0" }} />
                                    <section className="grid gap-2">
                                        <h3 style={{ margin: "0.5rem 0" }} className="text-sm font-medium text-muted-foreground">Contact</h3>
                                        <div className="flex flex-wrap items-center gap-2 text-sm">
                                            {contactInfo?.email && (
                                                <a
                                                    href={`mailto:${contactInfo.email}`}
                                                    className="inline-flex items-center gap-2 hover:underline"
                                                >
                                                    <Mail className="size-4" />
                                                    {contactInfo.email}
                                                </a>
                                            )}
                                            {contactInfo?.phone && (
                                                <span className="inline-flex items-center gap-2">
                                                    <PhoneMini />
                                                    {contactInfo.phone}
                                                </span>
                                            )}
                                        </div>
                                    </section>
                                </>
                            )}

                            {/* Education */}
                            {education && education.length > 0 && (
                                <>
                                    <Separator style={{ margin: "0.5rem 0" }} />
                                    <section className="space-y-2">
                                        <h3 style={{ margin: "0.5rem 0" }} className="text-sm font-medium text-muted-foreground">Education</h3>
                                        <ul className="space-y-2">
                                            {education.map((e, i) => (
                                                <li key={`${e.name}-${i}`} className="text-sm">
                                                    <span className="font-medium">{e.name}</span>
                                                    {e.type ? (
                                                        <span className="text-muted-foreground"> · {titleCase(e.type)}</span>
                                                    ) : null}
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                </>
                            )}

                            {/* Skills */}
                            {(techs.length > 0 || softs.length > 0) && (
                                <>
                                    <Separator style={{ margin: "0.5rem 0" }} />
                                    <section className="space-y-3">
                                        <h3 style={{ margin: "0.5rem 0" }} className="text-sm font-medium text-muted-foreground">Skills</h3>
                                        {techs.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {techBadges.map((t, i) => (
                                                    <Badge style={{ padding: ".25rem .5rem" }} key={`${t}-${i}`} variant="secondary" className="rounded-full">
                                                        {titleCase(t)}
                                                    </Badge>
                                                ))}
                                                {remainingTechCount > 0 && (
                                                    <TooltipProvider delayDuration={100}>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Badge style={{ padding: ".25rem .5rem" }} variant="outline" className="rounded-full">
                                                                    +{remainingTechCount}
                                                                </Badge>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="max-w-xs">
                                                                <p style={{ padding: ".1rem .5rem", color: "black" }} className="text-xs">
                                                                    {techs.slice(techBadges.length).map(titleCase).join(", ")}
                                                                </p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}
                                            </div>
                                        )}
                                        {softs.length > 0 && (
                                            <div style={{ margin: ".55rem 0" }} className="flex flex-wrap gap-2">
                                                {softs.map((s, i) => (
                                                    <Badge style={{ padding: ".25rem .5rem" }} key={`${s}-${i}`} variant="outline" className="rounded-full">
                                                        {titleCase(s)}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </section>
                                </>
                            )}
                        </div>
                    </TabsContent>

                    {/* EXPERIENCE */}
                    <TabsContent value="experience" className="mt-0">
                        <ScrollArea className="h-[420px] sm:h-auto">
                            <div className="px-5 sm:px-6 py-4">
                                {experience && experience.length > 0 ? (
                                    <Accordion type="single" collapsible className="w-full">
                                        {experience.map((job, idx) => (
                                            <AccordionItem style={{ padding: ".25rem .5rem", margin: "1rem " }} key={`${job.company}-${idx}`} value={`exp-${idx}`}>
                                                <AccordionTrigger className="text-left">
                                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-1">
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold">{job.title}</span>
                                                            <span className="text-sm text-muted-foreground">
                                                                {`${job.company} `}
                                                                {job.location ? (
                                                                    <span className="inline-flex items-center gap-1 ml-1">
                                                                        <MapPin className="size-3" /> {job.location}
                                                                    </span>
                                                                ) : null}
                                                            </span>
                                                        </div>
                                                        <span className="text-xs text-muted-foreground">{`${job.duration} - (${job.durationMonths} months)`}</span>

                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <ul className="bullet-list pr-2 sm:pr-0">
                                                        {(job.description ?? []).map((d, i) => (
                                                            <li key={i}>
                                                                <span className="bullet">
                                                                    <img
                                                                        src={Bullet}
                                                                        alt="List Bullet"
                                                                    />

                                                                </span>
                                                                <span className="text">{d}
                                                                </span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                ) : (
                                    <div className="text-sm text-muted-foreground">No experience entries.</div>
                                )}
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    {/* INSIGHTS */}
                    <TabsContent value="insights" className="mt-0">
                        <div className="px-5 sm:px-6 py-4 space-y-6">
                            {/* Strengths & Gaps in two columns on lg+ */}
                            {(insights?.strengths?.length || insights?.gaps?.length) && (
                                <section className="grid gap-6 lg:grid-cols-2">
                                    <div>
                                        <h3 className="text-sm font-medium text-muted-foreground mb-2">Strengths</h3>
                                        <div className="space-y-3">
                                            {(insights?.strengths ?? []).map((s, i) => (
                                                <div style={{ padding: "0 .5rem", margin: ".5rem 0rem" }} key={i} className="rounded-lg border p-3">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Badge style={{ padding: ".25rem .5rem", margin: "0.5rem" }} className="rounded-lg" variant="secondary">
                                                            {s.confidence ?? "—"}
                                                        </Badge>
                                                        <span style={{ padding: ".25rem .5rem", margin: "0 .5rem" }} className="font-medium">{s.text}</span>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">{s.why}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium text-muted-foreground mb-2">Gaps</h3>
                                        <div className="space-y-3">
                                            {(insights?.gaps ?? []).map((g, i) => (
                                                <div style={{ padding: "0 .5rem", margin: ".5rem 0rem" }} key={i} className="rounded-lg border p-3">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Badge style={{ padding: ".25rem .5rem", margin: "0.5rem" }} variant="destructive" className="rounded-lg">
                                                            {g.priority ?? "—"}
                                                        </Badge>
                                                        <span className="font-medium">{g.missing}</span>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground mb-1">{g.impact}</p>
                                                    {g.suggestedLearningOrAction && (
                                                        <p className="text-sm">→ {g.suggestedLearningOrAction}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* Insightful Skills (progress bars) */}
                            {insights?.skills?.technical?.length ? (
                                <>
                                    <Separator />
                                    <section className="space-y-3">
                                        <h3 style={{ margin: "0.5rem 0" }} className="text-sm font-medium text-muted-foreground">Technical Skills</h3>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {insights.skills.technical.map((t, i) => (
                                                <div
                                                    style={{ padding: "0 .5rem" }}
                                                    key={`${t.name}-${i}`}
                                                    className="rounded-lg border p-3 space-y-2"
                                                >
                                                    <div style={{ margin: ".5rem 0rem" }} className="flex items-center justify-between">
                                                        <span className="font-medium">{t.name}</span>
                                                        <Badge style={{ padding: ".25rem .5rem" }} variant="outline" className="rounded-lg">
                                                            {t.level ?? "—"}
                                                        </Badge>
                                                    </div>
                                                    <Progress style={{ margin: ".5rem 0rem" }} value={levelToPct(t.level)} />
                                                    {t.evidenceLine && (
                                                        <p className="text-xs text-muted-foreground">{t.evidenceLine}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                </>
                            ) : null}

                            {/* Top Roles */}
                            {insights?.topRoles?.length ? (
                                <>
                                    <Separator />
                                    <section className="space-y-3">
                                        <h3 style={{ margin: "0.5rem 0" }} className="text-sm font-medium text-muted-foreground">Top Roles</h3>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {insights.topRoles.map((r, i) => (
                                                <div style={{ padding: "0 .5rem" }} key={`${r.title}-${i}`} className="rounded-lg border p-3 space-y-2">
                                                    <div style={{ margin: ".5rem 0rem" }} className="flex items-center gap-2">
                                                        <Award className="size-4 text-amber-600" />
                                                        <span className="font-medium">{r.title}</span>
                                                    </div>
                                                    <Progress value={Math.min(Math.max(r.fitScore ?? 0, 0), 100)} />
                                                    {r.why && (
                                                        <p style={{ margin: ".5rem .25rem" }} className="text-xs font-bold text-muted-foreground">{r.why}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                </>
                            ) : null}

                            {/* Achievements */}
                            {insights?.achievements?.length ? (
                                <>
                                    <Separator />
                                    <section className="space-y-3">
                                        <h3 style={{ margin: "0.5rem 0" }} className="text-sm font-medium text-muted-foreground">Achievements</h3>
                                        <ul className="space-y-2">
                                            {insights.achievements.map((a, i) => (
                                                <li style={{ padding: "0 .5rem", margin: ".5rem 0rem" }} key={`${a.headline}-${i}`} className="rounded-lg border p-3">
                                                    <div style={{ margin: ".5rem 0rem" }} className="font-medium">{a.headline}</div>
                                                    {a.suggestedBullet && (
                                                        <p className="text-sm text-muted-foreground mt-1">{a.suggestedBullet}</p>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                </>
                            ) : null}

                            {/* ATS & Recommendations */}
                            {insights?.atsAndFormat && (
                                <>
                                    <Separator />
                                    <section className="space-y-3">
                                        <h3 style={{ margin: "0.5rem 0" }} className="text-sm font-medium text-muted-foreground">ATS & Format</h3>
                                        <div className="flex items-center gap-2">
                                            <Badge style={{ margin: ".5rem 0", padding: "0 .25rem" }} variant={insights.atsAndFormat.isATSFriendly ? "secondary" : "destructive"} className="rounded-full">
                                                {insights.atsAndFormat.isATSFriendly ? "ATS Friendly" : "Needs Work"}
                                            </Badge>
                                        </div>
                                        {insights.atsAndFormat.recommendations?.length ? (
                                            <ul style={{ padding: "0 1.5rem" }} className="list-disc pl-5 space-y-1 text-sm border-2 rounded-md">
                                                {insights.atsAndFormat.recommendations.map((r, i) => (
                                                    <li style={{ margin: ".25rem 0" }} key={i}>{r}</li>
                                                ))}
                                            </ul>
                                        ) : null}
                                    </section>
                                </>
                            )}
                        </div>
                    </TabsContent>

                    {/* SALARY */}
                    <TabsContent value="salary" className="mt-0">
                        <ScrollArea className="px-5 sm:px-6 py-4 h-[60vh]">
                            {insights?.salaryInsights ? (
                                <div className="space-y-6">
                                    {/* Current Estimate */}
                                    <section>
                                        <h3 style={{ margin: "0.5rem 0" }} className="text-sm font-medium text-muted-foreground mb-3">
                                            Your Current Market Value
                                        </h3>
                                        <div style={{ padding: ".25rem .5rem" }} className="rounded-lg border p-4 bg-linear-to-br from-purple-50/50 to-blue-50/50 dark:from-purple-950/20 dark:to-blue-950/20">
                                            <div className="flex items-center justify-between mb-4">
                                                <div>
                                                    <div className="text-3xl font-bold">
                                                        ${(insights.salaryInsights.currentEstimate.range.median / 1000).toFixed(0)}K
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        Median • {insights.salaryInsights.currentEstimate.level} level
                                                    </div>
                                                </div>
                                                <Badge style={{ padding: "0rem .75rem" }} variant="secondary" className="text-md px-3 py-1">
                                                    {insights.salaryInsights.currentEstimate.level}
                                                </Badge>
                                            </div>

                                            <div style={{ padding: ".25rem .5rem" }} className="grid grid-cols-3 gap-3 text-sm">
                                                <div>
                                                    <div className="text-muted-foreground">Min</div>
                                                    <div className="font-semibold">
                                                        ${(insights.salaryInsights.currentEstimate.range.min / 1000).toFixed(0)}K
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-muted-foreground text-center">p75</div>
                                                    <div className="font-semibold text-center">
                                                        ${(insights.salaryInsights.currentEstimate.range.p75 / 1000).toFixed(0)}K
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-muted-foreground text-end">p95</div>
                                                    <div className="font-semibold text-end">
                                                        ${(insights.salaryInsights.currentEstimate.range.p95 / 1000).toFixed(0)}K
                                                    </div>
                                                </div>
                                            </div>

                                            <p style={{ padding: ".25rem .5rem" }} className="text-sm text-muted-foreground mt-3 pt-3 border-t">
                                                {insights.salaryInsights.currentEstimate.reasoning}
                                            </p>
                                        </div>
                                    </section>

                                    <Separator style={{ margin: "0.5rem 0" }} />

                                    {/* Skill ROI */}
                                    {insights.salaryInsights.skillROI?.length > 0 && (
                                        <section >
                                            <h3 style={{ margin: "0.5rem 0" }} className="text-sm font-medium text-muted-foreground mb-3">
                                                What Skills Should You Learn Next?
                                            </h3>
                                            <div className="space-y-3">
                                                {insights.salaryInsights.skillROI.map((roi, i) => (
                                                    <div style={{ padding: ".25rem .5rem" }} key={i} className="rounded-lg border p-4 hover:border-purple-500/50 transition-colors">
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div>
                                                                <div className="font-semibold capitalize">{roi.skill}</div>
                                                                <div className="text-sm text-muted-foreground">{roi.reasoning}</div>
                                                            </div>
                                                            <Badge style={{ padding: ".15rem .25rem", margin: ".5rem" }} variant="default" className="ml-2 rounded-lg whitespace-nowrap">
                                                                +${(roi.increase / 1000).toFixed(0)}K
                                                            </Badge>
                                                        </div>

                                                        <div className="flex items-center gap-4 text-sm">
                                                            <div>
                                                                <span className="text-muted-foreground">Current: </span>
                                                                <span className="font-medium">
                                                                    ${(roi.currentAvgSalary / 1000).toFixed(0)}K
                                                                </span>
                                                            </div>
                                                            <div className="text-muted-foreground">→</div>
                                                            <div>
                                                                <span className="text-muted-foreground">With skill: </span>
                                                                <span className="font-medium text-green-600 dark:text-green-400">
                                                                    ${(roi.withSkillAvgSalary / 1000).toFixed(0)}K
                                                                </span>
                                                            </div>
                                                            <div className="ml-auto">
                                                                <Badge style={{ padding: ".15rem .25rem" }} variant="outline" className="text-green-600 dark:text-green-400">
                                                                    +{roi.increasePercentage}%
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    )}

                                    {/* Potential Growth */}
                                    {insights.salaryInsights.potentialGrowth?.length > 0 && (
                                        <>
                                            <Separator style={{ margin: ".5rem 0" }} />
                                            <section>
                                                <h3 style={{ margin: ".5rem 0" }} className="text-sm font-medium text-muted-foreground mb-3">
                                                    Your Growth Potential
                                                </h3>
                                                {insights.salaryInsights.potentialGrowth.map((growth, i) => (
                                                    <div style={{ padding: ".25rem .5rem" }} key={i} className="rounded-lg border p-4 bg-linear-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div>
                                                                <div className="text-xl font-bold capitalize">
                                                                    {growth.targetLevel} Level
                                                                </div>
                                                                <div className="text-sm text-muted-foreground">
                                                                    {growth.timeframe}
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                                                    ${(growth.estimatedSalary.median / 1000).toFixed(0)}K
                                                                </div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    median (p75: ${(growth.estimatedSalary.p75 / 1000).toFixed(0)}K)
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <div className="text-sm font-medium">Skills to add:</div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {growth.requiresSkills.map((skill, idx) => (
                                                                    <Badge style={{ padding: ".25rem .5rem" }} key={idx} variant="secondary">
                                                                        {skill}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </section>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="text-sm text-muted-foreground">No salary insights available.</div>
                            )}
                        </ScrollArea>
                    </TabsContent>

                    {/* CAREER PATH */}
                    <TabsContent value="career" className="mt-0">
                        <ScrollArea className="px-5 sm:px-6 py-4 h-[60vh]">
                            {insights?.skillStacks ? (
                                <div className="space-y-6">
                                    {/* Current Stack */}
                                    <section>
                                        <h3 className="text-sm font-medium text-muted-foreground mb-3">
                                            Your Current Stack
                                        </h3>
                                        <div style={{ padding: ".25rem .5rem" }} className="rounded-lg border p-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="text-lg font-semibold">Stack Completeness</div>
                                                <Badge style={{ padding: ".15rem .5rem", margin: ".5rem 0" }} variant="secondary" className="text-lg">
                                                    {insights.skillStacks.currentStack.completeness}%
                                                </Badge>
                                            </div>

                                            <Progress value={insights.skillStacks.currentStack.completeness} className="mb-4" />

                                            <div style={{ margin: "0.5rem 0" }} className="space-y-3">
                                                <div>
                                                    <div className="text-sm font-medium mb-2">Your Skills:</div>
                                                    <div style={{ margin: "0.5rem 0" }} className="flex flex-wrap gap-2">
                                                        {insights.skillStacks.currentStack.skills.map((skill, i) => (
                                                            <Badge style={{ padding: ".25rem .5rem" }} key={i} variant="default">
                                                                {skill}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>

                                                {insights.skillStacks.currentStack.commonPairings?.length > 0 && (
                                                    <div>
                                                        <div className="text-sm font-medium mb-2">
                                                            Skills that commonly appear together:
                                                        </div>
                                                        <div className="space-y-2">
                                                            {insights.skillStacks.currentStack.commonPairings.map((pair, i) => (
                                                                <div key={i} className="flex items-center justify-between text-sm">
                                                                    <span className="capitalize">{pair.skill}</span>
                                                                    <Badge style={{ padding: ".25rem .5rem" }} variant="outline">
                                                                        {pair.appearsTogetherPercentage}% of jobs
                                                                    </Badge>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </section>

                                    {/* Recommended Stacks */}
                                    {insights.skillStacks.recommendedStacks?.length > 0 && (
                                        <>
                                            <Separator style={{ margin: "0.5rem 0" }} />
                                            <section>
                                                <h3 style={{ margin: "0.5rem 0" }} className="text-sm font-medium text-muted-foreground mb-3">
                                                    Recommended Career Paths
                                                </h3>
                                                <div className="space-y-4">
                                                    {insights.skillStacks.recommendedStacks.map((stack, i) => (
                                                        <div style={{ padding: ".25rem .5rem", margin: ".5rem 0" }} key={i} className="rounded-lg border p-4 hover:border-purple-500/50 transition-colors">
                                                            <div className="flex items-start justify-between mb-2">
                                                                <div>
                                                                    <div className="text-lg font-semibold">{stack.name}</div>
                                                                    <div className="text-sm text-muted-foreground">{stack.description}</div>
                                                                </div>
                                                                <Badge style={{ padding: "0rem .5rem" }} variant="default" className="text-md px-3 py-1 whitespace-nowrap">
                                                                    {stack.projectedFit}% fit
                                                                </Badge>
                                                            </div>

                                                            <div className="space-y-3 mt-4">
                                                                <div>
                                                                    <div className="text-sm font-medium mb-2">Add these skills:</div>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {stack.addSkills.map((skill, idx) => (
                                                                            <Badge style={{ padding: ".25rem .5rem" }} key={idx} variant="secondary" className="capitalize">
                                                                                {skill}
                                                                            </Badge>
                                                                        ))}
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center justify-between pt-3 border-t">
                                                                    <div className="text-sm">
                                                                        <span className="text-muted-foreground">Salary range: </span>
                                                                        <span className="font-semibold">
                                                                            ${(stack.salaryRange.median / 1000).toFixed(0)}K - $
                                                                            {(stack.salaryRange.p75 / 1000).toFixed(0)}K
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </section>
                                        </>
                                    )}

                                    {/* Market Alignment */}
                                    {insights?.marketAlignment && (
                                        <>
                                            <Separator style={{ margin: "0.5rem 0" }} />
                                            <section>
                                                <h3 style={{ margin: "0.5rem 0" }} className="text-sm font-medium text-muted-foreground mb-3">
                                                    Market Demand for Your Skills
                                                </h3>
                                                <div style={{ padding: ".25rem .5rem" }} className="rounded-lg border p-4 mb-4">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div style={{ margin: "0.5rem 0" }} className="text-lg font-semibold">Demand Score</div>
                                                        <Badge style={{ padding: "0 .5rem" }} variant="secondary" className="text-md">
                                                            {insights.marketAlignment.demandScore}%
                                                        </Badge>
                                                    </div>
                                                    <Progress style={{ margin: "0.5rem 0" }} value={insights.marketAlignment.demandScore} className="mb-2" />
                                                    <p className="text-sm text-muted-foreground">
                                                        {insights.marketAlignment.demandScoreExplanation}
                                                    </p>
                                                </div>

                                                {insights.marketAlignment.missingHighDemandSkills?.length > 0 && (
                                                    <div style={{ margin: "0.5rem 0" }} className="space-y-2">
                                                        <div className="text-sm font-medium">High-demand skills you're missing:</div>
                                                        {insights.marketAlignment.missingHighDemandSkills.slice(0, 5).map((skill, i) => (
                                                            <div style={{ padding: ".25rem .5rem", margin: "0.5rem 0" }} key={i} className="rounded-lg border p-3">
                                                                <div className="flex items-start justify-between mb-1">
                                                                    <span className="font-medium capitalize">{skill.skill}</span>
                                                                    <Badge style={{ padding: ".25rem .5rem" }} variant={
                                                                        skill.priority === 'high' ? 'destructive' :
                                                                            skill.priority === 'medium' ? 'default' : 'outline'
                                                                    }>
                                                                        {skill.priority}
                                                                    </Badge>
                                                                </div>
                                                                <div className="text-sm text-muted-foreground mb-1">
                                                                    {skill.demand} jobs • {skill.reason}
                                                                </div>
                                                                <div className="text-sm text-purple-600 dark:text-purple-400">
                                                                    💡 {skill.learningPath}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </section>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="text-sm text-muted-foreground">No career path insights available.</div>
                            )}
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </CardContent>

            <CardFooter className="p-5 sm:p-6">
                <div className="ml-auto text-xs text-muted-foreground">
                    Insights by {resume.insightsMetadata?.generatedBy ?? "—"} ·{" "}
                    {formatIso(resume.insightsMetadata?.generatedAt)}
                </div>
            </CardFooter>
        </Card >
    );
}

// Minimal phone icon (to avoid another import)
function PhoneMini() {
    return (
        <svg
            className="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3A2 2 0 0 1 9 3.72c.13.98.38 1.94.74 2.85a2 2 0 0 1-.45 2.11L8 9c1.5 2.9 3.9 5.3 6.8 6.8l.31-.29a2 2 0 0 1 2.11-.45c.91.36 1.87.61 2.85.74A2 2 0 0 1 22 16.92z" />
        </svg>
    );
}
