'use client';

import Link from 'next/link';
import { Home, Search, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      {/* Decorative blob */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-md space-y-8">
        {/* Large 404 number */}
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            Error 404
          </p>
          <h1 className="text-8xl font-extrabold tracking-tight text-foreground select-none">
            404
          </h1>
        </div>

        {/* Illustration */}
        <div className="flex justify-center">
          <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-muted">
            <Search className="h-14 w-14 text-muted-foreground/50" strokeWidth={1.5} />
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-sm font-bold shadow"
            >
              ?
            </span>
          </div>
        </div>

        {/* Message */}
        <div className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Page not found
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            Sorry, we couldn&apos;t find the page you&apos;re looking for. It
            may have been moved, deleted, or never existed in the first place.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Home className="h-4 w-4" />
            Go home
          </Link>

          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-6 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </button>
        </div>

        {/* Helpful links */}
        <div className="border-t border-border pt-6">
          <p className="mb-3 text-sm text-muted-foreground">
            Or try one of these pages:
          </p>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {[
              { href: '/', label: 'Dashboard' },
              { href: '/projects', label: 'Browse Projects' },
              { href: '/login', label: 'Sign In' },
              { href: '/register', label: 'Create Account' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
