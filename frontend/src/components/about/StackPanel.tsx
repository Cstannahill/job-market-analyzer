import { Card, CardContent } from "@/components/ui/card";


/* -------------------------
   StackPanel (updated to show svg icons)
   - expects icon SVGs in /public/icons/
--------------------------*/
export const StackPanel: React.FC<{
    stackItems: { name: string; iconPath?: string }[]; // iconPath relative to /public
    principles: string[];
}> = ({ stackItems, principles }) => {
    return (
        <Card className="bg-card/60 border border-border/60 backdrop-blur-sm">
            <CardContent className="p-6">
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="flex flex-col items-center">
                        <h3 className="text-lg font-bold text-foreground mb-3 text-center">Stack</h3>
                        <ul className="space-y-3 w-full max-w-xs pl-3">
                            {stackItems.map((s) => {
                                // Normalize icon path: allow '/icons/name.svg' or 'icons/name.svg' or just the filename
                                const normalized = s.iconPath
                                    ? s.iconPath.startsWith("/")
                                        ? s.iconPath
                                        : s.iconPath.startsWith("icons/")
                                            ? `/${s.iconPath}`
                                            : `/icons/${s.iconPath}`
                                    : undefined;

                                return (
                                    <li key={s.name} className="flex items-center gap-4 py-1">
                                        {normalized ? (
                                            <img
                                                src={normalized}
                                                alt={s.name}
                                                className="w-8 h-8 rounded-md bg-card/30 p-1 ml-1"
                                                loading="lazy"
                                                decoding="async"
                                                onError={(e) => {
                                                    // hide image if it fails to load
                                                    (e.target as HTMLImageElement).style.display = "none";
                                                }}
                                            />
                                        ) : (
                                            <span className="inline-block w-2 h-2 rounded-full bg-gradient-to-br from-chart-2 to-chart-3" />
                                        )}
                                        <span className="text-sm text-muted-foreground">{s.name}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold text-foreground mb-3 text-center">Data Principles</h3>
                        <ul className="space-y-3">
                            {principles.map((p) => (
                                <li key={p} className="flex items-start gap-3">
                                    <svg
                                        className="mt-1 w-4 h-4 shrink-0 text-muted-foreground"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                        aria-hidden
                                    >
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="0.6" opacity="0.18" />
                                        <path d="M8 12l2.2 2.2L16 8.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    <span className="text-sm text-muted-foreground">{p}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};