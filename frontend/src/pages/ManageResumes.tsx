import { Layout } from "@/components/Layout"
import Seo from "@/components/Seo"
import { ManageResumes } from "@/components/resumes/manageResumes/ManageResumes"

export const ManageResumesPage = () => {
    return (
        <Layout>
            <Seo
                title="Manage Resume — Job Market Analyzer"
                description="Manage your resume to adjust skills as compared to market trends."
                path="/manage-resume"
                image="/public/og/td.svg"
            />
            <div className="flex justify-center mt-5">
                <ManageResumes />
            </div>
        </Layout>
    )
}