import React, { useRef, useState } from 'react'
import { Storage } from 'aws-amplify'

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'complete' | 'failed'

const ACCEPTED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

function formatBytes(n: number) {
    if (n < 1024) return n + ' bytes'
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
    return (n / (1024 * 1024)).toFixed(2) + ' MB'
}

type CompareResult = {
    status: 'processing' | 'complete' | 'failed'
    parsed?: Record<string, unknown>
    analysis?: Record<string, unknown>
    error?: string
}

const ResumeUploader: React.FC = () => {
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const [file, setFile] = useState<File | null>(null)
    const [status, setStatus] = useState<UploadStatus>('idle')
    const [progress, setProgress] = useState<number>(0)
    const [result, setResult] = useState<CompareResult | null>(null)
    const [error, setError] = useState<string | null>(null)

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

    const upload = async () => {
        if (!file) return
        setStatus('uploading')
        try {
            const key = `resumes/${Date.now()}-${file.name}`

            const res = await Storage.put(key, file, {
                contentType: file.type,
                progressCallback(progressEvent: { loaded: number; total?: number }) {
                    const total = progressEvent.total ?? file.size
                    const p = Math.round((progressEvent.loaded / total) * 100)
                    setProgress(p)
                },
            })

            // res may be an object with a 'key' property (Amplify) or a string key depending on setup
            let returnedKey: string
            if (res && typeof res === 'object' && 'key' in res) {
                // safe index access since we've checked 'key' in res
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                returnedKey = (res as { [k: string]: any })['key'] as string
            } else {
                returnedKey = String(res)
            }
            setStatus('processing')

            // Poll compare API
            const poll = async () => {
                try {
                    const id = encodeURIComponent(returnedKey)
                    const r = await fetch(`/api/compare/${id}`)
                    if (r.ok) {
                        const json = (await r.json()) as CompareResult
                        if (json.status === 'complete') {
                            setResult(json)
                            setStatus('complete')
                            setProgress(100)
                            return
                        }
                        if (json.status === 'failed') {
                            setStatus('failed')
                            setError(json.error ?? 'Processing failed')
                            return
                        }
                    }
                } catch (err_) {
                    console.error('poll error', err_)
                }
                setTimeout(poll, 2000)
            }

            setTimeout(poll, 1500)
        } catch (err_) {
            const e = err_ as Error
            console.error('upload error', e)
            setError(e.message ?? 'Upload failed')
            setStatus('failed')
        }
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
                    accept=".pdf, .docx"
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
                                        <div style={{ height: 8, background: '#f1f1f1', borderRadius: 4 }}>
                                            <div
                                                style={{
                                                    width: `${progress}%`,
                                                    height: 8,
                                                    background: '#007acc',
                                                    borderRadius: 4,
                                                }}
                                            />
                                        </div>
                                        <div style={{ fontSize: 12, color: '#444', marginTop: 6 }}>{progress}%</div>
                                    </div>
                                )}

                                {status === 'processing' && <div>Processing... (this may take a few seconds)</div>}

                                {status === 'complete' && result && (
                                    <div>
                                        <div style={{ fontWeight: 600 }}>Analysis</div>
                                        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(result.analysis ?? result.parsed ?? result, null, 2)}</pre>
                                    </div>
                                )}

                                {status === 'failed' && <div style={{ color: 'red' }}>{error}</div>}

                                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                    <button onClick={upload} disabled={status === 'uploading' || status === 'processing' || !file}>
                                        Upload
                                    </button>
                                    <button
                                        onClick={() => {
                                            setFile(null)
                                            setStatus('idle')
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
