import React, { useRef, useState } from 'react'

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'complete' | 'failed'

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

type CompareResult = {
    status: 'processing' | 'complete' | 'failed'
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

    const API_BASE = process.env.REACT_APP_API_URL || 'https://your-api-endpoint.com'
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

    const upload = async () => {
        if (!file) return
        setStatus('uploading')
        setError(null)

        try {
            // Step 1: Get presigned URL from Lambda
            const presignedRes = await fetch(`${API_BASE}/presigned-url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: file.name,
                    contentType: file.type,
                }),
            })

            if (!presignedRes.ok) {
                throw new Error('Failed to get presigned URL')
            }

            const { url, key } = await presignedRes.json()

            // Step 2: Upload directly to S3
            const uploadRes = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': file.type },
                body: file,
            })

            if (!uploadRes.ok) {
                throw new Error('Upload to S3 failed')
            }

            console.log('File uploaded to S3:', key)
            setStatus('processing')

            // Step 3: Poll Lambda for processing
            const poll = async () => {
                try {
                    const id = encodeURIComponent(key)
                    const response = await fetch(`${API_BASE}/compare/${id}`)

                    if (response.ok) {
                        const json = (await response.json()) as CompareResult

                        if (json.status === 'complete') {
                            setResult(json)
                            setStatus('complete')
                            setProgress(100)
                            return
                        }

                        if (json.status === 'failed') {
                            setStatus('failed')
                            setError(json.error || 'Processing failed')
                            return
                        }
                    }

                    setTimeout(poll, 2000)
                } catch (err) {
                    console.error('Poll error:', err)
                    setTimeout(poll, 2000)
                }
            }

            setTimeout(poll, 1500)
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            console.error('Upload error:', error)
            setError(error.message || 'Upload failed')
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
                                        onClick={upload}
                                        disabled={
                                            status === 'uploading' ||
                                            status === 'processing' ||
                                            !file
                                        }
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