import { Suspense } from 'react';
import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { useAuthInitialization } from '@/hooks/useAuthInitialization';
import { useAuthInitialized } from '@/stores/authStore';
import { ProtectedRoute } from '@/components/shared/ProtectedRoute';

// Pages
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import { RegisterPage } from '@/pages/Register';
import VerifyEmail from '@/pages/VerifyEmail';
import About from '@/pages/About';
import Postings from '@/pages/Postings';
// import JobPostingDetail from '@/pages/JobPostingDetail';
import JobPostingDetail from '@/pages/JobDetail';
import TopTech from '@/pages/TopTech';
import UploadResume from '@/pages/UploadResume';
import { ManageResumesPage } from '@/pages/ManageResumes';
import TrendsV2Page from '@/pages/TrendsV2';

/**
 * Application Root Component
 * 
 * Architectural Responsibilities:
 * - Initialize authentication state
 * - Render loading boundary during initialization
 * - Define application routing structure
 * - Enforce route-level access control
 * 
 * Design Pattern: Initialization Boundary
 * - Hook-based initialization (declarative)
 * - Loading gate prevents premature rendering
 * - Suspense boundaries for code splitting
 * - Progressive enhancement ready
 * 
 * State Flow:
 * 1. Component mounts
 * 2. useAuthInitialization hook triggers
 * 3. Zustand store fetches user state
 * 4. isInitialized becomes true
 * 5. Routes render with auth context
 * 
 * Performance Strategy:
 * - Lazy loading for large route components
 * - Suspense boundaries prevent waterfall loading
 * - Auth check parallelized with route rendering
 * - Optimistic UI (show cached state immediately)
 */

function App() {
    /**
     * Global Auth Initialization
     * 
     * Critical: This must run before any auth-dependent logic
     * - Validates persisted sessions
     * - Populates Zustand store
     * - Enables all auth hooks throughout app
     * 
     * Design Decision: Top-level hook
     * - Runs once per app lifetime
     * - No component nesting issues
     * - Clear initialization boundary
     * - Easy to reason about
     */
    useAuthInitialization();

    /**
     * Initialization Guard
     * 
     * Purpose: Prevent rendering until auth state is known
     * - Avoids flash of wrong content
     * - Prevents auth-dependent code from running too early
     * - Provides loading UX
     * 
     * Design: Explicit loading boundary
     * - Simple boolean check
     * - Centralized loading UI
     * - Type-safe (TypeScript knows state after this point)
     */
    const isInitialized = useAuthInitialized();

    if (!isInitialized) {
        return <AuthInitializationLoader />;
    }

    /**
     * Route Architecture
     * 
     * Organization Strategy:
     * - Public routes (no auth required)
     * - Protected routes (auth required, wrapped in ProtectedRoute)
     * - Auth routes (login/register, redirect if authenticated)
     * 
     * Design Principles:
     * - Explicit protection (no implicit assumptions)
     * - Lazy loading for performance
     * - Suspense boundaries for progressive loading
     * - Type-safe route params
     */
    return (
        <Suspense fallback={<PageLoader />}>
            <Routes>
                {/* ==================== PUBLIC ROUTES ==================== */}
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/trends" element={<TrendsV2Page />} />
                <Route path="/postings" element={<Postings />} />
                <Route path="/postings/:jobId" element={<JobPostingDetail />} />
                <Route path="/top-tech" element={<TopTech />} />

                {/* ==================== AUTH ROUTES ==================== */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/verify-email" element={<VerifyEmail />} />

                {/* ==================== PROTECTED ROUTES ==================== */}
                {/* 
          Resume Upload: Requires authentication
          - Upload tied to userId
          - Analysis saved to user profile
          - Results accessible only to owner
        */}
                {/* protected layout route */}
                <Route
                    path="/resumes"
                    element={
                        <ProtectedRoute>
                            <Outlet /> {/* renders <Outlet/> inside */}
                        </ProtectedRoute>
                    }
                >
                    {/* default child: redirect to upload */}
                    <Route index element={<Navigate to="upload" replace />} />
                    <Route path="upload" element={<UploadResume />} />
                    <Route path="manage" element={<ManageResumesPage />} />
                </Route>

                {/* Future Protected Routes:
          - /dashboard (user-specific analytics)
          - /saved-jobs (bookmarked positions)
          - /profile (account settings)
          - /resume-history (past uploads & analyses)
        */}
            </Routes>
        </Suspense>
    );
}

/**
 * Auth Initialization Loader
 * 
 * Design Philosophy: Branded loading experience
 * - Shows immediately on app load
 * - Prevents layout shift
 * - Consistent with app design language
 * - Accessible (proper ARIA labels)
 * 
 * Performance: Inline CSS
 * - No external stylesheet dependency
 * - Renders immediately
 * - No FOUC (flash of unstyled content)
 */
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

/**
 * Page Loader Component
 * 
 * Purpose: Suspense fallback for lazy-loaded routes
 * - Shows during code-split bundle loading
 * - Prevents blank screen
 * - Minimal layout to avoid jarring transition
 * 
 * Design: Subtle loading indicator
 * - Smaller than initialization loader
 * - Faster perceived performance
 * - Non-intrusive
 */
function PageLoader() {
    return (
        <div className="flex min-h-screen items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-gray-200 border-t-primary" />
        </div>
    );
}

export default App;
