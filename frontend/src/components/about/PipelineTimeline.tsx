import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";


export const PipelineTimeline: React.FC<{
    steps: { title: string; description: string }[];
}> = ({ steps }) => {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <div className="space-y-4">
            {steps.map((s, i) => {
                const isOpen = i === openIndex;
                return (
                    <motion.div
                        key={s.title}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                    >
                        <div
                            className="flex items-start gap-4 cursor-pointer"
                            onClick={() => setOpenIndex(isOpen ? null : i)}
                            role="button"
                            aria-expanded={isOpen}
                        >
                            <div className="flex-shrink-0">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm bg-gradient-to-br from-chart-1 to-chart-3 text-primary-foreground shadow">
                                    {i + 1}
                                </div>
                            </div>

                            <div className="flex-1">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-base font-semibold text-foreground">{s.title}</h4>
                                    <div className="text-xs text-muted-foreground">{isOpen ? "Hide" : "Details"}</div>
                                </div>

                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={isOpen ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 28 }}
                                    className="overflow-hidden"
                                >
                                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.description}</p>
                                </motion.div>
                            </div>
                        </div>
                        {i < steps.length - 1 && <div className="ml-5 h-6 border-l border-border/30" />}
                    </motion.div>
                );
            })}
        </div>
    );
};

/* -------------------------
   Mermaid Diagram + Pipeline wrapper
   - renders timeline on the left, mermaid diagram on the right
   - responsive: stacks vertically on small widths
--------------------------*/
export const PipelineWithDiagram: React.FC<{
    steps: { title: string; description: string }[];
}> = ({ steps }) => {
    const diagramRef = useRef<HTMLDivElement | null>(null);
    const [renderError, setRenderError] = useState<string | null>(null);

    // Basic mermaid flow definition based on steps
    // Build a minimal, parse-safe mermaid definition. Avoid injecting CSS variables or
    // custom style lines that the parser may treat as node strings. We rely on mermaid's
    // built-in theme to style the diagram.
    const mermaidDef = `
flowchart LR
    subgraph pipeline [Pipeline]
        ${steps
            .map((s, idx) => {
                const id = `s${idx + 1}`;
                // create a short, safe label for mermaid nodes. replace quotes/newlines
                const label = s.title.replace(/"/g, "'").replace(/\r?\n/g, ' ').replace(/\s+/g, " ");
                return `${id}["${label}"]`;
            })
            .join("\n    --> ")}
    end
`;

    useEffect(() => {
        let mounted = true;
        // dynamic import mermaid to avoid SSR issues
        (async () => {
            try {
                const imported = await import("mermaid");
                if (!mounted) return;

                // some bundlers give the module as default, others as the module itself
                const m = imported?.default ?? imported;

                // initialize if available
                if (typeof m.initialize === "function") {
                    m.initialize({ startOnLoad: false, theme: "dark" });
                } else if (m.mermaidAPI && typeof m.mermaidAPI.initialize === "function") {
                    m.mermaidAPI.initialize({ startOnLoad: false, theme: "dark" });
                }

                const id = `mermaid-diagram-${Math.random().toString(36).slice(2, 9)}`;

                // mermaid render can have different shapes depending on version:
                // - m.render(id, def) -> Promise<string> or Promise<{ svg }>
                // - m.mermaidAPI.render(id, def, callback)
                if (typeof m.render === "function") {
                    const result = await m.render(id, mermaidDef);
                    const svg = typeof result === "string" ? result : result?.svg ?? String(result);
                    if (!mounted) return;
                    if (diagramRef.current) {
                        diagramRef.current.innerHTML = svg;
                        setRenderError(null);
                    }
                } else if (m.mermaidAPI && typeof m.mermaidAPI.render === "function") {
                    // callback-based API
                    m.mermaidAPI.render(id, mermaidDef, (svgCode: string) => {
                        if (!mounted) return;
                        if (diagramRef.current) {
                            diagramRef.current.innerHTML = svgCode;
                            setRenderError(null);
                        }
                    });
                } else {
                    throw new Error("No compatible mermaid render API found.");
                }
            } catch (err: unknown) {
                // graceful fallback - show plain diagram text
                console.error("Mermaid render error:", err);
                if (mounted) setRenderError("Diagram unavailable (client).");
            }
        })();

        return () => {
            mounted = false;
        };
    }, [mermaidDef]);

    return (
        <div className="grid gap-6 lg:grid-cols-2 items-start">
            <div>
                <PipelineTimeline steps={steps} />
            </div>

            <div>
                <Card className="bg-card/50 border border-border/60 backdrop-blur-sm">
                    <CardContent className="p-6">
                        <h4 className="text-lg font-semibold text-foreground mb-3 text-center">Pipeline Diagram</h4>
                        <div
                            ref={diagramRef}
                            className="w-full flex justify-items-center h-[340px] select-none overflow-auto"
                            aria-hidden={!renderError ? "true" : "false"}
                        />
                        {renderError && <div className="mt-2 text-sm text-destructive text-center">{renderError}</div>}
                        {/* <p className="mt-4 text-xs text-muted-foreground">
                            Click each pipeline step for details. Diagram generated client-side with Mermaid.
                        </p> */}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};