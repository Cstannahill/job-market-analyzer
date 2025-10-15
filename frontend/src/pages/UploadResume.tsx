import React from 'react'
import { Layout } from '@/components/Layout'
import ResumeUploaderModern from '@/components/resume/ResumeUploaderCards'

const UploadResume: React.FC = () => {
    return (
        <Layout>
            <h1>Upload Resume</h1>
            <p style={{ color: '#666' }}>
                Upload your resume (PDF or DOCX). We'll extract skills and compare them to market
                trends. Files are uploaded directly to S3 via Amplify Storage.
            </p>
            <ResumeUploaderModern />
        </Layout>
    )
}

export default UploadResume
