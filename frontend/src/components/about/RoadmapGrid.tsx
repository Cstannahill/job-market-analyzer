import { Card, CardContent } from "@/components/ui/card";
export const RoadmapGrid: React.FC<{
    columns?: number;
    items: { title: string; bullets: string[]; status?: "planned" | "in-progress" | "done"; progress?: number }[];
}> = ({ columns = 2, items }) => {
    return (
        <div className={`grid gap-6 sm:grid-cols-1 md:grid-cols-${columns}`}>
            {items.map((it) => {
                const statusColor =
                    it.status === "done" ? "bg-green-600/80" : it.status === "in-progress" ? "bg-yellow-600/70" : "bg-primary/80";

                return (
                    <Card key={it.title} className="bg-card/60 border border-border/60 backdrop-blur-sm">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <h4 className="text-lg font-semibold text-foreground">{it.title}</h4>
                                <div className={`px-3 py-1 rounded-full text-xs text-primary-foreground ${statusColor}`}>{it.status ?? "planned"}</div>
                            </div>

                            <ul className="mt-4 list-disc list-inside space-y-2 text-sm text-muted-foreground">
                                {it.bullets.map((b) => (
                                    <li key={b}>{b}</li>
                                ))}
                            </ul>

                            {typeof it.progress === "number" && (
                                <div className="mt-4">
                                    <div className="text-xs text-muted-foreground mb-1">Progress</div>
                                    <div className="w-full bg-border/20 rounded-full h-2 overflow-hidden">
                                        <div className="h-2 rounded-full" style={{ width: `${it.progress}%`, background: "linear-gradient(90deg,var(--color-chart-2),var(--color-chart-3))" }} />
                                    </div>
                                </div>
                            )}

                            {/* decorative micro-illustration */}
                            <div className="mt-6 h-12 w-full rounded-xl bg-gradient-to-r from-chart-1/5 to-chart-3/5 opacity-50" />
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
};