import React from 'react'
import { Layout } from '@/components/Layout'
import ResumeUploader from '@/components/resumes/ResumeUploader'
import Seo from '@/components/Seo'

const UploadResume: React.FC = () => {
    return (
        <Layout>
            <Seo
                title="Upload Resume — Job Market Analyzer"
                description="Upload your resume to analyze skills and compare with market trends."
                path="/upload-resume"
                image="/public/og/td.svg"
            />
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
