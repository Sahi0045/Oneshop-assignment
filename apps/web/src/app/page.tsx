import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  Shield,
  MessageSquare,
  CheckCircle,
  UserCheck,
  Scale,
  Globe,
  ArrowRight,
  Star,
  Users,
  Briefcase,
  DollarSign,
  Code2,
  Palette,
  BarChart3,
  PenTool,
  Megaphone,
  Camera,
  Database,
  Smartphone,
  ChevronRight,
  Zap,
  Lock,
  Clock,
  Award,
} from 'lucide-react';
import { HowItWorksTabs } from './_components/how-it-works-tabs';

// ─── Static data ──────────────────────────────────────────────────────────────

const stats = [
  {
    value: '50K+',
    label: 'Skilled Freelancers',
    icon: Users,
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
  },
  {
    value: '10K+',
    label: 'Projects Posted',
    icon: Briefcase,
    color: 'text-purple-600',
    bg: 'bg-purple-50 dark:bg-purple-900/20',
  },
  {
    value: '$5M+',
    label: 'Paid to Freelancers',
    icon: DollarSign,
    color: 'text-green-600',
    bg: 'bg-green-50 dark:bg-green-900/20',
  },
  {
    value: '4.9/5',
    label: 'Average Rating',
    icon: Star,
    color: 'text-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
  },
];

const features = [
  {
    icon: Lock,
    title: 'Secure Escrow',
    description:
      'Funds are held safely in escrow and only released when you approve the deliverables. Zero risk, full control.',
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    icon: MessageSquare,
    title: 'Real-time Chat',
    description:
      'Stay in sync with built-in messaging, file sharing, and instant notifications powered by Socket.IO.',
    color: 'text-violet-600',
    bg: 'bg-violet-50 dark:bg-violet-900/20',
    gradient: 'from-violet-500 to-purple-500',
  },
  {
    icon: CheckCircle,
    title: 'Milestone Payments',
    description:
      'Break projects into manageable milestones. Pay incrementally as work is completed and approved.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    gradient: 'from-emerald-500 to-green-500',
  },
  {
    icon: UserCheck,
    title: 'Verified Profiles',
    description:
      'Every freelancer undergoes identity verification and skill assessments. Trust who you hire.',
    color: 'text-orange-600',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    gradient: 'from-orange-500 to-amber-500',
  },
  {
    icon: Scale,
    title: 'Dispute Resolution',
    description:
      'Our trained mediation team steps in when needed to ensure fair outcomes for both parties.',
    color: 'text-rose-600',
    bg: 'bg-rose-50 dark:bg-rose-900/20',
    gradient: 'from-rose-500 to-pink-500',
  },
  {
    icon: Globe,
    title: 'Global Reach',
    description:
      'Access talent or opportunities from 150+ countries. Multi-currency payments and timezone tools included.',
    color: 'text-teal-600',
    bg: 'bg-teal-50 dark:bg-teal-900/20',
    gradient: 'from-teal-500 to-cyan-500',
  },
];

const categories = [
  {
    icon: Code2,
    name: 'Web Development',
    count: '3,240 projects',
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    hover: 'hover:border-blue-200 dark:hover:border-blue-800',
  },
  {
    icon: Palette,
    name: 'Design & Creative',
    count: '2,180 projects',
    color: 'text-violet-600',
    bg: 'bg-violet-50 dark:bg-violet-900/20',
    hover: 'hover:border-violet-200 dark:hover:border-violet-800',
  },
  {
    icon: BarChart3,
    name: 'Data & Analytics',
    count: '1,560 projects',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    hover: 'hover:border-emerald-200 dark:hover:border-emerald-800',
  },
  {
    icon: PenTool,
    name: 'Writing & Content',
    count: '2,890 projects',
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    hover: 'hover:border-amber-200 dark:hover:border-amber-800',
  },
  {
    icon: Megaphone,
    name: 'Digital Marketing',
    count: '1,920 projects',
    color: 'text-rose-600',
    bg: 'bg-rose-50 dark:bg-rose-900/20',
    hover: 'hover:border-rose-200 dark:hover:border-rose-800',
  },
  {
    icon: Camera,
    name: 'Video & Photo',
    count: '980 projects',
    color: 'text-orange-600',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    hover: 'hover:border-orange-200 dark:hover:border-orange-800',
  },
  {
    icon: Database,
    name: 'AI & Machine Learning',
    count: '1,340 projects',
    color: 'text-cyan-600',
    bg: 'bg-cyan-50 dark:bg-cyan-900/20',
    hover: 'hover:border-cyan-200 dark:hover:border-cyan-800',
  },
  {
    icon: Smartphone,
    name: 'Mobile Development',
    count: '2,010 projects',
    color: 'text-indigo-600',
    bg: 'bg-indigo-50 dark:bg-indigo-900/20',
    hover: 'hover:border-indigo-200 dark:hover:border-indigo-800',
  },
];

const footerLinks = {
  Platform: [
    { label: 'Browse Projects', href: '/projects' },
    { label: 'Find Freelancers', href: '/freelancers' },
    { label: 'Post a Project', href: '/projects/new' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Pricing', href: '/pricing' },
  ],
  Company: [
    { label: 'About Us', href: '/about' },
    { label: 'Blog', href: '/blog' },
    { label: 'Careers', href: '/careers' },
    { label: 'Press Kit', href: '/press' },
    { label: 'Contact', href: '/contact' },
  ],
  Support: [
    { label: 'Help Center', href: '/help' },
    { label: 'Safety Center', href: '/safety' },
    { label: 'Community', href: '/community' },
    { label: 'Status Page', href: '/status' },
    { label: 'Report a Bug', href: '/report' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Cookie Policy', href: '/cookies' },
    { label: 'Accessibility', href: '/accessibility' },
    { label: 'GDPR', href: '/gdpr' },
  ],
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const cookieStore = cookies();
  const token = cookieStore.get('accessToken');

  if (token) {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ── Navigation ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm group-hover:shadow-primary-glow transition-shadow">
              <Zap className="h-4 w-4" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              Freelancer<span className="text-primary">Hub</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link
              href="#features"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              How It Works
            </Link>
            <Link
              href="#categories"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Categories
            </Link>
            <Link
              href="/pricing"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
          </nav>

          {/* Auth buttons */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden sm:inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-accent"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 active:bg-primary/95 transition-colors"
            >
              Get Started
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hero Section ──────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-background pb-20 pt-16 sm:pt-24 lg:pt-32">
          {/* Background decoration */}
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 overflow-hidden"
          >
            {/* Top-right gradient blob */}
            <div className="absolute -top-40 right-0 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-primary/20 via-purple-500/10 to-transparent blur-3xl" />
            {/* Bottom-left gradient blob */}
            <div className="absolute -bottom-40 left-0 h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-cyan-500/10 via-blue-500/10 to-transparent blur-3xl" />
            {/* Grid pattern */}
            <div
              className="absolute inset-0 opacity-[0.02]"
              style={{
                backgroundImage:
                  'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
                backgroundSize: '64px 64px',
              }}
            />
          </div>

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl text-center">
              {/* Badge */}
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-4 py-1.5 text-sm shadow-sm backdrop-blur">
                <span className="flex h-2 w-2 rounded-full bg-green-500" />
                <span className="text-muted-foreground">
                  Trusted by{' '}
                  <span className="font-semibold text-foreground">50,000+</span>{' '}
                  professionals worldwide
                </span>
              </div>

              {/* Headline */}
              <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
                Hire Top Freelancers.{' '}
                <span className="relative">
                  <span className="bg-gradient-to-r from-primary via-purple-500 to-cyan-500 bg-clip-text text-transparent">
                    Build Amazing
                  </span>
                  {/* Underline decoration */}
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-1 left-0 right-0 h-1 rounded-full bg-gradient-to-r from-primary via-purple-500 to-cyan-500 opacity-40"
                  />
                </span>{' '}
                Things.
              </h1>

              {/* Sub-headline */}
              <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl leading-relaxed">
                FreelancerHub connects visionary clients with world-class talent.
                Post projects, receive competitive bids, and collaborate
                seamlessly — all backed by secure escrow and real-time
                communication.
              </p>

              {/* CTA Buttons */}
              <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Link
                  href="/register?role=CLIENT"
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 hover:shadow-primary-glow active:scale-[0.98] transition-all sm:w-auto"
                >
                  <Briefcase className="h-5 w-5" />
                  Post a Project
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/register?role=FREELANCER"
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-8 py-4 text-base font-semibold text-foreground shadow-sm hover:bg-accent hover:border-primary/30 active:scale-[0.98] transition-all sm:w-auto"
                >
                  <Users className="h-5 w-5 text-primary" />
                  Find Work
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>

              {/* Social proof */}
              <p className="mt-6 text-xs text-muted-foreground">
                No subscription required · Free to post · Pay only when you hire
              </p>
            </div>

            {/* Hero illustration — dashboard mockup */}
            <div className="mx-auto mt-16 max-w-5xl">
              <div className="relative rounded-2xl border border-border bg-card shadow-hard overflow-hidden">
                {/* Fake browser chrome */}
                <div className="flex h-10 items-center gap-2 border-b border-border bg-muted/50 px-4">
                  <span className="h-3 w-3 rounded-full bg-red-400" />
                  <span className="h-3 w-3 rounded-full bg-yellow-400" />
                  <span className="h-3 w-3 rounded-full bg-green-400" />
                  <div className="ml-4 flex-1 rounded-md bg-background/80 px-3 py-1 text-xs text-muted-foreground max-w-xs">
                    freelancerhub.io/dashboard
                  </div>
                </div>

                {/* Dashboard preview */}
                <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-3">
                  {/* Stat cards */}
                  {[
                    { label: 'Active Projects', value: '12', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                    { label: 'Pending Bids', value: '8', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                    { label: 'Total Earned', value: '$24,580', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-xl border border-border bg-background p-4"
                    >
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className={`mt-1 text-2xl font-bold ${stat.color}`}>
                        {stat.value}
                      </p>
                      <div className={`mt-2 h-1.5 rounded-full ${stat.bg}`}>
                        <div
                          className={`h-full rounded-full bg-current ${stat.color} opacity-60`}
                          style={{ width: '65%' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Activity list */}
                <div className="border-t border-border px-6 pb-6">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-4">
                    Recent Activity
                  </p>
                  <div className="space-y-3">
                    {[
                      { title: 'React Dashboard — Milestone 2 approved', time: '2m ago', dot: 'bg-green-500' },
                      { title: 'New bid received on E-commerce Store', time: '18m ago', dot: 'bg-blue-500' },
                      { title: 'Payment of $1,200 released to escrow', time: '1h ago', dot: 'bg-purple-500' },
                    ].map((item) => (
                      <div
                        key={item.title}
                        className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5"
                      >
                        <span className={`h-2 w-2 rounded-full shrink-0 ${item.dot}`} />
                        <span className="flex-1 truncate text-sm text-foreground">
                          {item.title}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {item.time}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats Bar ─────────────────────────────────────────────────────── */}
        <section className="border-y border-border bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="flex flex-col items-center gap-3 text-center"
                  >
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.bg}`}
                    >
                      <Icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-3xl font-extrabold tracking-tight text-foreground">
                        {stat.value}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {stat.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Features ──────────────────────────────────────────────────────── */}
        <section id="features" className="py-24 bg-background">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {/* Section header */}
            <div className="mx-auto max-w-2xl text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Zap className="h-3 w-3" />
                Platform Features
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                Everything you need to succeed
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                We've built every feature with the needs of real freelancers and
                clients in mind — so you can focus on what matters most.
              </p>
            </div>

            {/* Feature grid */}
            <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="group relative rounded-2xl border border-border bg-card p-6 shadow-soft hover:shadow-medium hover:-translate-y-0.5 transition-all duration-200"
                  >
                    {/* Gradient accent line */}
                    <div
                      className={`absolute top-0 left-6 right-6 h-0.5 rounded-b-full bg-gradient-to-r ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity`}
                    />

                    <div
                      className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${feature.bg}`}
                    >
                      <Icon className={`h-6 w-6 ${feature.color}`} />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-foreground">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── How It Works ──────────────────────────────────────────────────── */}
        <section
          id="how-it-works"
          className="py-24 bg-muted/30 border-y border-border"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {/* Section header */}
            <div className="mx-auto max-w-2xl text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Clock className="h-3 w-3" />
                Simple Process
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                How FreelancerHub works
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Whether you're hiring or looking for work, our streamlined
                process gets you started in minutes.
              </p>
            </div>

            {/* Tabs — client component for interactivity */}
            <div className="mt-16">
              <HowItWorksTabs />
            </div>
          </div>
        </section>

        {/* ── Categories ────────────────────────────────────────────────────── */}
        <section id="categories" className="py-24 bg-background">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {/* Section header */}
            <div className="mx-auto max-w-2xl text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <BarChart3 className="h-3 w-3" />
                Explore
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                Popular categories
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Browse thousands of open projects across the most in-demand
                skill categories.
              </p>
            </div>

            {/* Categories grid */}
            <div className="mt-12 grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                  <Link
                    key={category.name}
                    href={`/projects?category=${encodeURIComponent(category.name)}`}
                    className={`group flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-5 shadow-soft transition-all duration-200 hover:shadow-medium hover:-translate-y-0.5 ${category.hover}`}
                  >
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-xl ${category.bg} transition-transform group-hover:scale-110 duration-200`}
                    >
                      <Icon className={`h-5 w-5 ${category.color}`} />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm leading-snug">
                        {category.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {category.count}
                      </p>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 ${category.color} opacity-0 group-hover:opacity-100 transition-opacity mt-auto self-end`}
                    />
                  </Link>
                );
              })}
            </div>

            <div className="mt-10 text-center">
              <Link
                href="/projects"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground shadow-sm hover:bg-accent hover:border-primary/30 transition-all"
              >
                Browse all categories
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Trust / Social Proof ──────────────────────────────────────────── */}
        <section className="py-16 border-y border-border bg-muted/20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <p className="text-center text-sm font-medium text-muted-foreground mb-10 uppercase tracking-wider">
              Trusted by teams at
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 opacity-50 grayscale">
              {['Stripe', 'Notion', 'Linear', 'Vercel', 'Figma', 'GitHub'].map(
                (company) => (
                  <span
                    key={company}
                    className="text-xl font-bold text-muted-foreground tracking-tight"
                  >
                    {company}
                  </span>
                ),
              )}
            </div>
          </div>
        </section>

        {/* ── Testimonials ──────────────────────────────────────────────────── */}
        <section className="py-24 bg-background">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Award className="h-3 w-3" />
                Testimonials
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                Loved by thousands
              </h2>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  quote:
                    'FreelancerHub completely changed how I hire developers. The escrow system gives me peace of mind, and the talent quality is outstanding.',
                  name: 'Sarah Chen',
                  role: 'CTO, Startup Founder',
                  rating: 5,
                  initials: 'SC',
                  color: 'bg-blue-500',
                },
                {
                  quote:
                    "I've been freelancing for 6 years and this is the best platform I've used. Steady flow of quality clients and payments always arrive on time.",
                  name: 'Marcus Johnson',
                  role: 'Senior Full-Stack Developer',
                  rating: 5,
                  initials: 'MJ',
                  color: 'bg-violet-500',
                },
                {
                  quote:
                    'The milestone-based payment system is a game changer. I can track progress, communicate instantly, and manage everything from one dashboard.',
                  name: 'Priya Patel',
                  role: 'Product Manager, Series B',
                  rating: 5,
                  initials: 'PP',
                  color: 'bg-emerald-500',
                },
              ].map((testimonial) => (
                <div
                  key={testimonial.name}
                  className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-soft"
                >
                  {/* Stars */}
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star
                        key={i}
                        className="h-4 w-4 fill-amber-400 text-amber-400"
                      />
                    ))}
                  </div>

                  {/* Quote */}
                  <blockquote className="flex-1 text-sm text-muted-foreground leading-relaxed">
                    &ldquo;{testimonial.quote}&rdquo;
                  </blockquote>

                  {/* Author */}
                  <div className="mt-6 flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${testimonial.color} text-white text-sm font-bold shrink-0`}
                    >
                      {testimonial.initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {testimonial.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {testimonial.role}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA Section ───────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden py-24">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-purple-700" />
          {/* Decorative shapes */}
          <div
            aria-hidden="true"
            className="absolute inset-0 overflow-hidden"
          >
            <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-purple-500/20 blur-3xl" />
            <div
              className="absolute inset-0 opacity-5"
              style={{
                backgroundImage:
                  'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />
          </div>

          <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Ready to get started?
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80 leading-relaxed">
              Join over 50,000 professionals who trust FreelancerHub to connect,
              collaborate, and build incredible things together.
            </p>

            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/register?role=CLIENT"
                className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-bold text-primary shadow-lg hover:bg-white/95 active:scale-[0.98] transition-all sm:w-auto"
              >
                <Briefcase className="h-5 w-5" />
                Hire a Freelancer
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/register?role=FREELANCER"
                className="group inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-white/40 bg-white/10 px-8 py-4 text-base font-bold text-white backdrop-blur hover:bg-white/20 hover:border-white/60 active:scale-[0.98] transition-all sm:w-auto"
              >
                <Users className="h-5 w-5" />
                Start Freelancing
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            {/* Trust signals */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-white/70">
              <span className="flex items-center gap-1.5">
                <Shield className="h-4 w-4" />
                Secure Escrow
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4" />
                Free to Sign Up
              </span>
              <span className="flex items-center gap-1.5">
                <UserCheck className="h-4 w-4" />
                Verified Professionals
              </span>
              <span className="flex items-center gap-1.5">
                <Star className="h-4 w-4" />
                4.9/5 Average Rating
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          {/* Top row */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
            {/* Brand */}
            <div className="col-span-2 sm:col-span-3 lg:col-span-1">
              <Link href="/" className="flex items-center gap-2 group w-fit">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                  <Zap className="h-4 w-4" />
                </div>
                <span className="text-lg font-bold">
                  Freelancer<span className="text-primary">Hub</span>
                </span>
              </Link>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-xs">
                The global freelance marketplace built for trust, transparency,
                and real-time collaboration.
              </p>
              {/* Social links */}
              <div className="mt-6 flex gap-3">
                {['Twitter', 'GitHub', 'LinkedIn'].map((social) => (
                  <a
                    key={social}
                    href="#"
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors text-xs font-semibold"
                    aria-label={social}
                  >
                    {social.charAt(0)}
                  </a>
                ))}
              </div>
            </div>

            {/* Links */}
            {Object.entries(footerLinks).map(([group, links]) => (
              <div key={group}>
                <p className="text-sm font-semibold text-foreground mb-4">
                  {group}
                </p>
                <ul className="space-y-2.5">
                  {links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} FreelancerHub, Inc. All rights
              reserved.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <Link href="/privacy" className="hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">
                Terms
              </Link>
              <Link href="/cookies" className="hover:text-foreground transition-colors">
                Cookies
              </Link>
              <span className="flex items-center gap-1">
                Made with{' '}
                <span className="text-rose-500" aria-label="love">
                  ♥
                </span>{' '}
                for builders
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
