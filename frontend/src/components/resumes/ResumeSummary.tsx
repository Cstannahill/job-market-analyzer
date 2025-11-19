import { Badge } from "@/components/ui/badge";
import type { Insights } from "@job-market-analyzer/types/resume";

export const ResumeSummary = (insights: Insights) => {
    return (
        <div className="mb-3">
            <div className="bg-surface-2 rounded-lg p-4 shadow-sm border border-surface-3">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold break-words max-w-[60ch]">
                            {insights?.summary?.oneLine ?? "Resume Summary"}
                        </h2>
                        <p className="text-sm text-muted mt-2">{insights?.summary?.threeLine}</p>
                        <div className="mt-3 flex gap-2 flex-wrap">
                            {(insights?.topRoles ?? []).slice(0, 3).map((r) => (
                                <Badge key={r.title} className="px-2 py-1">{r.title} ({r.fitScore ?? 0})</Badge>
                            ))}
                        </div>
                    </div>
                    <div className="text-sm text-muted text-right">
                        <div className="font-medium">Confidence</div>
                        <div className="mt-1">{insights?.confidence ?? "medium"}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
