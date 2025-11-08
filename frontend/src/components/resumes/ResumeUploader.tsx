// ResumeUploaderModern.tsx
import React, { useEffect, useRef, useState } from "react";
import { uploadResume, type UploadStatus } from "@/services/resumeService";
import type { CompareResult, ExperienceItem } from "@/shared-types";

// shadcn/ui imports — change paths if your project places them elsewhere
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthUser } from "@/stores/authStore";

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

export default function ResumeUploader() {
    const user = useAuthUser();
    const inputRef = useRef<HTMLInputElement | null>(null);

    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<UploadStatus>("idle");
    const [progress, setProgress] = useState<number>(0);
    const [result, setResult] = useState<CompareResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState<boolean>(false);

    // auto-collapse when result arrives (you can change to manual if preferred)
    useEffect(() => {
        if (result && status !== "uploading" && status !== "processing") {
            setCollapsed(true);
        }
    }, [result, status]);

    const validate = (f: File) => {
        if (f.size > MAX_BYTES) return "File is too large (max 10 MB)";
        if (!ACCEPTED_TYPES.includes(f.type)) return "Unsupported file type";
        return null;
    };

    // function handlePick() {
    //     inputRef.current?.click();
    // }

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

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0] ?? null;
        handleFile(f);
    };

    const handleUpload = async () => {
        console.log(user);
        if (!file) return;
        if (!user) {
            setError('Authentication required');
            return;
        }
        setError(null);
        setStatus("uploading");
        setProgress(0);
        try {
            await uploadResume({
                file,
                userId: user?.userId || "",
                setStatus,
                setProgress,
                setError,
                setResult,
            });
        } catch (err: unknown) {
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
            setTimeout(() => setError(null), 1600);
        } catch {
            setError("Copy failed");
        }
    };

    // Compact uploader shown after analysis; keeps quick actions
    const CompactUploader = (
        <Card className="w-full mb-4 resume-card">
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span className="text-base">Uploaded resume</span>
                    <div className="flex items-center gap-2">
                        <Button size="sm" className="resume-button" variant="ghost" onClick={() => setCollapsed(false)}>Edit</Button>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <div className="font-medium">{file?.name}</div>
                        <div className="text-sm text-muted">{file?.type ?? "unknown"} • {file ? formatBytes(file.size) : ""}</div>
                    </div>

                </div>
            </CardContent>
            <CardFooter className="flex justify-end">
                <div className="text-xs text-muted resume-upload-status">Status: {status}</div>
                <div className="flex items-center gap-2">
                    <Button size="sm" className="resume-button" onClick={handleUpload} disabled={!file || status === "uploading" || status === "processing"}>
                        {status === "uploading" || status === "processing" ? <IconSpinner /> : "Re-run"}
                    </Button>
                    <Button size="sm" className="resume-button" variant="destructive" onClick={() => handleFile(null)}>Remove</Button>
                </div>
            </CardFooter>
        </Card>
    );

    return (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-6 lg:px-10">
            {/* Left: uploader - full or compact */}
            <div className={collapsed ? "lg:col-span-1" : "lg:col-span-2"}>
                {collapsed ? (
                    CompactUploader
                ) : (
                    <div
                        className="h-72 flex items-center justify-center rounded-lg border-2 border-dashed border-slate-700 bg-surface-1"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={onDrop}
                    >
                        <div className="text-center">
                            <div className="mb-2 text-2xl">Upload your resume</div>
                            <div className="text-sm text-muted mb-4">Accepted: PDF, DOCX. Max file size: 10 MB.</div>

                            <div className="flex items-center gap-2 justify-center">
                                <Button className="resume-button" onClick={() => inputRef.current?.click()}>Choose file</Button>
                                <div className="text-sm text-muted">or drag & drop here</div>
                            </div>

                            <input ref={inputRef} type="file" accept=".docx,.pdf" onChange={onChange} className="hidden" />
                        </div>
                    </div>
                )}

                {/* file card */}
                <div className="mt-4">
                    {file ? (
                        <Card className="relative resume-card"> {/* ensure positioned parent */}
                            <CardHeader>
                                <CardTitle>File</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <div className="font-semibold truncate">{file.name}</div>
                                        <div className="text-sm text-muted">{file.type || "unknown"} • {formatBytes(file.size)}</div>
                                    </div>

                                    {/* keep actions in a fixed-width container so they cannot overflow */}
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        {(status === "uploading" || status === "processing") ? (
                                            <div className="flex items-center gap-2">
                                                <IconSpinner />
                                                <div className="text-sm text-muted">{status === "uploading" ? `Uploading ${progress}%` : "Processing..."}</div>
                                            </div>
                                        ) : (
                                            <div className="text-sm text-muted">Ready</div>
                                        )}


                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="flex items-center justify-between">
                                <div className="text-xs text-muted">Status: {status}</div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleUpload}
                                        disabled={status === "uploading" || status === "processing"}
                                        className="px-3 py-1 resume-button bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50"
                                    >
                                        Upload
                                    </button>

                                    <button
                                        onClick={() => handleFile(null)}
                                        className="px-3 py-1 resume-button bg-slate-700 hover:bg-slate-600 text-white rounded"
                                    >
                                        Remove
                                    </button>
                                </div>
                                {/* optional small controls here if needed */}
                            </CardFooter>
                        </Card>
                    ) : (
                        <div className="text-sm text-muted">No file selected</div>
                    )}

                    {error && <div className="mt-2 text-sm text-red-400">{error}</div>}

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
            <aside className={collapsed ? "lg:col-span-2" : "lg:col-span-1"}>
                {result ? (
                    <>
                        <div className="flex items-start justify-between gap-4 mb-2">
                            <h3 className="text-2xl font-semibold">Analysis</h3>

                            <div className="flex items-center gap-2 flex-shrink-0">
                                {result && (
                                    <>
                                        <button
                                            onClick={() => setCollapsed(!collapsed)}
                                            className="px-2 py-1 resume-button bg-slate-700 text-white rounded text-sm"
                                        >
                                            {collapsed ? "Show uploader" : "Collapse uploader"}
                                        </button>
                                        <button onClick={handleCopyJson} className="px-2 py-1 resume-button bg-slate-700 text-white rounded text-sm">Copy JSON</button>
                                        <button onClick={handleDownloadJson} className="px-2 py-1 resume-button bg-slate-700 text-white rounded text-sm">Download</button>
                                    </>
                                )}
                            </div>
                        </div>


                        {/* Summary */}
                        <div className="mb-3">
                            <div className="bg-surface-2 rounded-lg p-4 shadow-sm border border-surface-3">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h2 className="text-2xl font-bold break-words max-w-[60ch]">
                                            {result.analysis?.insights?.summary?.oneLine ?? "Resume Summary"}
                                        </h2>
                                        <p className="text-sm text-muted mt-2">{result.analysis?.insights?.summary?.["3line"]}</p>
                                        <div className="mt-3 flex gap-2 flex-wrap">
                                            {(result.analysis?.insights?.topRoles ?? []).slice(0, 3).map((r) => (
                                                <Badge key={r.title} className="px-2 py-1">{r.title} ({r.fitScore ?? 0})</Badge>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="text-sm text-muted text-right">
                                        <div className="font-medium">Confidence</div>
                                        <div className="mt-1">{result.analysis?.insights?.confidence ?? "medium"}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Technologies */}
                        <Card className="mb-3 resume-card">
                            <CardHeader>
                                <CardTitle>Technologies</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-2">
                                    {(result.analysis?.skills?.technologies ?? result.skills?.technologies ?? []).map((t) => (
                                        <span key={t} className="px-2 py-1 text-xs rounded bg-slate-800/30">{t}</span>
                                    ))}
                                </div>
                                <div className="mt-3">
                                    <div className="text-sm font-medium">Soft skills</div>
                                    <div className="mt-2 flex gap-2 flex-wrap">
                                        {(result.analysis?.skills?.softSkills ?? result.skills?.softSkills ?? []).map((s) => (
                                            <span key={s} className="px-2 py-1 text-xs rounded bg-amber-800/30">{s}</span>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Experience */}
                        <Card className="mb-3 resume-card">
                            <CardHeader>
                                <CardTitle>Experience</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ol className="list-none space-y-3">
                                    {(result.analysis?.experience ?? result.experience ?? []).map((e: ExperienceItem, idx: number) => (
                                        <li key={idx} className="border-b pb-2">
                                            <div className="font-medium">{e.title}</div>
                                            <div className="text-xs text-muted">{e.company}{e.location ? ` • ${e.location}` : ""}</div>
                                            <div className="text-xs text-muted">{e.duration}</div>
                                        </li>
                                    ))}
                                </ol>
                            </CardContent>
                        </Card>

                        {/* Insights */}
                        <Card className="resume-card">
                            <CardHeader>
                                <CardTitle>Insights</CardTitle>
                            </CardHeader>
                            <CardContent className="overflow-hidden">
                                <div className="space-y-4">
                                    <div>
                                        <div className="font-semibold">Strengths</div>
                                        <ul className="list-disc list-inside mt-2 text-sm break-words">
                                            {(result.analysis?.insights?.strengths ?? []).map((s, i) => (
                                                <li key={i}><strong>{s.text}</strong>: <span className="text-muted">{s.why}</span></li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div>
                                        <div className="font-semibold">Gaps</div>
                                        <ul className="list-disc list-inside mt-2 text-sm break-words">
                                            {(result.analysis?.insights?.gaps ?? []).map((g, i) => (
                                                <li key={i}><strong>{g.missing}</strong>: <span className="text-muted">{g.suggestedLearningOrAction}</span></li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* suggested bullets */}
                                    <div>
                                        <div className="font-semibold">Suggested bullets</div>
                                        <ul className="list-disc list-inside mt-2 text-sm break-words">
                                            {(result.analysis?.insights?.resumeEdits?.improvedBullets ?? []).map((b, idx) => (
                                                <li key={idx}>{b.new}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                ) : (
                    <Card className="resume-card">
                        <CardContent>
                            <div className="text-sm text-muted">No analysis yet — upload a resume to see insights here.</div>
                        </CardContent>
                    </Card>
                )}
            </aside>
        </section>
    );
}
