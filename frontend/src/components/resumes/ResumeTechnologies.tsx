import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SkillsItem } from "@job-market-analyzer/types/resume";


export const ResumeTechnologies = (skills?: SkillsItem) => {
    return (
        <Card className="mb-3 resume-card">
            <CardHeader>
                <CardTitle>Technologies</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap gap-2">
                    {(skills?.technologies ?? skills?.technologies ?? []).map((t) => (
                        <span key={t} className="px-2 py-1 text-xs rounded bg-slate-800/30">{t}</span>
                    ))}
                </div>
                <div className="mt-3">
                    <div className="text-sm font-medium">Soft skills</div>
                    <div className="mt-2 flex gap-2 flex-wrap">
                        {(skills?.softSkills ?? skills?.softSkills ?? []).map((s) => (
                            <span key={s} className="px-2 py-1 text-xs rounded bg-amber-800/30">{s}</span>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
