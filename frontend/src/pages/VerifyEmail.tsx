import { useState, type FormEvent, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { GalleryVerticalEnd } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Nexus from '@/assets/dr3.avif';
import Seo from '@/components/Seo';
import { Layout } from '@/components/Layout';

/**
 * Email Verification Page
 * 
 * Architectural Responsibilities:
 * - Captures 6-digit verification code from user
 * - Provides code resend mechanism with rate limiting UI
 * - Transitions verified users to login flow
 * - Handles edge cases (expired codes, invalid attempts)
 * 
 * State Management Strategy:
 * - Email passed via navigation state (secure, ephemeral)
 * - Verification code never persisted (security)
 * - Resend cooldown prevents abuse
 * - Success state triggers auto-navigation
 * 
 * User Experience Design:
 * - Clear instructions with email confirmation
 * - Real-time validation feedback
 * - Countdown timer for resend (prevents spam)
 * - Loading states prevent duplicate submissions
 * - Success animation before redirect
 */

interface LocationState {
    email?: string;
    fromRegistration?: boolean;
}

const API_BASE_URL = import.meta.env.VITE_AUTH_API_URL;

// Resend cooldown period (seconds)
const RESEND_COOLDOWN = 60;

export default function VerifyEmail() {
    const navigate = useNavigate();
    const location = useLocation();
    const state = location.state as LocationState;

    // Redirect if no email provided
    useEffect(() => {
        if (!state?.email) {
            navigate('/register', { replace: true });
        }
    }, [state, navigate]);

    // Form state
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    // Resend state
    const [resending, setResending] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [resendMessage, setResendMessage] = useState('');

    // Countdown timer for resend button
    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => {
                setResendCooldown(resendCooldown - 1);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

    /**
     * Validate verification code format
     * Cognito sends 6-digit numeric codes
     */
    const validateCode = (): boolean => {
        const codeRegex = /^\d{6}$/;
        if (!codeRegex.test(code)) {
            setError('Verification code must be 6 digits');
            return false;
        }
        return true;
    };

    /**
     * Handle verification code submission
     */
    const handleVerify = async (e: FormEvent) => {
        e.preventDefault();
        setError('');

        if (!validateCode()) {
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/auth/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: state.email,
                    code,
                    action: 'verify',
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Verification failed');
            }

            // Success - show confirmation then navigate
            setSuccess(true);

            // Auto-navigate to login after 2 seconds
            setTimeout(() => {
                navigate('/login', {
                    state: {
                        message: 'Email verified! Please log in.',
                        email: state.email,
                    },
                });
            }, 2000);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Verification failed';
            setError(errorMessage);
            setCode(''); // Clear code on error
        } finally {
            setLoading(false);
        }
    };

    /**
     * Handle resend verification code
     */
    const handleResend = async () => {
        if (resendCooldown > 0) return;

        setResending(true);
        setError('');
        setResendMessage('');

        try {
            const response = await fetch(`${API_BASE_URL}/auth/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: state.email,
                    action: 'resend',
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to resend code');
            }

            setResendMessage(result.message);
            setResendCooldown(RESEND_COOLDOWN);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to resend code';
            setError(errorMessage);
        } finally {
            setResending(false);
        }
    };

    // Success state UI
    if (success) {
        return (
            <Layout>
                <Seo
                    title="Email Verified — Job Market Analyzer"
                    description="Your email has been successfully verified."
                    path="/verify-email"
                />
                <div className="flex min-h-screen items-center justify-center p-6">
                    <div className="w-full max-w-md text-center">
                        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                            <svg
                                className="h-8 w-8 text-green-600 dark:text-green-300"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                />
                            </svg>
                        </div>
                        <h1 className="mb-2 text-2xl font-bold">Email Verified!</h1>
                        <p className="text-muted-foreground mb-4">
                            Your email has been successfully verified. Redirecting to login...
                        </p>
                        <div className="mx-auto h-1 w-32 animate-pulse rounded-full bg-blue-600"></div>
                    </div>
                </div>
            </Layout>
        );
    }

    // Verification form UI
    return (
        <Layout>
            <Seo
                title="Verify Email — Job Market Analyzer"
                description="Verify your email address to complete registration."
                path="/verify-email"
                image="/public/og/verify.avif"
            />
            <div className="grid min-h-svh lg:grid-cols-2">
                {/* Left Column: Verification Form */}
                <div className="flex flex-col gap-4 p-6 md:p-10">
                    {/* Brand Header */}
                    <div className="flex justify-center gap-2 md:justify-start">
                        <a href="/" className="flex items-center gap-2 font-medium">
                            <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
                                <GalleryVerticalEnd className="size-4" />
                            </div>
                            Job Market Analyzer
                        </a>
                    </div>

                    {/* Centered Form Container */}
                    <div className="flex flex-1 items-center justify-center">
                        <div className="w-full max-w-xs">
                            <form onSubmit={handleVerify} className="grid gap-6">
                                <div className="flex flex-col gap-6">
                                    {/* Header */}
                                    <div className="flex flex-col gap-2 text-center">
                                        <h1 className="text-2xl font-bold">Verify Your Email</h1>
                                        <p className="text-balance text-muted-foreground text-sm">
                                            We've sent a 6-digit verification code to{' '}
                                            <span className="font-medium text-foreground">
                                                {state?.email}
                                            </span>
                                        </p>
                                    </div>

                                    {/* Error Display */}
                                    {error && (
                                        <div
                                            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
                                            role="alert"
                                        >
                                            {error}
                                        </div>
                                    )}

                                    {/* Resend Success Message */}
                                    {resendMessage && (
                                        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
                                            {resendMessage}
                                        </div>
                                    )}

                                    {/* Verification Code Input */}
                                    <div className="grid gap-2">
                                        <Label htmlFor="code">Verification Code</Label>
                                        <Input
                                            id="code"
                                            type="text"
                                            inputMode="numeric"
                                            pattern="\d{6}"
                                            maxLength={6}
                                            placeholder="000000"
                                            value={code}
                                            onChange={(e) => {
                                                const value = e.target.value.replace(/\D/g, '');
                                                setCode(value);
                                                if (error) setError('');
                                            }}
                                            disabled={loading}
                                            required
                                            autoFocus
                                            className="text-center text-2xl tracking-widest"
                                        />
                                        <p className="text-muted-foreground text-xs">
                                            Enter the 6-digit code from your email
                                        </p>
                                    </div>

                                    {/* Verify Button */}
                                    <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
                                        {loading ? 'Verifying...' : 'Verify Email'}
                                    </Button>

                                    {/* Resend Code */}
                                    <div className="text-center">
                                        <p className="text-muted-foreground mb-2 text-sm">
                                            Didn't receive the code?
                                        </p>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={handleResend}
                                            disabled={resending || resendCooldown > 0}
                                            className="w-full"
                                        >
                                            {resending
                                                ? 'Sending...'
                                                : resendCooldown > 0
                                                    ? `Resend in ${resendCooldown}s`
                                                    : 'Resend Code'}
                                        </Button>
                                    </div>

                                    {/* Back to Login */}
                                    <div className="text-center text-sm">
                                        <Link to="/login" className="underline underline-offset-4">
                                            Back to Login
                                        </Link>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

                {/* Right Column: Visual Background */}
                <div className="bg-muted relative hidden lg:block">
                    <img
                        src={Nexus}
                        alt="Job Market Visualization"
                        className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
                    />
                </div>
            </div>
        </Layout>
    );
}