import { Button } from "@/components/ui/button";
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { authService } from "@/services/authService";
import type {
    PasswordResetInitiateRequest,
    ConfirmForgotPasswordRequest,
} from "@job-market-analyzer/types";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

interface ForgotPasswordFormProps {
    redirectTo?: string; // Optional redirect path after reset
    onSuccess?: () => void; // Optional callback after successful reset
}

type Step = "REQUEST" | "CONFIRM";

export const ForgotPasswordForm = ({
    redirectTo,
    onSuccess,
}: ForgotPasswordFormProps) => {
    const navigate = useNavigate();

    const [step, setStep] = useState<Step>("REQUEST");
    const [email, setEmail] = useState<string>("");
    const [code, setCode] = useState<string>("");
    const [newPassword, setNewPassword] = useState<string>("");
    const [confirmNewPassword, setConfirmNewPassword] = useState<string>("");
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loadingState, setLoadingState] = useState(false);

    // --- Validation ---

    const validateEmailStep = (): boolean => {
        if (!email.trim()) {
            setError("Email is required");
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError("Please enter a valid email address");
            return false;
        }

        return true;
    };

    const validateConfirmStep = (): boolean => {
        if (!code.trim()) {
            setError("Verification code is required");
            return false;
        }

        if (!newPassword.trim()) {
            setError("New password is required");
            return false;
        }

        if (newPassword.length < 8) {
            setError("Password must be at least 8 characters");
            return false;
        }

        if (newPassword !== confirmNewPassword) {
            setError("Passwords do not match");
            return false;
        }

        return true;
    };

    // --- Submit handler that branches based on step ---

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        setMessage(null);

        if (step === "REQUEST") {
            if (!validateEmailStep()) return;

            setLoadingState(true);
            try {
                const payload: PasswordResetInitiateRequest = { email };
                await authService.forgotPasswordInitiate(payload);
                setMessage(
                    "If an account exists for this email, we've sent a verification code."
                );
                setStep("CONFIRM");
            } catch (err) {
                console.error("Forgot password initiate failed:", err);
                setError(
                    err as string
                );
            } finally {
                setLoadingState(false);
            }
        } else {
            if (!validateConfirmStep()) return;

            setLoadingState(true);
            try {
                const payload: ConfirmForgotPasswordRequest = {
                    email,
                    code,
                    newPassword,
                };
                await authService.resetPassword(payload);

                setMessage("Password reset successfully. You can now sign in.");

                if (onSuccess) onSuccess();
                if (redirectTo) {
                    navigate(redirectTo);
                } else {
                    navigate("/login");
                }
            } catch (err) {
                console.error("Password reset failed:", err);
                setError(
                    err as string

                );
            } finally {
                setLoadingState(false);
            }
        }
    };

    return (
        <form className={cn("flex flex-col gap-6")} onSubmit={handleSubmit}>
            <FieldGroup>
                {/* Header */}
                <div className="flex flex-col items-center gap-1 text-center">
                    {step === "REQUEST" ? (
                        <>
                            <h3 className="text-2xl font-bold">Reset your password</h3>
                            <p className="text-muted-foreground text-sm text-balance">
                                Enter the email associated with your account and we&apos;ll send
                                you a reset code.
                            </p>
                        </>
                    ) : (
                        <>
                            <h3 className="text-2xl font-bold">Enter reset code</h3>
                            <p className="text-muted-foreground text-sm text-balance">
                                We&apos;ve sent a verification code to <strong>{email}</strong>.
                                Enter it below along with your new password.
                            </p>
                        </>
                    )}
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

                {/* Message Display */}
                {message && (
                    <div
                        className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                        role="status"
                        aria-live="polite"
                    >
                        {message}
                    </div>
                )}

                {/* Step-specific fields */}
                {step === "REQUEST" ? (
                    <>
                        <Field>
                            <FieldLabel htmlFor="email">Email</FieldLabel>
                            <Input
                                id="email"
                                type="email"
                                placeholder="developer@example.com"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </Field>
                    </>
                ) : (
                    <>
                        <Field>
                            <FieldLabel htmlFor="code">Verification Code</FieldLabel>
                            <Input
                                id="code"
                                type="text"
                                placeholder="Enter the code you received"
                                required
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="newPassword">New Password</FieldLabel>
                            <Input
                                id="newPassword"
                                type="password"
                                placeholder="New password"
                                required
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="confirmNewPassword">
                                Confirm New Password
                            </FieldLabel>
                            <Input
                                id="confirmNewPassword"
                                type="password"
                                placeholder="Confirm new password"
                                required
                                value={confirmNewPassword}
                                onChange={(e) => setConfirmNewPassword(e.target.value)}
                            />
                        </Field>
                    </>
                )}

                {/* Submit button */}
                <Field>
                    <Button type="submit" disabled={loadingState} className="w-full">
                        {loadingState ? <Spinner /> : null}
                        {!loadingState &&
                            (step === "REQUEST" ? "Send Reset Code" : "Reset Password")}
                    </Button>
                </Field>

                {/* Footer links */}
                <Field>
                    <FieldDescription className="text-center">
                        Remember your password?{" "}
                        <Link to="/login" className="underline underline-offset-4">
                            Back to login
                        </Link>
                    </FieldDescription>
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
    );
};
