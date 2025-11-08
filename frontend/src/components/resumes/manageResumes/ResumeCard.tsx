import * as React from "react";
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
import type { ResumeRecord } from "@/shared-types";

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

    const techs = skills?.technologies ?? [];
    const softs = skills?.softSkills ?? [];
    const techBadges = techs.slice(0, 24); // keep it tidy on card
    const remainingTechCount = Math.max(techs.length - techBadges.length, 0);

    return (
        <Card style={{ padding: "2rem" }} className={cn("rounded-2xl shadow-sm border-muted w-full", className)}>
            <CardHeader className="p-5 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle className="text-xl sm:text-2xl break-all">
                            {originalFileName ?? "Resume"}
                        </CardTitle>
                        <CardDescription className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
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
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="experience">Experience</TabsTrigger>
                            <TabsTrigger value="insights">Insights</TabsTrigger>
                        </TabsList>
                    </div>

                    {/* OVERVIEW */}
                    <TabsContent value="overview" className="mt-0">
                        <div className="px-5 sm:px-6 py-4 space-y-6">
                            {/* Summary */}
                            {(oneLine || threeLine) && (
                                <section>
                                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Summary</h3>
                                    {oneLine && <p className="text-base leading-relaxed">{oneLine}</p>}
                                    {threeLine && (
                                        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                                            {threeLine}
                                        </p>
                                    )}
                                </section>
                            )}

                            {/* Contact */}
                            {(contactInfo?.email || contactInfo?.phone) && (
                                <>
                                    <Separator />
                                    <section className="grid gap-2">
                                        <h3 className="text-sm font-medium text-muted-foreground">Contact</h3>
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
                                    <Separator />
                                    <section className="space-y-2">
                                        <h3 className="text-sm font-medium text-muted-foreground">Education</h3>
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
                                    <Separator />
                                    <section className="space-y-3">
                                        <h3 className="text-sm font-medium text-muted-foreground">Skills</h3>
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
                                                                <p className="text-xs">
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
                        <ScrollArea className="px-5 sm:px-6 py-4 h-[480px]">
                            {experience && experience.length > 0 ? (
                                <Accordion type="single" collapsible className="w-full">
                                    {experience.map((job, idx) => (
                                        <AccordionItem key={`${job.company}-${idx}`} value={`exp-${idx}`}>
                                            <AccordionTrigger className="text-left">
                                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-1">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold">{job.title}</span>
                                                        <span className="text-sm text-muted-foreground">
                                                            {job.company}
                                                            {job.location ? (
                                                                <span className="inline-flex items-center gap-1 ml-1">
                                                                    <MapPin className="size-3" /> {job.location}
                                                                </span>
                                                            ) : null}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">{job.duration}</span>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <ul className="list-disc pl-5 space-y-2 text-sm leading-relaxed">
                                                    {(job.description ?? []).map((d, i) => (
                                                        <li key={i}>{d}</li>
                                                    ))}
                                                </ul>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            ) : (
                                <div className="text-sm text-muted-foreground">No experience entries.</div>
                            )}
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
                                                <div style={{ padding: "0 .5rem" }} key={i} className="rounded-lg border p-3">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Badge style={{ padding: ".25rem .5rem", margin: "0.5rem" }} className="rounded-full" variant="secondary">
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
                                                <div style={{ padding: "0 .5rem" }} key={i} className="rounded-lg border p-3">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Badge style={{ padding: ".25rem .5rem", margin: "0.5rem" }} variant="destructive" className="rounded-full">
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
                                        <h3 className="text-sm font-medium text-muted-foreground">Technical Skills</h3>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {insights.skills.technical.map((t, i) => (
                                                <div
                                                    style={{ padding: "0 .5rem" }}
                                                    key={`${t.name}-${i}`}
                                                    className="rounded-lg border p-3 space-y-2"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-medium">{t.name}</span>
                                                        <Badge variant="outline" className="rounded-full">
                                                            {t.level ?? "—"}
                                                        </Badge>
                                                    </div>
                                                    <Progress value={levelToPct(t.level)} />
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
                                        <h3 className="text-sm font-medium text-muted-foreground">Top Roles</h3>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {insights.topRoles.map((r, i) => (
                                                <div style={{ padding: "0 .5rem" }} key={`${r.title}-${i}`} className="rounded-lg border p-3 space-y-2">
                                                    <div className="flex items-center gap-2">
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
                                        <h3 className="text-sm font-medium text-muted-foreground">Achievements</h3>
                                        <ul className="space-y-2">
                                            {insights.achievements.map((a, i) => (
                                                <li style={{ padding: "0 .5rem" }} key={`${a.headline}-${i}`} className="rounded-lg border p-3">
                                                    <div className="font-medium">{a.headline}</div>
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
                                        <h3 className="text-sm font-medium text-muted-foreground">ATS & Format</h3>
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
                </Tabs>
            </CardContent>

            <CardFooter className="p-5 sm:p-6">
                <div className="ml-auto text-xs text-muted-foreground">
                    Insights by {resume.insightsMetadata?.generatedBy ?? "—"} ·{" "}
                    {formatIso(resume.insightsMetadata?.generatedAt)}
                </div>
            </CardFooter>
        </Card>
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
