// ResumeUploaderModern.tsx
import React, { useRef, useState } from "react";
import { uploadResume, type UploadStatus } from "@/services/resumeService";
import type { CompareResult, ExperienceItem, Insights } from "@/types/resume";
/**
 * Minimal types for the component based on your backend JSON shape.
 * Tweak these to match your real backend types.
 */
// type TechnicalSkill = { name: string; level?: "basic" | "intermediate" | "advanced"; evidenceLine?: string };
// type SoftSkill = { name: string; evidenceLine?: string };

// type InsightSkills = {
//     technical?: TechnicalSkill[];
//     soft?: SoftSkill[];
// };





const ACCEPTED_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function formatBytes(n: number) {
    if (n < 1024) return n + " bytes";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(2) + " MB";
}

function IconSpinner() {
    return (
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </svg>
    );
}

export default function ResumeUploaderModern() {
    const inputRef = useRef<HTMLInputElement | null>(null);

    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<UploadStatus>("idle");
    const [progress, setProgress] = useState<number>(0);
    const [result, setResult] = useState<CompareResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const validate = (f: File) => {
        if (f.size > MAX_BYTES) return "File is too large (max 10 MB)";
        if (!ACCEPTED_TYPES.includes(f.type)) return "Unsupported file type";
        return null;
    };

    function handlePick() {
        inputRef.current?.click();
    }

    function handleFile(f: File | null) {
        setError(null);
        setResult(null);
        setProgress(0);

        if (!f) {
            setFile(null);
            setStatus("idle");
            return;
        }

        const v = validate(f);
        if (v) {
            setError(v);
            setFile(null);
            setStatus("failed");
            return;
        }

        setFile(f);
        setStatus("idle");
    }

    const onChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
        const f = e.target.files?.[0] ?? null;
        handleFile(f);
    };

    const handleUpload = async () => {
        if (!file) return;
        setError(null);
        setStatus("uploading");
        setProgress(0);
        try {
            await uploadResume({
                file,
                setStatus,
                setProgress,
                setError,
                setResult,
            });
        } catch (err: Error | unknown) {
            const msg = (err && typeof err === "object" && "message" in err) ? (err as Error).message : String(err);
            setError(msg ?? "Upload failed");
            setStatus("failed");
        }
    };

    const handleDownloadJson = () => {
        if (!result) return;
        const blob = new Blob([JSON.stringify(result.analysis ?? result, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${file?.name?.replace(/\.[^.]+$/, "") || "resume"}-analysis.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleCopyJson = async () => {
        if (!result) return;
        try {
            await navigator.clipboard.writeText(JSON.stringify(result.analysis ?? result, null, 2));
            setError("Copied JSON to clipboard");
            setTimeout(() => setError(null), 2000);
        } catch {
            setError("Copy failed");
        }
    };

    // Presentational subcomponents typed explicitly
    const SummaryCard: React.FC<{ insights?: Insights }> = ({ insights }) => {
        if (!insights) return null;
        const s = insights.summary ?? {};
        return (
            <div className="bg-surface-2 rounded-lg p-4 shadow-sm border border-surface-3">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-semibold">{s.oneLine ?? "Resume Summary"}</h3>
                        <p className="text-sm text-muted mt-1">{s["3line"]}</p>
                        <div className="mt-3 flex gap-2 flex-wrap">
                            {(insights.topRoles ?? []).slice(0, 3).map((r) => (
                                <span key={r.title} className="px-2 py-1 bg-indigo-800/30 text-indigo-200 rounded-full text-xs">
                                    {r.title} <span className="ml-1 text-xs text-indigo-300">({r.fitScore ?? 0})</span>
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="text-sm text-muted text-right">
                        <div className="font-medium">Confidence</div>
                        <div className="mt-1">{insights.confidence ?? "medium"}</div>
                    </div>
                </div>
            </div>
        );
    };

    const SkillsList: React.FC<{ tech?: string[]; soft?: string[] }> = ({ tech = [], soft = [] }) => (
        <div className="space-y-2">
            <div>
                <h4 className="text-sm font-semibold mb-2">Technologies</h4>
                <div className="flex flex-wrap gap-2">
                    {tech.map((t) => (
                        <span key={t} className="px-3 py-1 bg-slate-800/40 text-slate-100 rounded-full text-sm">{t}</span>
                    ))}
                </div>
            </div>
            <div>
                <h4 className="text-sm font-semibold mb-2">Soft skills</h4>
                <div className="flex gap-2 flex-wrap">
                    {soft.map((s) => (
                        <span key={s} className="px-3 py-1 bg-amber-800/30 text-amber-200 rounded-full text-sm">{s}</span>
                    ))}
                </div>
            </div>
        </div>
    );

    const ExperienceTimeline: React.FC<{ experience?: ExperienceItem[] }> = ({ experience = [] }) => (
        <div className="space-y-3">
            <h4 className="text-sm font-semibold">Experience</h4>
            <ol className="border-l border-slate-700 pl-4">
                {experience.map((e, idx) => (
                    <li key={idx} className="mb-2">
                        <span className="block text-sm font-medium">{e.title}</span>
                        <span className="block text-xs text-muted">{e.company}{e.location ? ` • ${e.location}` : ""}</span>
                        <span className="block text-xs text-muted">{e.duration}</span>
                    </li>
                ))}
            </ol>
        </div>
    );

    const InsightsPanel: React.FC<{ insights?: Insights }> = ({ insights }) => {
        if (!insights) return null;
        return (
            <div className="space-y-4">
                <div>
                    <h4 className="text-sm font-semibold">Strengths</h4>
                    <ul className="list-disc pl-5 mt-2 text-sm">
                        {(insights.strengths ?? []).map((s, i) => (
                            <li key={i}><strong>{s.text}</strong>: <span className="text-muted">{s.why}</span></li>
                        ))}
                    </ul>
                </div>

                <div>
                    <h4 className="text-sm font-semibold">Gaps / Missing</h4>
                    <ul className="list-disc pl-5 mt-2 text-sm">
                        {(insights.gaps ?? []).map((g, i) => (
                            <li key={i}><strong>{g.missing}</strong>: <span className="text-muted">{g.suggestedLearningOrAction}</span></li>
                        ))}
                    </ul>
                </div>

                <div>
                    <h4 className="text-sm font-semibold">Achievements (Suggested)</h4>
                    <ul className="pl-3 mt-2 space-y-2">
                        {(insights.achievements ?? []).map((a, i) => (
                            <li key={i} className="text-sm">
                                <div className="font-medium">{a.headline}</div>
                                <div className="text-xs text-muted">{a.suggestedBullet}</div>
                            </li>
                        ))}
                    </ul>
                </div>

                <div>
                    <h4 className="text-sm font-semibold">Resume Edits</h4>
                    <div className="mt-2">
                        <div className="text-sm font-medium">Suggested Headline</div>
                        <div className="text-sm text-muted">{insights.resumeEdits?.titleAndSummary?.headline}</div>
                        <div className="mt-2 text-sm">{insights.resumeEdits?.titleAndSummary?.professionalSummary}</div>

                        <div className="mt-3">
                            {(insights.resumeEdits?.improvedBullets ?? []).map((b, idx) => (
                                <div key={idx} className="mt-2 text-sm p-2 border rounded bg-surface-3">
                                    <div className="text-xs text-muted">New</div>
                                    <div className="text-sm">{b.new}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Upload area */}
            <div className="lg:col-span-2">
                <div
                    className="h-72 flex items-center justify-center rounded-lg border-2 border-dashed border-slate-700 bg-surface-1 p-6"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                        e.preventDefault();
                        const f = e.dataTransfer.files?.[0] ?? null;
                        handleFile(f);
                    }}
                >
                    <div className="text-center">
                        <div className="mb-2 text-2xl">Upload your resume</div>
                        <div className="text-sm text-muted mb-4">PDF or DOCX. We extract skills, experience and generate insights.</div>

                        <div className="flex items-center gap-2 justify-center">
                            <button
                                onClick={handlePick}
                                className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white"
                            >
                                Choose file
                            </button>
                            <div className="text-sm text-muted">or drag & drop here</div>
                        </div>

                        <input ref={inputRef} type="file" accept=".pdf,.docx" onChange={onChange} className="hidden" />
                    </div>
                </div>

                {/* file card */}
                <div className="mt-4">
                    {file ? (
                        <div className="flex items-center justify-between p-4 bg-surface-2 border rounded">
                            <div>
                                <div className="font-semibold">{file.name}</div>
                                <div className="text-sm text-muted">{file.type || "unknown"} • {formatBytes(file.size)}</div>
                            </div>

                            <div className="flex items-center gap-3">
                                {status === "uploading" || status === "processing" ? (
                                    <div className="flex items-center gap-2">
                                        <IconSpinner />
                                        <div className="text-sm text-muted">{status === "uploading" ? `Uploading ${progress}%` : "Processing..."}</div>
                                    </div>
                                ) : (
                                    <div className="text-sm text-muted">Ready</div>
                                )}

                                <button
                                    onClick={handleUpload}
                                    disabled={status === "uploading" || status === "processing"}
                                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50"
                                >
                                    Upload
                                </button>

                                <button
                                    onClick={() => handleFile(null)}
                                    className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded"
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-muted">No file selected</div>
                    )}

                    {error && <div className="mt-2 text-sm text-red-400">{error}</div>}

                    {/* progress bar */}
                    {(status === "uploading" || status === "processing") && (
                        <div className="mt-3">
                            <div className="h-2 bg-slate-800 rounded overflow-hidden">
                                <div className="h-full bg-indigo-500" style={{ width: `${progress}%`, transition: "width 300ms ease" }} />
                            </div>
                            <div className="text-xs text-muted mt-1">{status === "uploading" ? `Uploading ${progress}%` : "Processing..."}</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right: results */}
            <aside className="lg:col-span-1 space-y-4">
                {result ? (
                    <>
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="text-lg font-semibold">Analysis</h3>
                            <div className="flex gap-2">
                                <button onClick={handleCopyJson} className="px-2 py-1 bg-slate-700 text-white rounded text-sm">Copy JSON</button>
                                <button onClick={handleDownloadJson} className="px-2 py-1 bg-slate-700 text-white rounded text-sm">Download</button>
                            </div>
                        </div>

                        <SummaryCard insights={result.analysis?.insights ?? (result.insights ?? undefined)} />

                        <div className="mt-3 p-3 bg-surface-2 border rounded">
                            <SkillsList
                                tech={result.analysis?.skills?.technologies ?? result.skills?.technologies ?? []}
                                soft={result.analysis?.skills?.softSkills ?? result.skills?.softSkills ?? []}
                            />
                        </div>

                        <div className="mt-3 p-3 bg-surface-2 border rounded space-y-4">
                            <ExperienceTimeline experience={result.analysis?.experience ?? result.experience ?? []} />
                        </div>

                        <div className="mt-3 p-3 bg-surface-2 border rounded">
                            <InsightsPanel insights={result.analysis?.insights ?? (result.insights ?? undefined)} />
                        </div>
                    </>
                ) : (
                    <div className="p-4 bg-surface-2 border rounded text-sm text-muted">
                        No analysis yet — upload a resume to see insights here.
                    </div>
                )}
            </aside>
        </section>
    );
}
