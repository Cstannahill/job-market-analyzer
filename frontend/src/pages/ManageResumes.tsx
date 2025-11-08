import { Layout } from "@/components/Layout"
import Seo from "@/components/Seo"
import { ManageResumes } from "@/components/resumes/manageResumes/ManageResumes"

export const ManageResumesPage = () => {
    return (
        <Layout>
            <Seo
                title="Register — Job Market Analyzer"
                description="Register for an account on Job Market Analyzer to access personalized features and take full advantage of AI-powered job market insights."
                path="/register"
                image="/public/og/register.avif"
            />
            <div className="flex justify-center mt-5">
                <ManageResumes />
            </div>
        </Layout>
    )
}