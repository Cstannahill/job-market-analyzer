import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExperienceItem } from "@job-market-analyzer/types/resume";
export const ResumeExperience = (experience: ExperienceItem[]) => {
    return (
        <Card className="mb-3 resume-card">
            <CardHeader>
                <CardTitle>Experience</CardTitle>
            </CardHeader>
            <CardContent>
                <ol className="list-none space-y-3">
                    {(experience ?? experience ?? []).map((e: ExperienceItem, idx: number) => (
                        <li key={idx} className="border-b pb-2">
                            <div className="font-medium">{e.title}</div>
                            <div className="text-xs text-muted">{e.company}{e.location ? ` • ${e.location}` : ""}</div>
                            <div className="text-xs text-muted">{e.duration}</div>
                        </li>
                    ))}
                </ol>
            </CardContent>
        </Card>
    );
}
