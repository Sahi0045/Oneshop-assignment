'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Mail, Lock, AlertCircle, Github, Chrome } from 'lucide-react';
import { loginSchema, type LoginInput } from '@freelancer/shared';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

// ─── Component ────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const { loginMutation, socialLogin, isLoggingIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const isPending = isLoggingIn || isSubmitting;

  // ── Submit handler ─────────────────────────────────────────────────────────

  const onSubmit = async (data: LoginInput) => {
    try {
      await loginMutation.mutateAsync(data);
      // Redirect handled inside loginMutation.onSuccess
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { data?: { message?: string; errors?: Record<string, string[]> } };
        message?: string;
      };

      const message =
        axiosError?.response?.data?.message ??
        axiosError?.message ??
        'Invalid email or password. Please try again.';

      // Map server validation errors to form fields if provided
      const serverErrors = axiosError?.response?.data?.errors;
      if (serverErrors) {
        Object.entries(serverErrors).forEach(([field, messages]) => {
          setError(field as keyof LoginInput, {
            type: 'server',
            message: Array.isArray(messages) ? messages[0] : String(messages),
          });
        });
      } else {
        // Generic credential error — show on password field to avoid leaking info
        setError('password', { type: 'server', message });
      }
    }
  };

  // ── Social login ───────────────────────────────────────────────────────────

  const handleGoogleLogin = () => socialLogin('google');
  const handleGithubLogin = () => socialLogin('github');

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign in to your FreelancerHub account
        </p>
      </div>

      {/* Social login buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isPending}
          className={cn(
            'inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input',
            'bg-background px-4 text-sm font-medium text-foreground',
            'shadow-sm hover:bg-accent hover:text-accent-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
          )}
          aria-label="Continue with Google"
        >
          <GoogleIcon />
          Google
        </button>

        <button
          type="button"
          onClick={handleGithubLogin}
          disabled={isPending}
          className={cn(
            'inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input',
            'bg-background px-4 text-sm font-medium text-foreground',
            'shadow-sm hover:bg-accent hover:text-accent-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
          )}
          aria-label="Continue with GitHub"
        >
          <Github className="h-4 w-4" />
          GitHub
        </button>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-card px-3 text-muted-foreground font-medium">
            or continue with email
          </span>
        </div>
      </div>

      {/* Login form */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-5"
        noValidate
        aria-label="Login form"
      >
        {/* Email field */}
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="text-sm font-medium text-foreground leading-none"
          >
            Email address
          </label>
          <div className="relative">
            <Mail
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              disabled={isPending}
              placeholder="you@example.com"
              {...register('email')}
              className={cn(
                'flex h-10 w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm',
                'ring-offset-background placeholder:text-muted-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
                errors.email
                  ? 'border-destructive focus-visible:ring-destructive'
                  : 'border-input',
              )}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
          </div>
          {errors.email && (
            <p
              id="email-error"
              role="alert"
              className="flex items-center gap-1.5 text-xs text-destructive mt-1"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-sm font-medium text-foreground leading-none"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-primary underline-offset-4 hover:underline transition-colors"
              tabIndex={0}
            >
              Forgot password?
            </Link>
          </div>

          <div className="relative">
            <Lock
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              disabled={isPending}
              placeholder="Enter your password"
              {...register('password')}
              className={cn(
                'flex h-10 w-full rounded-md border bg-background pl-9 pr-10 py-2 text-sm',
                'ring-offset-background placeholder:text-muted-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
                errors.password
                  ? 'border-destructive focus-visible:ring-destructive'
                  : 'border-input',
              )}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
            />

            {/* Show/hide password toggle */}
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              disabled={isPending}
              className={cn(
                'absolute right-3 top-1/2 -translate-y-1/2',
                'text-muted-foreground hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm',
                'disabled:pointer-events-none transition-colors',
              )}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>

          {errors.password && (
            <p
              id="password-error"
              role="alert"
              className="flex items-center gap-1.5 text-xs text-destructive mt-1"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Remember me */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            role="checkbox"
            aria-checked={rememberMe}
            id="remember-me"
            onClick={() => setRememberMe((prev) => !prev)}
            disabled={isPending}
            className={cn(
              'flex h-4 w-4 shrink-0 items-center justify-center rounded',
              'border border-input transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              rememberMe
                ? 'bg-primary border-primary text-primary-foreground'
                : 'bg-background hover:border-primary/50',
            )}
          >
            {rememberMe && (
              <svg
                viewBox="0 0 12 12"
                fill="none"
                className="h-2.5 w-2.5"
                aria-hidden="true"
              >
                <path
                  d="M2 6l3 3 5-5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
          <label
            htmlFor="remember-me"
            className="text-sm text-muted-foreground select-none cursor-pointer"
            onClick={() => !isPending && setRememberMe((prev) => !prev)}
          >
            Remember me for 30 days
          </label>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={isPending}
          className={cn(
            'inline-flex h-10 w-full items-center justify-center gap-2 rounded-md',
            'bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow',
            'hover:bg-primary/90 active:bg-primary/95',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
          )}
          aria-busy={isPending}
        >
          {isPending ? (
            <>
              <svg
                className="h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      {/* Register link */}
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="font-semibold text-primary underline-offset-4 hover:underline transition-colors"
        >
          Create one free
        </Link>
      </p>
    </div>
  );
}

// ─── Google Icon ──────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
