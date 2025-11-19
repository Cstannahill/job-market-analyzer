import { Layout } from "@/components/Layout"
import Seo from "@/components/Seo"
import { ManageResumes } from "@/components/resumes/manageResumes/ManageResumes"

export const ManageResumesPage = () => {
    return (
        <Layout>
            <Seo
                title="Manage Resumes – Job Market Analyzer"
                description="Manage your resume uploads and review AI insights alongside market trends."
                path="resumes/manage"
                image="/public/og/td.svg"
            />
            <div className="flex justify-center mt-5">
                <ManageResumes />
            </div>
        </Layout>
    )
}
