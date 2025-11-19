import { Layout } from "@/components/Layout";
import { RegisterForm } from "@/components/register/RegisterForm"
import Seo from "@/components/Seo";
import { Card } from "@/components/ui/card";


export const RegisterPage = () => {
    return (
        <Layout>
            <Seo
                title="Register - Job Market Analyzer"
                description="Register for an account on Job Market Analyzer to access personalized features and take full advantage of AI-powered job market insights."
                path="register"
                image="/public/og/register.avif"
            />
            <Card className="overflow-hidden auth-card">
                <RegisterForm />
            </Card>
        </Layout>
    );
}
