import { Suspense, lazy } from 'react';
import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { useAuthInitialization } from '@/hooks/useAuthInitialization';
import { useAuthInitialized } from '@/stores/authStore';
import { ProtectedRoute } from '@/components/shared/ProtectedRoute';
import ForgotPassword from '@/pages/ForgotPassword';

// Lazy-loaded pages (route-level code splitting)
const Home = lazy(() => import('@/pages/Home'));
const Login = lazy(() => import('@/pages/Login'));
const RegisterPage = lazy(() =>
    import('@/pages/Register').then((module) => ({ default: module.RegisterPage })),
);
const VerifyEmail = lazy(() => import('@/pages/VerifyEmail'));
const About = lazy(() => import('@/pages/About'));
const Postings = lazy(() => import('@/pages/Postings'));
const JobPostingDetail = lazy(() => import('@/pages/JobDetail'));
const TopTech = lazy(() => import('@/pages/TopTech'));
const UploadResume = lazy(() => import('@/pages/UploadResume'));
const ManageResumesPage = lazy(() =>
    import('@/pages/ManageResumes').then((module) => ({ default: module.ManageResumesPage })),
);
const TrendsV2Page = lazy(() => import('@/pages/TrendsV2'));

function App() {
    useAuthInitialization();
    const isInitialized = useAuthInitialized();

    if (!isInitialized) {
        return <AuthInitializationLoader />;
    }


    return (
        <Suspense fallback={<PageLoader />}>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/trends" element={<TrendsV2Page />} />
                <Route path="/postings" element={<Postings />} />
                <Route path="/postings/:jobId" element={<JobPostingDetail />} />
                <Route path="/top-tech" element={<TopTech />} />

                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/verify-email" element={<VerifyEmail />} />


                <Route
                    path="/resumes"
                    element={
                        <ProtectedRoute>
                            <Outlet />
                        </ProtectedRoute>
                    }
                >
                    <Route index element={<Navigate to="upload" replace />} />
                    <Route path="upload" element={<UploadResume />} />
                    <Route path="manage" element={<ManageResumesPage />} />
                </Route>

            </Routes>
        </Suspense>
    );
}

function AuthInitializationLoader() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="text-center">
                {/* Spinner */}
                <div
                    className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-primary"
                    role="status"
                    aria-label="Loading"
                />

                {/* Loading Text */}
                <p className="text-muted-foreground text-sm animate-pulse text-center">
                    Initializing application...
                </p>
            </div>
        </div>
    );
}


function PageLoader() {
    return (
        <div className="flex min-h-screen items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-gray-200 border-t-primary" />
        </div>
    );
}

export default App;
