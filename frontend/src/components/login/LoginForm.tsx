import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner";
import { authService } from "@/services/authService";
interface LoginFormProps {
  redirectTo?: string;
  onSuccess?: () => void;
}
export function LoginForm({ redirectTo = '/', onSuccess }: LoginFormProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loadingState, setLoadingState] = useState(false);

  const validateForm = (): boolean => {
    if (!email.trim()) {
      setError('Email is required');
      return false;
    }

    if (!password) {
      setError('Password is required');
      return false;
    }

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

    if (!validateForm()) {
      return;
    }

    try {
      await authService.login({ email: email.trim(), password });

      if (onSuccess) {
        onSuccess();
      }

      navigate(redirectTo);
    } catch (err) {

      const errorMessage = err instanceof Error
        ? err.message
        : 'Login failed. Please try again.';

      setError(errorMessage);
      setLoadingState(false);
      setPassword('');
    }
  };

  return (
    <form className={cn("flex flex-col gap-6")} onSubmit={handleSubmit}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h3 className="text-2xl font-bold">Login to your account</h3>
          <p className="text-muted-foreground text-sm text-balance">
            Enter your email below to login to your account
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
          <div className="flex ">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Link
              to="/forgot-password"
              className="ml-auto forgot-password-link text-sm underline-offset-4 hover:underline"
            >
              Forgot your password?
            </Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field>
          <Button type="submit" disabled={loadingState}>{loadingState ? <Spinner /> : 'Login'}</Button>
        </Field>
        <FieldSeparator><small className="p-3 m-0 text-center bg-card or-continue-with">Or continue with</small></FieldSeparator>

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
