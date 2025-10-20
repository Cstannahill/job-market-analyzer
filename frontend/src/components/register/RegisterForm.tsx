import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Star from "@/assets/star.avif";
import { useAuthLoading } from '@/stores/authStore';
import { authService } from '@/services/authService';

/**
 * RegisterForm Component
 * 
 * Architectural Responsibilities:
 * - Captures user registration data with validation
 * - Enforces password strength requirements
 * - Delegates registration to AuthContext
 * - Provides user feedback throughout registration flow
 * - Handles email verification instructions
 * 
 * State Management Strategy:
 * - Form state isolated to component (single responsibility)
 * - Success state triggers informational UI (not navigation)
 * - Error state provides actionable feedback
 * - Loading state prevents duplicate submissions
 * 
 * Security Considerations:
 * - Client-side password validation (defense in depth)
 * - Clear error messages without revealing system details
 * - Password confirmation prevents typos
 * - No sensitive data stored in component state after submission
 */

interface FormData {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
}

const initialFormData: FormData = {
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
};

export function RegisterForm() {
    const navigate = useNavigate();
    const loading = useAuthLoading();

    // Form state
    const [formData, setFormData] = useState<FormData>(initialFormData);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    // Handle input changes
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
        // Clear error when user starts typing
        if (error) setError('');
    };

    // Password strength validation
    const validatePassword = (password: string): { valid: boolean; message: string } => {
        if (password.length < 8) {
            return { valid: false, message: 'Password must be at least 8 characters long' };
        }

        if (!/[a-z]/.test(password)) {
            return { valid: false, message: 'Password must contain at least one lowercase letter' };
        }

        if (!/[A-Z]/.test(password)) {
            return { valid: false, message: 'Password must contain at least one uppercase letter' };
        }

        if (!/[0-9]/.test(password)) {
            return { valid: false, message: 'Password must contain at least one number' };
        }

        if (!/[^a-zA-Z0-9]/.test(password)) {
            return { valid: false, message: 'Password must contain at least one special character' };
        }

        return { valid: true, message: '' };
    };

    // Comprehensive form validation
    const validateForm = (): boolean => {
        // Name validation
        if (!formData.name.trim()) {
            setError('Name is required');
            return false;
        }

        // Email validation
        if (!formData.email.trim()) {
            setError('Email is required');
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            setError('Please enter a valid email address');
            return false;
        }

        // Password validation
        const passwordValidation = validatePassword(formData.password);
        if (!passwordValidation.valid) {
            setError(passwordValidation.message);
            return false;
        }

        // Password confirmation
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return false;
        }

        return true;
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        // Validate form
        if (!validateForm()) {
            return;
        }

        try {
            // Delegate registration to context
            const result = await authService.register({
                email: formData.email.trim(),
                password: formData.password,
                name: formData.name.trim(),
            });

            // Registration successful - redirect to verification page
            setSuccess(true);
            setFormData(initialFormData);
            if (result && result.message) {
                console.log("Verification Sent!")
            }
            // Redirect to email verification with email in state
            setTimeout(() => {
                navigate('/verify-email', {
                    state: {
                        email: formData.email.trim(),
                        fromRegistration: true,
                    },
                });
            }, 1500);
        } catch (err) {
            const errorMessage = err instanceof Error
                ? err.message
                : 'Registration failed. Please try again.';

            setError(errorMessage);
        }
    };

    // Success state UI
    if (success) {
        return (
            <div className="grid min-h-svh lg:grid-cols-2">
                <div className="flex flex-col gap-4 p-6 md:p-10">
                    <div className="flex flex-1 items-center justify-center">
                        <div className="w-full max-w-xs">
                            <div className="grid gap-6">
                                <div className="flex flex-col gap-2 text-center">
                                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                                        <svg
                                            className="h-6 w-6 text-green-600 dark:text-green-300"
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
                                    <h1 className="text-2xl font-bold">Registration Successful!</h1>
                                    <p className="text-balance text-muted-foreground text-sm">
                                        Please check your email for a verification link. You'll need to verify your
                                        email before you can log in.
                                    </p>
                                </div>
                                <Button onClick={() => navigate('/login')} className="w-full">
                                    Go to Login
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-muted relative hidden lg:block">

                </div>
            </div>
        );
    }

    // Registration form UI
    return (
        <div className="grid min-h-svh lg:grid-cols-2">
            <div className="flex flex-col gap-4 p-6 md:p-10">
                <div className="flex flex-1 items-center justify-center">
                    <div className="w-full max-w-xs">
                        <form onSubmit={handleSubmit} className="grid gap-6">
                            <div className="flex flex-col gap-6">
                                {/* Header */}
                                <div className="flex flex-col gap-2 text-center">
                                    <h3 className="text-2xl font-bold">Create an account</h3>
                                    <p className="text-balance text-muted-foreground text-sm">
                                        Enter your information to get started
                                    </p>
                                </div>

                                {/* Error Display */}
                                {error && (
                                    <div
                                        className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
                                        role="alert"
                                        aria-live="polite"
                                    >
                                        {error}
                                    </div>
                                )}

                                {/* Form Fields */}
                                <div className="grid gap-6">
                                    <div className="grid gap-2">
                                        <Label htmlFor="name">Name</Label>
                                        <Input
                                            id="name"
                                            name="name"
                                            type="text"
                                            placeholder="John Doe"
                                            value={formData.name}
                                            onChange={handleChange}
                                            disabled={loading}
                                            required
                                            autoComplete="name"
                                            autoFocus
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="email">Email</Label>
                                        <Input
                                            id="email"
                                            name="email"
                                            type="email"
                                            placeholder="developer@example.com"
                                            value={formData.email}
                                            onChange={handleChange}
                                            disabled={loading}
                                            required
                                            autoComplete="email"
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="password">Password</Label>
                                        <Input
                                            id="password"
                                            name="password"
                                            type="password"
                                            value={formData.password}
                                            onChange={handleChange}
                                            disabled={loading}
                                            required
                                            autoComplete="new-password"
                                        />
                                        <p className="text-muted-foreground text-xs">
                                            Must be 8+ characters with uppercase, lowercase, number, and special character
                                        </p>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                                        <Input
                                            id="confirmPassword"
                                            name="confirmPassword"
                                            type="password"
                                            value={formData.confirmPassword}
                                            onChange={handleChange}
                                            disabled={loading}
                                            required
                                            autoComplete="new-password"
                                        />
                                    </div>

                                    <Button type="submit" className="w-full" disabled={loading}>
                                        {loading ? 'Creating account...' : 'Create account'}
                                    </Button>
                                </div>

                                {/* Login Link */}
                                <div className="text-center text-sm">
                                    Already have an account?{' '}
                                    <Link to="/login" className="underline underline-offset-4">
                                        Login
                                    </Link>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
            <div className="bg-muted relative hidden lg:block">
                <img
                    src={Star}
                    alt="Trend Dev Visualization"
                    className="absolute inset-0 h-full w-full object-cover rounded-lg border-1 border-stone-700"
                />
            </div>
        </div>
    );
}