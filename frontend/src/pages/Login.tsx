// src/pages/Login.tsx
import { LoginForm } from '@/components/login/LoginForm';
// import Star from "@/assets/star2.avif";
import DataRiver from "@/assets/dr3.avif"
import Seo from '@/components/Seo';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/ui/card';

export default function Login() {

    return (
        <Layout>
            <Seo
                title="Login - Job Market Analyzer"
                description="Login to your account on Job Market Analyzer to access personalized features and take full advantage of AI-powered job market insights."
                path="login"
                image="/public/og/register.avif"
            />
            <Card className="auth-card overflow-hidden">
                <div className="grid min-h-svh lg:grid-cols-2">
                    <div className="flex flex-col gap-4 p-6 md:p-10">
                        <div className="flex flex-1 items-center justify-center">
                            <div className="w-full max-w-xs">
                                <LoginForm />
                            </div>
                        </div>
                    </div>
                    <div className="bg-muted relative hidden lg:block rounded-xl register-image-div">
                        <img
                            src={DataRiver}
                            alt="Trend Dev Visualization"
                            style={{ objectFit: "cover" }}
                            className="absolute inset-0 h-full w-full object-cover rounded-lg border border-stone-700"
                        />
                    </div>
                </div>
            </Card>
        </Layout>
    )
}
