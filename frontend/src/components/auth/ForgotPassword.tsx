import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { authService } from "@/services/authService";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
interface ForgotPasswordFormProps {
    redirectTo?: string; // Optional redirect path after login
    onSuccess?: () => void; // Optional callback after successful login
}
export const ForgotPasswordForm = ({ redirectTo, onSuccess }: ForgotPasswordFormProps) => {
    const navigate = useNavigate();
    // Form state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loadingState, setLoadingState] = useState(false);

    // Client-side validation
    const validateForm = (): boolean => {
        if (!email.trim()) {
            setError('Email is required');
            return false;
        }

        if (!password) {
            setError('Password is required');
            return false;
        }

        // Basic email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError('Please enter a valid email address');
            return false;
        }

        return true;
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        setLoadingState(true);
        e.preventDefault();
        setError('');

        // Client-side validation
        if (!validateForm()) {
            return;
        }

        try {
            // Delegate authentication to context
            await authService.login({ email: email.trim(), password });

            // Success - execute callback if provided
            if (onSuccess) {
                onSuccess();
            }

            // Navigate to redirect path
            navigate(redirectTo ?? "/reset-password");
        } catch (err) {
            // Handle authentication errors

            const errorMessage = err instanceof Error
                ? err.message
                : 'Login failed. Please try again.';

            setError(errorMessage);
            setLoadingState(false);
            // Clear password on authentication failure for security
            setPassword('');
        }
    };

    return (
        <form className={cn("flex flex-col gap-6")} onSubmit={handleSubmit}>
            <FieldGroup>
                <div className="flex flex-col items-center gap-1 text-center">
                    <h3 className="text-2xl font-bold">Reset the password to your account</h3>
                    <p className="text-muted-foreground text-sm text-balance">
                        Enter your email below to reset the password to your account
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
                <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input id="email" type="email" placeholder="developer@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
                <Field>
                    <Button type="submit" disabled={loadingState}>{loadingState ? <Spinner /> : 'Send Reset Code'}</Button>
                </Field>
                <Field>
                    <FieldDescription className="text-center">
                        Don&apos;t have an account?{" "}
                        <Link to="/register" className="underline underline-offset-4">
                            Sign up
                        </Link>
                    </FieldDescription>
                </Field>
            </FieldGroup>
        </form>
    )
}