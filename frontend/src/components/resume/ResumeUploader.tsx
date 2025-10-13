import React, { useRef, useState } from 'react'
import { type UploadStatus, type CompareResult, uploadResume } from '@/services/resumeService'


const ACCEPTED_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

function formatBytes(n: number) {
    if (n < 1024) return n + ' bytes'
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
    return (n / (1024 * 1024)).toFixed(2) + ' MB'
}



const ResumeUploader: React.FC = () => {
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const [file, setFile] = useState<File | null>(null)
    const [status, setStatus] = useState<UploadStatus>('idle')
    const [progress, setProgress] = useState<number>(0)
    const [result, setResult] = useState<CompareResult | null>(null)
    const [error, setError] = useState<string | null>(null)

    const API_BASE = 'https://xee5kjisf5.execute-api.us-east-1.amazonaws.com/prod'
    console.log(API_BASE)

    const API_KEY = 'WWKCpCzlkn5N3JCce4HXp5HYtUt7mPOk1HU6aP1t'
    console.log(API_KEY)
    console.log(progress)
    const validate = (f: File) => {
        if (f.size > MAX_BYTES) return 'File is too large (max 10 MB)'
        if (!ACCEPTED_TYPES.includes(f.type)) return 'Unsupported file type'
        return null
    }

    const handlePick = () => fileInputRef.current?.click()

    const handleFile = (f: File | null) => {
        setError(null)
        setResult(null)
        setProgress(0)

        if (!f) {
            setFile(null)
            setStatus('idle')
            return
        }

        const v = validate(f)
        if (v) {
            setError(v)
            setFile(null)
            setStatus('failed')
            return
        }

        setFile(f)
        setStatus('idle')
    }

    const onChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
        const f = e.target.files?.[0] ?? null
        handleFile(f)
    }
    return (
        <section aria-live="polite">
            <div
                style={{
                    border: '2px dashed #ccc',
                    padding: 20,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                }}
            >
                <div style={{ flex: 1 }}>
                    <p style={{ margin: 0 }}>
                        Drag & drop your resume here, or
                        <button onClick={handlePick} style={{ marginLeft: 8 }}>
                            choose a file
                        </button>
                    </p>
                    <p style={{ marginTop: 6, color: '#666' }}>
                        Accepted: PDF, DOCX. Max file size: 10 MB.
                    </p>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx"
                    onChange={onChange}
                    style={{ display: 'none' }}
                />

                <div style={{ width: 320 }}>
                    {file ? (
                        <div style={{ border: '1px solid #eee', padding: 8, borderRadius: 6 }}>
                            <div style={{ fontWeight: 600 }}>{file.name}</div>
                            <div style={{ fontSize: 12, color: '#666' }}>
                                {file.type || 'unknown'} • {formatBytes(file.size)}
                            </div>

                            <div style={{ marginTop: 8 }}>
                                {status === 'uploading' && (
                                    <div>
                                        <div>Uploading to S3...</div>
                                    </div>
                                )}

                                {status === 'processing' && (
                                    <div>Processing... (this may take a few seconds)</div>
                                )}

                                {status === 'complete' && result && (
                                    <div>
                                        <div style={{ fontWeight: 600 }}>Analysis</div>
                                        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
                                            {JSON.stringify(result.analysis || result, null, 2)}
                                        </pre>
                                    </div>
                                )}

                                {status === 'failed' && (
                                    <div style={{ color: 'red' }}>{error}</div>
                                )}

                                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                    <button
                                        onClick={() =>
                                            file &&
                                            uploadResume({
                                                file,
                                                setStatus,
                                                setProgress,
                                                setError,
                                                setResult,
                                                // optional: apiBase: 'https://...', apiKey: '...' if you need to override
                                            })
                                        }
                                        disabled={status === 'uploading' || status === 'processing' || !file}
                                    >
                                        Upload
                                    </button>
                                    <button
                                        onClick={() => {
                                            setFile(null)
                                            setStatus('idle')
                                            setProgress(0)
                                            setError(null)
                                        }}
                                        disabled={status === 'uploading' || status === 'processing'}
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ color: '#888' }}>No file selected</div>
                    )}
                </div>
            </div>
        </section>
    )
}

export default ResumeUploader