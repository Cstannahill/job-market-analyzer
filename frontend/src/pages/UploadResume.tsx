import React from 'react'
import ResumeUploader from '@/components/resume/ResumeUploader'
import { Layout } from '@/components/Layout'

const UploadResume: React.FC = () => {
    return (
        <Layout>
            <h1>Upload Resume</h1>
            <p style={{ color: '#666' }}>
                Upload your resume (PDF or DOCX). We'll extract skills and compare them to market
                trends. Files are uploaded directly to S3 via Amplify Storage.
            </p>
            <ResumeUploader />
        </Layout>
    )
}

export default UploadResume
