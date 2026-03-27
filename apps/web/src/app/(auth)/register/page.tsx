'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Eye,
  EyeOff,
  Briefcase,
  Code2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Loader2,
  Github,
  Chrome,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { UserRole } from '@freelancer/shared';

// ─── Schema ───────────────────────────────────────────────────────────────────

const registerSchema = z
  .object({
    role: z.nativeEnum(UserRole, {
      required_error: 'Please select a role',
    }),
    firstName: z
      .string({ required_error: 'First name is required' })
      .trim()
      .min(2, 'At least 2 characters')
      .max(50, 'At most 50 characters'),
    lastName: z
      .string({ required_error: 'Last name is required' })
      .trim()
      .min(2, 'At least 2 characters')
      .max(50, 'At most 50 characters'),
    email: z
      .string({ required_error: 'Email is required' })
      .trim()
      .toLowerCase()
      .email('Enter a valid email address'),
    password: z
      .string({ required_error: 'Password is required' })
      .min(8, 'At least 8 characters')
      .max(128, 'At most 128 characters'),
    confirmPassword: z
      .string({ required_error: 'Please confirm your password' })
      .min(1, 'Please confirm your password'),
    acceptTerms: z.boolean().refine((v) => v === true, {
      message: 'You must accept the terms of service',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

// ─── Password strength ────────────────────────────────────────────────────────

interface StrengthResult {
  score: number;
  label: string;
  color: string;
  checks: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
}

function getPasswordStrength(password: string): StrengthResult {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  };
  const score = Object.values(checks).filter(Boolean).length;
  const map: Record<number, { label: string; color: string }> = {
    0: { label: 'Very weak', color: 'bg-destructive' },
    1: { label: 'Weak', color: 'bg-destructive' },
    2: { label: 'Fair', color: 'bg-orange-400' },
    3: { label: 'Good', color: 'bg-yellow-400' },
    4: { label: 'Strong', color: 'bg-green-500' },
    5: { label: 'Very strong', color: 'bg-green-600' },
  };
  return { score, checks, ...map[score] };
}

// ─── Role cards ───────────────────────────────────────────────────────────────

const roles = [
  {
    value: UserRole.CLIENT,
    icon: Briefcase,
    title: 'I want to hire',
    description: 'Post projects and find top freelancers for your needs.',
    gradient: 'from-blue-500 to-cyan-500',
    hoverBorder: 'peer-checked:border-blue-500',
    hoverBg: 'peer-checked:bg-blue-50 dark:peer-checked:bg-blue-900/20',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    checkColor: 'text-blue-600',
  },
  {
    value: UserRole.FREELANCER,
    icon: Code2,
    title: 'I want to work',
    description: 'Browse projects and get paid for your expertise.',
    gradient: 'from-violet-500 to-purple-500',
    hoverBorder: 'peer-checked:border-violet-500',
    hoverBg: 'peer-checked:bg-violet-50 dark:peer-checked:bg-violet-900/20',
    iconBg: 'bg-violet-100 dark:bg-violet-900/30',
    iconColor: 'text-violet-600 dark:text-violet-400',
    checkColor: 'text-violet-600',
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const { registerMutation, isRegistering, registerError, socialLogin } =
    useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordValue, setPasswordValue] = useState('');
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const strength = getPasswordStrength(passwordValue);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: undefined,
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  });

  const selectedRole = watch('role');
  const isLoading = isRegistering || isSubmitting;

  const onSubmit = async (data: RegisterFormData) => {
    registerMutation.mutate({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: data.password,
      role: data.role as any,
    });
  };

  // Derive API error message
  const apiError =
    registerError instanceof Error ? registerError.message : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Create your account
        </h1>
        <p className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>

      {/* Social sign-up */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => socialLogin('google')}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium shadow-sm transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
        >
          <Chrome className="h-4 w-4" />
          Google
        </button>
        <button
          type="button"
          onClick={() => socialLogin('github')}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium shadow-sm transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
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
        <div className="relative flex justify-center">
          <span className="bg-card px-3 text-xs text-muted-foreground">
            or continue with email
          </span>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {/* ── Role selection ────────────────────────────────────────────── */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            I want to…{' '}
            <span className="text-destructive" aria-hidden>
              *
            </span>
          </Label>

          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Account type">
            {roles.map((role) => {
              const Icon = role.icon;
              const isSelected = selectedRole === role.value;

              return (
                <label
                  key={role.value}
                  className={cn(
                    'relative flex cursor-pointer flex-col items-start gap-2 rounded-xl border-2 p-4 transition-all duration-150',
                    isSelected
                      ? cn(
                          'border-primary bg-primary/5',
                          role.value === 'CLIENT'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-violet-500 bg-violet-50 dark:bg-violet-900/20',
                        )
                      : 'border-border hover:border-muted-foreground/30 hover:bg-accent/50',
                  )}
                >
                  <input
                    type="radio"
                    value={role.value}
                    className="sr-only"
                    aria-label={role.title}
                    checked={isSelected}
                    onChange={() =>
                      setValue('role', role.value, { shouldValidate: true })
                    }
                  />

                  {/* Selected checkmark */}
                  {mounted && (
                    <CheckCircle2
                      className={cn(
                        'absolute right-3 top-3 h-4 w-4 transition-all duration-200',
                        role.checkColor,
                        isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-50 pointer-events-none'
                      )}
                      aria-hidden
                    />
                  )}

                  {/* Icon */}
                  <div
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg',
                      role.iconBg,
                    )}
                  >
                    {mounted ? (
                      <Icon className={cn('h-5 w-5', role.iconColor)} />
                    ) : (
                      <div className="h-5 w-5" />
                    )}
                  </div>

                  {/* Text */}
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {role.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
                      {role.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>

          {mounted && errors.role && (
            <p className="flex items-center gap-1 text-xs text-destructive" role="alert">
              <XCircle className="h-3.5 w-3.5 shrink-0" />
              {errors.role.message}
            </p>
          )}
        </div>

        {/* ── Name fields ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="firstName">
              First name{' '}
              <span className="text-destructive" aria-hidden>
                *
              </span>
            </Label>
            <Input
              id="firstName"
              type="text"
              autoComplete="given-name"
              placeholder="Alex"
              aria-invalid={!!errors.firstName}
              aria-describedby={errors.firstName ? 'firstName-error' : undefined}
              {...register('firstName')}
              className={cn(errors.firstName && 'border-destructive focus-visible:ring-destructive')}
            />
            {errors.firstName && (
              <p
                id="firstName-error"
                className="flex items-center gap-1 text-xs text-destructive"
                role="alert"
              >
                <XCircle className="h-3.5 w-3.5 shrink-0" />
                {errors.firstName.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lastName">
              Last name{' '}
              <span className="text-destructive" aria-hidden>
                *
              </span>
            </Label>
            <Input
              id="lastName"
              type="text"
              autoComplete="family-name"
              placeholder="Johnson"
              aria-invalid={!!errors.lastName}
              aria-describedby={errors.lastName ? 'lastName-error' : undefined}
              {...register('lastName')}
              className={cn(errors.lastName && 'border-destructive focus-visible:ring-destructive')}
            />
            {errors.lastName && (
              <p
                id="lastName-error"
                className="flex items-center gap-1 text-xs text-destructive"
                role="alert"
              >
                <XCircle className="h-3.5 w-3.5 shrink-0" />
                {errors.lastName.message}
              </p>
            )}
          </div>
        </div>

        {/* ── Email ─────────────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="email">
            Email address{' '}
            <span className="text-destructive" aria-hidden>
              *
            </span>
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            inputMode="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...register('email')}
            className={cn(errors.email && 'border-destructive focus-visible:ring-destructive')}
          />
          {errors.email && (
            <p
              id="email-error"
              className="flex items-center gap-1 text-xs text-destructive"
              role="alert"
            >
              <XCircle className="h-3.5 w-3.5 shrink-0" />
              {errors.email.message}
            </p>
          )}
        </div>

        {/* ── Password ──────────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="password">
            Password{' '}
            <span className="text-destructive" aria-hidden>
              *
            </span>
          </Label>

          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Create a strong password"
              aria-invalid={!!errors.password}
              aria-describedby="password-strength"
              {...register('password', {
                onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                  setPasswordValue(e.target.value),
              })}
              className={cn(
                'pr-10',
                errors.password && 'border-destructive focus-visible:ring-destructive',
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Strength indicator */}
          {mounted && passwordValue.length > 0 && (
            <div id="password-strength" className="space-y-2" aria-live="polite">
              {/* Bar */}
              <div className="flex gap-1" aria-hidden>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-1.5 flex-1 rounded-full transition-all duration-300',
                      i < strength.score ? strength.color : 'bg-muted',
                    )}
                  />
                ))}
              </div>

              {/* Label */}
              <p className="text-xs text-muted-foreground">
                Strength:{' '}
                <span
                  className={cn(
                    'font-medium',
                    strength.score <= 1
                      ? 'text-destructive'
                      : strength.score === 2
                      ? 'text-orange-500'
                      : strength.score === 3
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-green-600 dark:text-green-400',
                  )}
                >
                  {strength.label}
                </span>
              </p>

              {/* Requirement checks */}
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1" role="list">
                {[
                  { key: 'length' as const, label: '8+ characters' },
                  { key: 'uppercase' as const, label: 'Uppercase letter' },
                  { key: 'lowercase' as const, label: 'Lowercase letter' },
                  { key: 'number' as const, label: 'Number' },
                  { key: 'special' as const, label: 'Special character' },
                ].map(({ key, label }) => (
                  <li
                    key={key}
                    className="flex items-center gap-1.5 text-xs"
                    aria-label={`${label}: ${strength.checks[key] ? 'met' : 'not met'}`}
                  >
                    {strength.checks[key] ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" aria-hidden />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
                    )}
                    <span
                      className={
                        strength.checks[key]
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      }
                    >
                      {label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {errors.password && (
            <p className="flex items-center gap-1 text-xs text-destructive" role="alert">
              <XCircle className="h-3.5 w-3.5 shrink-0" />
              {errors.password.message}
            </p>
          )}
        </div>

        {/* ── Confirm password ──────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">
            Confirm password{' '}
            <span className="text-destructive" aria-hidden>
              *
            </span>
          </Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={
                errors.confirmPassword ? 'confirm-error' : undefined
              }
              {...register('confirmPassword')}
              className={cn(
                'pr-10',
                errors.confirmPassword && 'border-destructive focus-visible:ring-destructive',
              )}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((p) => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
            >
              {showConfirm ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {errors.confirmPassword && (
            <p
              id="confirm-error"
              className="flex items-center gap-1 text-xs text-destructive"
              role="alert"
            >
              <XCircle className="h-3.5 w-3.5 shrink-0" />
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {/* ── Terms of service ──────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <label className="flex cursor-pointer items-start gap-3">
            <div className="relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
              <input
                type="checkbox"
                className="peer h-4 w-4 cursor-pointer rounded border border-input accent-primary"
                aria-describedby={errors.acceptTerms ? 'terms-error' : undefined}
                aria-invalid={!!errors.acceptTerms}
                {...register('acceptTerms')}
              />
            </div>
            <span className="text-sm text-muted-foreground leading-relaxed">
              I agree to the{' '}
              <Link
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline-offset-4 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline-offset-4 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Privacy Policy
              </Link>
            </span>
          </label>
          {errors.acceptTerms && (
            <p
              id="terms-error"
              className="flex items-center gap-1 text-xs text-destructive"
              role="alert"
            >
              <XCircle className="h-3.5 w-3.5 shrink-0" />
              {errors.acceptTerms.message}
            </p>
          )}
        </div>

        {/* ── API error ─────────────────────────────────────────────────── */}
        {mounted && apiError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>{apiError}</p>
          </div>
        )}

        {/* ── Submit ────────────────────────────────────────────────────── */}
        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={isLoading}
          aria-label={isLoading ? 'Creating account…' : 'Create account'}
        >
          {mounted && isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Creating account…
            </>
          ) : (
            <>
              Create account
              <ArrowRight className="h-4 w-4" aria-hidden />
            </>
          )}
        </Button>
      </form>

      {/* Sign in link */}
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Sign in instead
        </Link>
      </p>
    </div>
  );
}
