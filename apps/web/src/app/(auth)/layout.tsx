import Link from 'next/link';
import { Zap, Shield, CheckCircle, Star, Users } from 'lucide-react';

const trustPoints = [
  { icon: Shield, text: 'Secure escrow payments' },
  { icon: CheckCircle, text: 'Verified freelancer profiles' },
  { icon: Star, text: '4.9/5 average satisfaction rating' },
  { icon: Users, text: '50,000+ active professionals' },
];

const testimonial = {
  quote:
    'FreelancerHub transformed how we find and work with remote talent. The escrow system and real-time collaboration tools are genuinely best-in-class.',
  name: 'Alex Rivera',
  role: 'Engineering Lead, TechCorp',
  initials: 'AR',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Left decorative panel (hidden on mobile) ───────────────────────── */}
      <aside className="relative hidden lg:flex lg:w-[480px] xl:w-[520px] flex-col overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-purple-700 text-white shrink-0">
        {/* Background decoration */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* Top-right blob */}
          <div className="absolute -top-32 -right-32 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          {/* Bottom-left blob */}
          <div className="absolute -bottom-32 -left-32 h-64 w-64 rounded-full bg-purple-500/30 blur-3xl" />
          {/* Center blob */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-10 xl:p-12">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group w-fit">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm border border-white/20 group-hover:bg-white/30 transition-colors">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              FreelancerHub
            </span>
          </Link>

          {/* Main copy */}
          <div className="mt-16 flex-1">
            <h1 className="text-3xl xl:text-4xl font-extrabold leading-tight tracking-tight text-white">
              The smarter way to{' '}
              <span className="relative">
                <span className="relative z-10">hire & work</span>
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-0 right-0 h-2 rounded-full bg-white/20"
                />
              </span>{' '}
              remotely.
            </h1>
            <p className="mt-5 text-base xl:text-lg text-white/75 leading-relaxed max-w-sm">
              Connect with world-class freelancers or find your next great
              project. Backed by secure escrow, real-time chat, and milestone
              payments.
            </p>

            {/* Trust points */}
            <ul className="mt-10 space-y-4" aria-label="Platform features">
              {trustPoints.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-sm font-medium text-white/90">{text}</span>
                </li>
              ))}
            </ul>

            {/* Stat pills */}
            <div className="mt-10 flex flex-wrap gap-3">
              {[
                { value: '50K+', label: 'Freelancers' },
                { value: '$5M+', label: 'Paid Out' },
                { value: '10K+', label: 'Projects' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col items-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 px-5 py-3 text-center"
                >
                  <span className="text-xl font-extrabold text-white">{stat.value}</span>
                  <span className="text-xs text-white/70 font-medium mt-0.5">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Testimonial */}
          <div className="mt-auto">
            <blockquote className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 p-6">
              <div className="flex gap-1 mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
                ))}
              </div>
              <p className="text-sm text-white/85 leading-relaxed italic">
                &ldquo;{testimonial.quote}&rdquo;
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white text-sm font-bold shrink-0">
                  {testimonial.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{testimonial.name}</p>
                  <p className="text-xs text-white/60">{testimonial.role}</p>
                </div>
              </div>
            </blockquote>
          </div>
        </div>
      </aside>

      {/* ── Right: form area ───────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col">
        {/* Mobile header (only shown on sm/md) */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border lg:hidden">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Zap className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Freelancer<span className="text-primary">Hub</span>
            </span>
          </Link>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to home
          </Link>
        </header>

        {/* Centered form container */}
        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:px-10 xl:px-16">
          <div className="w-full max-w-md">
            {/* Desktop back link */}
            <div className="mb-6 hidden lg:block">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group"
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5"
                  aria-hidden="true"
                >
                  <path
                    d="M10 12L6 8l4-4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Back to home
              </Link>
            </div>

            {/* Form card */}
            <div className="rounded-2xl border border-border bg-card shadow-medium p-7 sm:p-8">
              {children}
            </div>

            {/* Footer note */}
            <p className="mt-6 text-center text-xs text-muted-foreground leading-relaxed">
              By continuing, you agree to our{' '}
              <Link
                href="/terms"
                className="underline underline-offset-4 hover:text-foreground transition-colors"
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                href="/privacy"
                className="underline underline-offset-4 hover:text-foreground transition-colors"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
