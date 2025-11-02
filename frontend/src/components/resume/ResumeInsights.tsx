import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Insights } from "@/shared-types/src/resume";

export const ResumeInsights = (insights: Insights | undefined) => {
    return (
        <>
            <Card className="resume-card">
                <CardHeader>
                    <CardTitle>Insights</CardTitle>
                </CardHeader>
                <CardContent className="overflow-hidden">
                    <div className="space-y-4">
                        <div>
                            <div className="font-semibold">Strengths</div>
                            <ul className="list-disc list-inside mt-2 text-sm break-words">
                                {(insights?.strengths ?? []).map((s, i) => (
                                    <li key={i}><strong>{s.text}</strong>: <span className="text-muted">{s.why}</span></li>
                                ))}
                            </ul>
                        </div>

                        <div>
                            <div className="font-semibold">Gaps</div>
                            <ul className="list-disc list-inside mt-2 text-sm break-words">
                                {(insights?.gaps ?? []).map((g, i) => (
                                    <li key={i}><strong>{g.missing}</strong>: <span className="text-muted">{g.suggestedLearningOrAction}</span></li>
                                ))}
                            </ul>
                        </div>

                        {/* suggested bullets */}
                        <div>
                            <div className="font-semibold">Suggested bullets</div>
                            <ul className="list-disc list-inside mt-2 text-sm break-words">
                                {(insights?.resumeEdits?.improvedBullets ?? []).map((b, idx) => (
                                    <li key={idx}>{b.new}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </>
    );
}