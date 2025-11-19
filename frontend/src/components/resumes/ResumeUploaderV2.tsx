// ResumeUploaderModern.tsx
import React, { useEffect, useRef, useState } from "react";
import { uploadResume, type UploadStatus } from "@/services/resumeService";
import type { CompareResult, ResumeRecord } from "@job-market-analyzer/types";

// shadcn/ui imports — change paths if your project places them elsewhere
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/stores/authStore";
import { ResumeCard } from "@/components/resumes/manageResumes/ResumeCard";
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
        console.log(user?.userId, "FROM RESUME UPLOADER")
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
        const blob = new Blob([JSON.stringify(result ?? result, null, 2)], {
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
            await navigator.clipboard.writeText(JSON.stringify(result ?? result, null, 2));
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
                                    <div className="flex items-center gap-3 shrink-0">
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

                            <div className="flex items-center gap-2 shrink-0">
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
                        <ResumeCard resume={result as ResumeRecord} />
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
