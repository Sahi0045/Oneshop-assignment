import { PrismaClient, UserRole, SkillLevel, ProjectType, ProjectStatus, ProjectVisibility, BidStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

// ─── Constants ────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;
const DEFAULT_PASSWORD = 'Sahi@0045';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function log(label: string, data: Record<string, unknown> | string): void {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] ✅  ${label}`);
  if (typeof data === 'string') {
    console.log(`   ${data}`);
  } else {
    Object.entries(data).forEach(([k, v]) => {
      console.log(`   ${k.padEnd(20)} ${String(v)}`);
    });
  }
}

function section(title: string): void {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

// =============================================================================
// SEED DATA DEFINITIONS
// =============================================================================

// ─── Categories ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  {
    name: 'Web Development',
    slug: 'web-development',
    icon: '🌐',
  },
  {
    name: 'Mobile Development',
    slug: 'mobile-development',
    icon: '📱',
  },
  {
    name: 'Design',
    slug: 'design',
    icon: '🎨',
  },
] as const;

// ─── Skills ───────────────────────────────────────────────────────────────────

const SKILLS = [
  { name: 'React',       category: 'Web Development'    },
  { name: 'Node.js',     category: 'Web Development'    },
  { name: 'TypeScript',  category: 'Web Development'    },
  { name: 'Python',      category: 'Web Development'    },
  { name: 'Flutter',     category: 'Mobile Development' },
  { name: 'React Native',category: 'Mobile Development' },
  { name: 'Figma',       category: 'Design'             },
  { name: 'PostgreSQL',  category: 'Web Development'    },
  { name: 'AWS',         category: 'Web Development'    },
  { name: 'Docker',      category: 'Web Development'    },
] as const;

// ─── Users ────────────────────────────────────────────────────────────────────

interface SeedUser {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  bio?: string;
  country?: string;
  city?: string;
  timezone?: string;
  hourlyRate?: number;
  currency?: string;
  isVerified?: boolean;
}

const ADMIN_USER: SeedUser = {
  email: 'admin@freelancer.dev',
  firstName: 'System',
  lastName: 'Admin',
  role: UserRole.ADMIN,
  country: 'United States',
  city: 'San Francisco',
  timezone: 'America/Los_Angeles',
  isVerified: true,
};

const TEST_USER: SeedUser = {
  email: 'sahi0046@yahoo.com',
  firstName: 'Sahi',
  lastName: 'Test',
  role: UserRole.CLIENT,
  bio: 'Test user account for platform testing and validation.',
  country: 'United States',
  city: 'New York',
  timezone: 'America/New_York',
  currency: 'USD',
  isVerified: true,
};

const CLIENT_USERS: SeedUser[] = [
  {
    email: 'alice.client@example.com',
    firstName: 'Alice',
    lastName: 'Thompson',
    role: UserRole.CLIENT,
    bio: 'Serial entrepreneur building SaaS products. I love working with talented freelancers who bring fresh ideas and technical excellence to every project.',
    country: 'United States',
    city: 'New York',
    timezone: 'America/New_York',
    currency: 'USD',
    isVerified: true,
  },
  {
    email: 'bob.client@example.com',
    firstName: 'Bob',
    lastName: 'Martinez',
    role: UserRole.CLIENT,
    bio: 'Product manager at a fast-growing fintech startup. Looking for skilled developers and designers to bring our vision to life.',
    country: 'United Kingdom',
    city: 'London',
    timezone: 'Europe/London',
    currency: 'GBP',
    isVerified: true,
  },
  {
    email: 'carol.client@example.com',
    firstName: 'Carol',
    lastName: 'Nguyen',
    role: UserRole.CLIENT,
    bio: 'Founder of a digital agency. I post projects on behalf of our clients and maintain long-term relationships with high-quality freelancers.',
    country: 'Canada',
    city: 'Toronto',
    timezone: 'America/Toronto',
    currency: 'CAD',
    isVerified: false,
  },
];

const FREELANCER_USERS: SeedUser[] = [
  {
    email: 'dev.sarah@example.com',
    firstName: 'Sarah',
    lastName: 'Okonkwo',
    role: UserRole.FREELANCER,
    bio: 'Full-stack engineer with 7 years of experience building scalable web applications. Specialised in React, Node.js, and TypeScript. I deliver clean, well-tested code on time, every time.',
    country: 'Nigeria',
    city: 'Lagos',
    timezone: 'Africa/Lagos',
    hourlyRate: 65,
    currency: 'USD',
    isVerified: true,
  },
  {
    email: 'dev.raj@example.com',
    firstName: 'Raj',
    lastName: 'Patel',
    role: UserRole.FREELANCER,
    bio: 'Mobile developer specialising in Flutter and React Native. Built and shipped 20+ apps on the App Store and Google Play. Fast, reliable, and detail-oriented.',
    country: 'India',
    city: 'Bangalore',
    timezone: 'Asia/Kolkata',
    hourlyRate: 45,
    currency: 'USD',
    isVerified: true,
  },
  {
    email: 'dev.lena@example.com',
    firstName: 'Lena',
    lastName: 'Kovacs',
    role: UserRole.FREELANCER,
    bio: 'Senior UI/UX designer with a passion for crafting beautiful and intuitive digital experiences. Proficient in Figma, Sketch, and Adobe XD. I turn complex problems into elegant solutions.',
    country: 'Germany',
    city: 'Berlin',
    timezone: 'Europe/Berlin',
    hourlyRate: 80,
    currency: 'EUR',
    isVerified: true,
  },
  {
    email: 'dev.james@example.com',
    firstName: 'James',
    lastName: 'O\'Brien',
    role: UserRole.FREELANCER,
    bio: 'Python and AWS specialist with a background in data engineering. I help teams architect robust backend systems and cloud infrastructure that scales without breaking the bank.',
    country: 'Ireland',
    city: 'Dublin',
    timezone: 'Europe/Dublin',
    hourlyRate: 75,
    currency: 'EUR',
    isVerified: false,
  },
  {
    email: 'dev.mei@example.com',
    firstName: 'Mei',
    lastName: 'Zhang',
    role: UserRole.FREELANCER,
    bio: 'Full-stack TypeScript developer with deep expertise in Next.js, PostgreSQL, and Docker. I value clean architecture, thorough documentation, and open communication throughout every project.',
    country: 'Singapore',
    city: 'Singapore',
    timezone: 'Asia/Singapore',
    hourlyRate: 70,
    currency: 'SGD',
    isVerified: true,
  },
];

// ─── Projects ─────────────────────────────────────────────────────────────────

const PROJECT_DESCRIPTIONS = {
  webApp: `
We are looking for an experienced full-stack developer to build a modern B2B SaaS project management tool from the ground up.

**What we need:**
- A responsive React (Next.js) frontend with a clean, professional UI
- A robust Node.js/TypeScript backend with REST and WebSocket support
- PostgreSQL database with Prisma ORM
- Authentication (email/password + Google OAuth) using JWT
- Real-time collaboration features (live cursor, comments, activity feed)
- Stripe integration for subscription billing (Free / Pro / Enterprise tiers)
- AWS deployment (EC2, RDS, S3, CloudFront) with CI/CD via GitHub Actions
- Comprehensive unit and integration test coverage (>80%)

**Tech stack required:** Next.js 14, TypeScript, Node.js, PostgreSQL, Prisma, Socket.io, Stripe, AWS

**Deliverables:**
1. Full source code with detailed README
2. Database schema with migration scripts
3. API documentation (Swagger/OpenAPI)
4. Deployment scripts and Docker Compose configuration
5. Basic admin dashboard for user and subscription management

This is a long-term project with potential for ongoing maintenance work. We value code quality, clear communication, and meeting deadlines.
  `.trim(),

  mobileApp: `
We need a skilled mobile developer to build cross-platform iOS and Android applications for our existing food delivery startup.

**Project overview:**
Our web platform is already live and serving customers in 3 cities. We now need native-feeling mobile apps that give our users a seamless ordering experience on the go.

**Features required:**
- User registration, login, and profile management
- Real-time order tracking with live map integration (Google Maps SDK)
- Push notifications for order status updates (Firebase Cloud Messaging)
- In-app payment via Stripe (credit/debit card, Apple Pay, Google Pay)
- Restaurant discovery with search, filters, and ratings
- Favourites, order history, and re-order functionality
- Dark mode support
- Offline-first architecture with data sync

**Tech stack required:** Flutter (preferred) or React Native, REST API integration (docs will be provided), Firebase, Google Maps SDK, Stripe SDK

**Deliverables:**
1. Complete Flutter/React Native codebase
2. Both iOS (.ipa) and Android (.apk) builds ready for store submission
3. Integration guide and code documentation
4. Basic CI pipeline (GitHub Actions or Bitrise)

The deadline is firm — we are targeting a launch event. Please only apply if you can commit to the timeline and have shipped mobile apps before.
  `.trim(),
};

// =============================================================================
// SEED FUNCTIONS
// =============================================================================

async function seedCategories() {
  section('Seeding Categories');

  const created = await Promise.all(
    CATEGORIES.map((cat) =>
      prisma.category.upsert({
        where: { slug: cat.slug },
        update: {},
        create: {
          name: cat.name,
          slug: cat.slug,
          icon: cat.icon,
        },
      }),
    ),
  );

  created.forEach((c) => log('Category', { id: c.id, name: c.name, slug: c.slug }));
  return created;
}

async function seedSkills() {
  section('Seeding Skills');

  const created = await Promise.all(
    SKILLS.map((s) =>
      prisma.skill.upsert({
        where: { name: s.name },
        update: {},
        create: {
          name: s.name,
          category: s.category,
        },
      }),
    ),
  );

  created.forEach((s) => log('Skill', { id: s.id, name: s.name, category: s.category }));
  return created;
}

async function seedUsers(passwordHash: string) {
  section('Seeding Users');

  // Admin
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_USER.email },
    update: {},
    create: {
      email: ADMIN_USER.email,
      passwordHash,
      firstName: ADMIN_USER.firstName,
      lastName: ADMIN_USER.lastName,
      role: ADMIN_USER.role,
      country: ADMIN_USER.country,
      city: ADMIN_USER.city,
      timezone: ADMIN_USER.timezone,
      isVerified: ADMIN_USER.isVerified ?? false,
      profileCompleteness: 100,
    },
  });

  log('Admin User', {
    id:    admin.id,
    email: admin.email,
    role:  admin.role,
  });

  // Test User
  const testUser = await prisma.user.upsert({
    where: { email: TEST_USER.email },
    update: {},
    create: {
      email: TEST_USER.email,
      passwordHash,
      firstName: TEST_USER.firstName,
      lastName: TEST_USER.lastName,
      role: TEST_USER.role,
      bio: TEST_USER.bio,
      country: TEST_USER.country,
      city: TEST_USER.city,
      timezone: TEST_USER.timezone,
      currency: TEST_USER.currency ?? 'USD',
      isVerified: TEST_USER.isVerified ?? false,
      profileCompleteness: 100,
    },
  });

  log('Test User', {
    id:    testUser.id,
    email: testUser.email,
    role:  testUser.role,
  });

  // Clients
  const clients = await Promise.all(
    CLIENT_USERS.map((u) =>
      prisma.user.upsert({
        where: { email: u.email },
        update: {},
        create: {
          email: u.email,
          passwordHash,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role,
          bio: u.bio,
          country: u.country,
          city: u.city,
          timezone: u.timezone,
          currency: u.currency ?? 'USD',
          isVerified: u.isVerified ?? false,
          profileCompleteness: u.bio ? 80 : 50,
        },
      }),
    ),
  );

  clients.forEach((c) =>
    log('Client User', {
      id:         c.id,
      email:      c.email,
      name:       `${c.firstName} ${c.lastName}`,
      country:    c.country ?? '—',
      isVerified: String(c.isVerified),
    }),
  );

  // Freelancers
  const freelancers = await Promise.all(
    FREELANCER_USERS.map((u) =>
      prisma.user.upsert({
        where: { email: u.email },
        update: {},
        create: {
          email: u.email,
          passwordHash,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role,
          bio: u.bio,
          country: u.country,
          city: u.city,
          timezone: u.timezone,
          hourlyRate: u.hourlyRate,
          currency: u.currency ?? 'USD',
          isVerified: u.isVerified ?? false,
          profileCompleteness: 85,
        },
      }),
    ),
  );

  freelancers.forEach((f) =>
    log('Freelancer User', {
      id:          f.id,
      email:       f.email,
      name:        `${f.firstName} ${f.lastName}`,
      hourlyRate:  f.hourlyRate ? `${f.currency} ${f.hourlyRate}` : '—',
      isVerified:  String(f.isVerified),
    }),
  );

  return { admin, testUser, clients, freelancers };
}

async function attachSkillsToFreelancers(
  freelancers: Awaited<ReturnType<typeof seedUsers>>['freelancers'],
  skills: Awaited<ReturnType<typeof seedSkills>>,
) {
  section('Attaching Skills to Freelancers');

  // Map skill names to records for easy lookup
  const skillMap = new Map(skills.map((s) => [s.name, s]));

  const assignments: Array<{ freelancer: string; skill: string; level: SkillLevel }> = [
    // Sarah — full-stack web
    { freelancer: freelancers[0].email, skill: 'React',       level: SkillLevel.EXPERT       },
    { freelancer: freelancers[0].email, skill: 'Node.js',     level: SkillLevel.EXPERT       },
    { freelancer: freelancers[0].email, skill: 'TypeScript',  level: SkillLevel.EXPERT       },
    { freelancer: freelancers[0].email, skill: 'PostgreSQL',  level: SkillLevel.INTERMEDIATE },
    // Raj — mobile
    { freelancer: freelancers[1].email, skill: 'Flutter',     level: SkillLevel.EXPERT       },
    { freelancer: freelancers[1].email, skill: 'React Native',level: SkillLevel.EXPERT       },
    { freelancer: freelancers[1].email, skill: 'TypeScript',  level: SkillLevel.INTERMEDIATE },
    // Lena — design
    { freelancer: freelancers[2].email, skill: 'Figma',       level: SkillLevel.EXPERT       },
    { freelancer: freelancers[2].email, skill: 'React',       level: SkillLevel.BEGINNER     },
    // James — backend / cloud
    { freelancer: freelancers[3].email, skill: 'Python',      level: SkillLevel.EXPERT       },
    { freelancer: freelancers[3].email, skill: 'AWS',         level: SkillLevel.EXPERT       },
    { freelancer: freelancers[3].email, skill: 'Docker',      level: SkillLevel.INTERMEDIATE },
    { freelancer: freelancers[3].email, skill: 'PostgreSQL',  level: SkillLevel.INTERMEDIATE },
    // Mei — full-stack TypeScript
    { freelancer: freelancers[4].email, skill: 'TypeScript',  level: SkillLevel.EXPERT       },
    { freelancer: freelancers[4].email, skill: 'React',       level: SkillLevel.EXPERT       },
    { freelancer: freelancers[4].email, skill: 'Node.js',     level: SkillLevel.EXPERT       },
    { freelancer: freelancers[4].email, skill: 'PostgreSQL',  level: SkillLevel.EXPERT       },
    { freelancer: freelancers[4].email, skill: 'Docker',      level: SkillLevel.EXPERT       },
  ];

  const freelancerMap = new Map(freelancers.map((f) => [f.email, f]));

  for (const a of assignments) {
    const user  = freelancerMap.get(a.freelancer);
    const skill = skillMap.get(a.skill);
    if (!user || !skill) continue;

    await prisma.userSkill.upsert({
      where: { userId_skillId: { userId: user.id, skillId: skill.id } },
      update: { level: a.level },
      create: { userId: user.id, skillId: skill.id, level: a.level },
    });

    log('UserSkill', {
      freelancer: `${user.firstName} ${user.lastName}`,
      skill:      a.skill,
      level:      a.level,
    });
  }
}

async function seedProjects(
  clients: Awaited<ReturnType<typeof seedUsers>>['clients'],
  categories: Awaited<ReturnType<typeof seedCategories>>,
) {
  section('Seeding Projects');

  const webDevCategory    = categories.find((c) => c.slug === 'web-development')!;
  const mobileDevCategory = categories.find((c) => c.slug === 'mobile-development')!;

  const project1 = await prisma.project.create({
    data: {
      clientId:    clients[0].id,
      categoryId:  webDevCategory.id,
      title:       'Build a Full-Stack B2B SaaS Project Management Platform',
      description: PROJECT_DESCRIPTIONS.webApp,
      type:        ProjectType.FIXED_PRICE,
      budgetMin:   8000,
      budgetMax:   15000,
      currency:    'USD',
      deadline:    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
      skills:      ['Next.js', 'TypeScript', 'Node.js', 'PostgreSQL', 'Prisma', 'Stripe', 'AWS'],
      status:      ProjectStatus.OPEN,
      visibility:  ProjectVisibility.PUBLIC,
      attachments: [],
      viewCount:   42,
      bidCount:    0, // will be updated after bids are created
    },
  });

  log('Project', {
    id:        project1.id,
    title:     project1.title.substring(0, 55) + '…',
    client:    clients[0].email,
    budgetMin: `$${project1.budgetMin}`,
    budgetMax: `$${project1.budgetMax}`,
    status:    project1.status,
  });

  const project2 = await prisma.project.create({
    data: {
      clientId:    clients[1].id,
      categoryId:  mobileDevCategory.id,
      title:       'Cross-Platform Mobile App (iOS & Android) for Food Delivery Startup',
      description: PROJECT_DESCRIPTIONS.mobileApp,
      type:        ProjectType.FIXED_PRICE,
      budgetMin:   5000,
      budgetMax:   10000,
      currency:    'USD',
      deadline:    new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
      skills:      ['Flutter', 'React Native', 'Firebase', 'Google Maps', 'Stripe'],
      status:      ProjectStatus.OPEN,
      visibility:  ProjectVisibility.PUBLIC,
      attachments: [],
      viewCount:   28,
      bidCount:    0,
    },
  });

  log('Project', {
    id:        project2.id,
    title:     project2.title.substring(0, 55) + '…',
    client:    clients[1].email,
    budgetMin: `$${project2.budgetMin}`,
    budgetMax: `$${project2.budgetMax}`,
    status:    project2.status,
  });

  return [project1, project2] as const;
}

async function seedBids(
  projects: Awaited<ReturnType<typeof seedProjects>>,
  freelancers: Awaited<ReturnType<typeof seedUsers>>['freelancers'],
) {
  section('Seeding Bids');

  const [project1, project2] = projects;

  // ─── Bids on Project 1 (SaaS platform) ──────────────────────────────────────

  const bidsOnProject1: Array<{
    freelancerIndex: number;
    amount: number;
    deliveryDays: number;
    coverLetter: string;
  }> = [
    {
      freelancerIndex: 0, // Sarah — React + Node.js expert
      amount: 12500,
      deliveryDays: 75,
      coverLetter: `Hi Alice,

I came across your listing and I'm very excited about this project — it maps almost exactly to the stack I've been working with for the past 4 years.

I have built 3 B2B SaaS platforms from scratch using Next.js 14, TypeScript, and Node.js with Prisma on PostgreSQL. Most recently I delivered a project management tool for a 50-person engineering team, including real-time features via Socket.io and Stripe subscription billing.

My proposed approach:
1. Week 1–2: Architecture design, database schema, auth system (email + Google OAuth, JWT)
2. Week 3–5: Core backend APIs — projects, tasks, users, billing
3. Week 6–8: Frontend implementation with live collaboration features
4. Week 9–10: Stripe integration, AWS deployment, CI/CD pipeline
5. Week 11: Testing, documentation, and handover

I use GitHub for version control with feature branches, write comprehensive tests (Jest + Supertest for API, Playwright for E2E), and provide clear, daily updates.

My rate of $12,500 fixed includes all deliverables listed in your spec. I am available to start immediately and can dedicate 40 hours/week to this project.

Happy to schedule a call to discuss the requirements in more detail.

Best,
Sarah`,
    },
    {
      freelancerIndex: 4, // Mei — TypeScript specialist
      amount: 11800,
      deliveryDays: 80,
      coverLetter: `Hello Alice,

Your SaaS project management tool is exactly the kind of project I thrive on. I have 5 years of full-stack TypeScript experience and have shipped multiple Next.js + PostgreSQL applications in production.

What sets me apart:
• I follow clean architecture principles — your codebase will be maintainable by your own team long after delivery
• Deep experience with Prisma (including complex migrations) and PostgreSQL query optimisation
• I've integrated Stripe Connect, Stripe Billing, and webhooks in 4 previous projects
• I containerise everything with Docker and have set up AWS infrastructure (ECS, RDS, S3, CloudFront) from scratch

Timeline: I can complete this in 80 days with milestones every two weeks so you always know where we stand.

My bid of $11,800 covers everything in your spec plus 30 days of post-delivery bug fixes.

I'd love to share my portfolio and references. Looking forward to hearing from you!

Mei`,
    },
    {
      freelancerIndex: 3, // James — Python/AWS
      amount: 13200,
      deliveryDays: 85,
      coverLetter: `Hi Alice,

I'm a backend and cloud infrastructure specialist with 6 years of experience. While you've specified Node.js, I have strong TypeScript skills and have worked extensively with Next.js frontends paired with Python/FastAPI backends — a combination that I believe is actually better suited to your scalability needs.

That said, if you're committed to a pure Node.js stack I am fully comfortable delivering that too.

My AWS expertise is a key differentiator: I'll design an architecture that scales horizontally from day one, with auto-scaling groups, RDS Multi-AZ, and CloudFront CDN baked in from the start rather than bolted on later.

I price at $13,200 to account for the infrastructure design and setup work which typically takes a full sprint on its own.

Let's chat — I'd like to understand your expected user volume and growth projections before finalising the technical approach.

James`,
    },
  ];

  const createdBidsProject1 = [];
  for (const b of bidsOnProject1) {
    const bid = await prisma.bid.create({
      data: {
        projectId:    project1.id,
        freelancerId: freelancers[b.freelancerIndex].id,
        amount:       b.amount,
        currency:     'USD',
        deliveryDays: b.deliveryDays,
        coverLetter:  b.coverLetter.trim(),
        attachments:  [],
        status:       BidStatus.PENDING,
        isRead:       false,
      },
    });
    createdBidsProject1.push(bid);

    log('Bid (Project 1)', {
      id:           bid.id,
      freelancer:   `${freelancers[b.freelancerIndex].firstName} ${freelancers[b.freelancerIndex].lastName}`,
      amount:       `$${bid.amount}`,
      deliveryDays: `${bid.deliveryDays} days`,
      status:       bid.status,
    });
  }

  // ─── Bids on Project 2 (mobile app) ─────────────────────────────────────────

  const bidsOnProject2: Array<{
    freelancerIndex: number;
    amount: number;
    deliveryDays: number;
    coverLetter: string;
  }> = [
    {
      freelancerIndex: 1, // Raj — Flutter expert
      amount: 8500,
      deliveryDays: 55,
      coverLetter: `Hello Bob,

I'm a dedicated mobile developer with 5 years of Flutter experience and 20+ apps shipped on both the App Store and Google Play. Your food delivery app is a great fit for my skill set.

Flutter is the ideal choice here — you get a single codebase that looks and feels native on both iOS and Android, with excellent performance and a rich widget library that makes building your delivery tracking UI a pleasure.

My plan:
• Sprint 1 (Days 1–15): Auth, user profile, restaurant listing with search and filters
• Sprint 2 (Days 16–30): Order flow, cart, Stripe payment integration (card, Apple Pay, Google Pay)
• Sprint 3 (Days 31–45): Real-time order tracking with Google Maps, FCM push notifications
• Sprint 4 (Days 46–55): Favourites, order history, dark mode, bug fixes, store submission

I'll provide daily standups via Slack and a shared TestFlight/Google Play internal track from week 2 so you can test continuously.

$8,500 fixed. I can start Monday.

Raj`,
    },
    {
      freelancerIndex: 0, // Sarah — React Native
      amount: 9200,
      deliveryDays: 60,
      coverLetter: `Hi Bob,

While my primary background is full-stack web development, I have built and shipped 4 React Native apps over the past two years and I'm confident this is a strong match.

The advantage of choosing React Native for your project: if you ever decide to add a web version, the shared component logic will significantly reduce development time.

My technical approach:
- Expo managed workflow for faster iteration and OTA updates without going through the store review process each time
- React Query for server state management and offline caching
- React Navigation v6 for a smooth navigation experience
- Socket.io for real-time order tracking
- Firebase for push notifications, with a graceful fallback

I charge a slight premium at $9,200 because I include 60 days of post-launch support — a must for a consumer app launch where user feedback comes fast.

Let's set up a call and discuss your existing API docs!

Sarah`,
    },
    {
      freelancerIndex: 2, // Lena — designer (offering design + front-end)
      amount: 7800,
      deliveryDays: 65,
      coverLetter: `Hi Bob,

I'm primarily a UI/UX designer but I also develop in Flutter, which means I can offer something unique: a fully designed AND developed app where the implementation pixel-perfectly matches the designs — because both are done by the same person.

I'll start with a design sprint (Figma prototypes, user flows, design system) before writing a single line of code. This means we align on every screen before development begins, reducing expensive mid-project changes.

What's included in my $7,800 proposal:
✓ Complete Figma design file with all screens, components, and responsive layouts
✓ Design system (typography, colour, spacing, icons)
✓ Flutter implementation (iOS + Android)
✓ Light and dark mode from day one
✓ All integrations: Google Maps, Stripe, FCM
✓ Store listing assets (screenshots, feature graphic)

My delivery estimate is 65 days. I can share recent app portfolio work on request.

Lena`,
    },
  ];

  const createdBidsProject2 = [];
  for (const b of bidsOnProject2) {
    const bid = await prisma.bid.create({
      data: {
        projectId:    project2.id,
        freelancerId: freelancers[b.freelancerIndex].id,
        amount:       b.amount,
        currency:     'USD',
        deliveryDays: b.deliveryDays,
        coverLetter:  b.coverLetter.trim(),
        attachments:  [],
        status:       BidStatus.PENDING,
        isRead:       false,
      },
    });
    createdBidsProject2.push(bid);

    log('Bid (Project 2)', {
      id:           bid.id,
      freelancer:   `${freelancers[b.freelancerIndex].firstName} ${freelancers[b.freelancerIndex].lastName}`,
      amount:       `$${bid.amount}`,
      deliveryDays: `${bid.deliveryDays} days`,
      status:       bid.status,
    });
  }

  // Update bidCount on both projects to reflect actual bids
  await prisma.project.update({
    where: { id: project1.id },
    data:  { bidCount: createdBidsProject1.length },
  });
  await prisma.project.update({
    where: { id: project2.id },
    data:  { bidCount: createdBidsProject2.length },
  });

  log('Bid counts updated', {
    [project1.id.substring(0, 8) + '…']: `${createdBidsProject1.length} bids`,
    [project2.id.substring(0, 8) + '…']: `${createdBidsProject2.length} bids`,
  });

  return {
    bidsProject1: createdBidsProject1,
    bidsProject2: createdBidsProject2,
  };
}

// =============================================================================
// SUMMARY
// =============================================================================

function printSummary(stats: {
  categories: number;
  skills: number;
  users: { admin: number; clients: number; freelancers: number };
  projects: number;
  bids: number;
  userSkills: number;
}) {
  console.log('\n' + '═'.repeat(60));
  console.log('  SEED COMPLETE — Summary');
  console.log('═'.repeat(60));
  console.log(`  Categories      ${String(stats.categories).padStart(4)}`);
  console.log(`  Skills          ${String(stats.skills).padStart(4)}`);
  console.log(`  Admin users     ${String(stats.users.admin).padStart(4)}`);
  console.log(`  Client users    ${String(stats.users.clients).padStart(4)}`);
  console.log(`  Freelancer users${String(stats.users.freelancers).padStart(4)}`);
  console.log(`  User skills     ${String(stats.userSkills).padStart(4)}`);
  console.log(`  Projects        ${String(stats.projects).padStart(4)}`);
  console.log(`  Bids            ${String(stats.bids).padStart(4)}`);
  console.log('─'.repeat(60));
  console.log(`  Default password: ${DEFAULT_PASSWORD}`);
  console.log('═'.repeat(60) + '\n');
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  Freelancer Platform — Database Seed');
  console.log('  Environment: ' + (process.env.NODE_ENV ?? 'development'));
  console.log('═'.repeat(60));

  // Hash the shared seed password once
  console.log('\nHashing seed password…');
  const passwordHash = await hashPassword(DEFAULT_PASSWORD);
  console.log('Password hashed successfully.');

  // Run all seed operations
  const categories = await seedCategories();
  const skills = await seedSkills();
  const { admin, testUser, clients, freelancers } = await seedUsers(passwordHash);
  await attachSkillsToFreelancers(freelancers, skills);
  const projects = await seedProjects(clients, categories);
  const { bidsProject1, bidsProject2 } = await seedBids(projects, freelancers);

  // Count user skills created
  const userSkillCount = await prisma.userSkill.count();

  printSummary({
    categories:  categories.length,
    skills:      skills.length,
    users: {
      admin:       1,
      clients:     clients.length,
      freelancers: freelancers.length,
    },
    projects:   projects.length,
    bids:       bidsProject1.length + bidsProject2.length,
    userSkills: userSkillCount,
  });
}

main()
  .catch((err) => {
    console.error('\n❌ Seed failed:\n', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

