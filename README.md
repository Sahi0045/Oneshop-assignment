# 🚀 Freelancer Platform

[![CI](https://github.com/your-org/freelancer-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/freelancer-platform/actions/workflows/ci.yml)
[![CD](https://github.com/your-org/freelancer-platform/actions/workflows/cd.yml/badge.svg)](https://github.com/your-org/freelancer-platform/actions/workflows/cd.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![pnpm Version](https://img.shields.io/badge/pnpm-%3E%3D9.0.0-orange)](https://pnpm.io/)
[![Turborepo](https://img.shields.io/badge/built%20with-Turborepo-blueviolet)](https://turbo.build/)

A production-ready, full-stack freelancer marketplace platform built as a Turborepo monorepo. Connects clients with skilled freelancers through a seamless web and mobile experience, powered by NestJS microservices, Next.js 14, and React Native Expo.

---

## 📐 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FREELANCER PLATFORM                                │
│                                                                             │
│   ┌─────────────────────┐          ┌─────────────────────────────────────┐  │
│   │      CLIENTS        │          │            APPS LAYER               │  │
│   │                     │          │                                     │  │
│   │  Browser / Mobile   │◄────────►│  ┌─────────────┐ ┌──────────────┐  │  │
│   │                     │   HTTPS  │  │  Next.js 14  │ │  React Native│  │  │
│   └─────────────────────┘          │  │  App Router  │ │    (Expo)    │  │  │
│                                    │  │  (apps/web)  │ │(apps/mobile) │  │  │
│                                    │  └──────┬───────┘ └──────┬───────┘  │  │
│                                    └─────────┼────────────────┼──────────┘  │
│                                              │                │             │
│                                    ┌─────────▼────────────────▼──────────┐  │
│                                    │           API GATEWAY               │  │
│                                    │     NestJS (packages/backend)       │  │
│                                    │         REST + GraphQL              │  │
│                                    └──┬──────┬──────┬──────┬─────────┬──┘  │
│                                       │      │      │      │         │     │
│                              ┌────────┘  ┌───┘  ┌───┘  ┌──┘    ┌────┘     │
│                              │           │      │      │        │          │
│   ┌──────────────────────────▼──────┐    │      │      │        │          │
│   │       MICROSERVICES             │    │      │      │        │          │
│   │                                 │    │      │      │        │          │
│   │  ┌────────────┐ ┌────────────┐  │    │      │      │        │          │
│   │  │   Auth     │ │   Users    │  │    │      │      │        │          │
│   │  │  Service   │ │  Service   │  │    │      │      │        │          │
│   │  └────────────┘ └────────────┘  │    │      │      │        │          │
│   │  ┌────────────┐ ┌────────────┐  │    │      │      │        │          │
│   │  │   Jobs     │ │  Payments  │  │    │      │      │        │          │
│   │  │  Service   │ │  Service   │  │    │      │      │        │          │
│   │  └────────────┘ └────────────┘  │    │      │      │        │          │
│   │  ┌────────────┐ ┌────────────┐  │    │      │      │        │          │
│   │  │   Chat     │ │Notification│  │    │      │      │        │          │
│   │  │  Service   │ │  Service   │  │    │      │      │        │          │
│   │  └────────────┘ └────────────┘  │    │      │      │        │          │
│   └─────────────────────────────────┘    │      │      │        │          │
│                                          │      │      │        │          │
│   ┌───────────────────────────────────────────────────────────────────────┐ │
│   │                        INFRASTRUCTURE LAYER                           │ │
│   │                                                                       │ │
│   │  ┌──────────┐  ┌──────────┐  ┌───────────────┐  ┌─────────────────┐  │ │
│   │  │PostgreSQL│  │  Redis   │  │Elasticsearch  │  │  Kafka +        │  │ │
│   │  │  (main   │  │ (cache + │  │  (search +    │  │  Zookeeper      │  │ │
│   │  │    db)   │  │sessions) │  │   analytics)  │  │ (event stream)  │  │ │
│   │  └──────────┘  └──────────┘  └───────────────┘  └─────────────────┘  │ │
│   │                                                                       │ │
│   │  ┌──────────┐  ┌──────────┐  ┌───────────────┐                       │ │
│   │  │ AWS S3   │  │ Stripe   │  │  SendGrid /   │                       │ │
│   │  │(file     │  │(payments)│  │   MailHog     │                       │ │
│   │  │ storage) │  │          │  │  (email)      │                       │ │
│   │  └──────────┘  └──────────┘  └───────────────┘                       │ │
│   └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│   ┌───────────────────────────────────────────────────────────────────────┐ │
│   │                     SHARED PACKAGES LAYER                             │ │
│   │   packages/shared: TypeScript types | Zod schemas | Prisma ORM       │ │
│   └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Prerequisites

Before getting started, make sure you have the following installed:

| Tool | Version | Installation |
|------|---------|-------------|
| [Node.js](https://nodejs.org/) | >= 20.0.0 | `nvm install 20` |
| [pnpm](https://pnpm.io/) | >= 9.0.0 | `npm install -g pnpm@9` |
| [Docker](https://www.docker.com/) | >= 24.0.0 | [Docker Desktop](https://www.docker.com/products/docker-desktop/) |
| [Docker Compose](https://docs.docker.com/compose/) | >= 2.20.0 | Included with Docker Desktop |
| [Git](https://git-scm.com/) | >= 2.40.0 | `brew install git` |

---

## ⚡ Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/your-org/freelancer-platform.git
cd freelancer-platform
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
# Edit .env with your local values (defaults work for local Docker services)
```

### 4. Start infrastructure services

```bash
pnpm docker:up
# Wait ~30 seconds for all services to be healthy
docker-compose ps   # verify all services are running
```

### 5. Generate Prisma client & run migrations

```bash
pnpm db:generate
pnpm db:migrate
```

### 6. Seed the database (optional)

```bash
pnpm db:seed
```

### 7. Start the development servers

```bash
pnpm dev
```

This starts all apps and packages in watch mode:
- **Web app** → http://localhost:3000
- **API / Backend** → http://localhost:4000
- **API Docs (Swagger)** → http://localhost:4000/api/docs
- **Kafka UI** → http://localhost:8090
- **MailHog (email dev)** → http://localhost:8025

---

## 🌍 Environment Setup

Copy `.env.example` to `.env` and fill in the required values. For local development, the default Docker-based values work out of the box.

For production, you will need to supply real credentials for the following services:

| Service | Variable(s) | Where to get it |
|---------|------------|-----------------|
| PostgreSQL | `DATABASE_URL` | Self-hosted or [Neon](https://neon.tech) / [Supabase](https://supabase.com) |
| Redis | `REDIS_URL` | Self-hosted or [Upstash](https://upstash.com) |
| Elasticsearch | `ELASTICSEARCH_URL` | Self-hosted or [Elastic Cloud](https://www.elastic.co/cloud) |
| Kafka | `KAFKA_BROKERS` | Self-hosted or [Confluent Cloud](https://confluent.io) |
| AWS S3 | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | [AWS Console](https://aws.amazon.com) |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | [Stripe Dashboard](https://dashboard.stripe.com) |
| SendGrid | `SENDGRID_API_KEY` | [SendGrid Dashboard](https://sendgrid.com) |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | [Google Cloud Console](https://console.cloud.google.com) |
| GitHub OAuth | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | [GitHub Developer Settings](https://github.com/settings/developers) |
| Firebase | `FCM_SERVER_KEY` | [Firebase Console](https://console.firebase.google.com) |

> ⚠️ **Never commit `.env` to version control.** Only `.env.example` should be committed.

---

## 📁 Monorepo Structure

```
freelancer-platform/
│
├── apps/
│   ├── web/                      # Next.js 14 App Router (client-facing web app)
│   │   ├── app/                  # App Router pages and layouts
│   │   ├── components/           # Shared UI components
│   │   ├── hooks/                # Custom React hooks
│   │   ├── lib/                  # Utilities, API client
│   │   ├── public/               # Static assets
│   │   ├── next.config.js
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   │
│   └── mobile/                   # React Native Expo app
│       ├── app/                  # Expo Router screens
│       ├── components/           # Mobile UI components
│       ├── hooks/                # Mobile-specific hooks
│       ├── assets/               # Images, fonts
│       ├── app.json
│       └── package.json
│
├── packages/
│   ├── backend/                  # NestJS microservices API
│   │   ├── src/
│   │   │   ├── auth/             # Auth module (JWT, OAuth, guards)
│   │   │   ├── users/            # Users module
│   │   │   ├── jobs/             # Jobs & proposals module
│   │   │   ├── payments/         # Stripe payments module
│   │   │   ├── chat/             # Real-time chat (WebSockets)
│   │   │   ├── notifications/    # Push & email notifications
│   │   │   ├── search/           # Elasticsearch search module
│   │   │   ├── files/            # S3 file upload module
│   │   │   └── common/           # Guards, interceptors, decorators
│   │   ├── test/
│   │   └── package.json
│   │
│   └── shared/                   # Shared code across all packages
│       ├── src/
│       │   ├── types/            # TypeScript interfaces & enums
│       │   ├── schemas/          # Zod validation schemas
│       │   ├── prisma/           # Prisma schema & migrations
│       │   │   ├── schema.prisma
│       │   │   └── migrations/
│       │   └── index.ts
│       └── package.json
│
├── .github/
│   └── workflows/
│       ├── ci.yml                # Continuous Integration pipeline
│       ├── cd.yml                # Continuous Deployment pipeline
│       └── pr-checks.yml         # PR validation & labeling
│
├── docker-compose.yml            # Local infrastructure services
├── turbo.json                    # Turborepo pipeline configuration
├── package.json                  # Root package (workspace scripts)
├── pnpm-workspace.yaml           # pnpm workspace definition
├── .env.example                  # Environment variable template
├── .gitignore
└── README.md
```

---

## 🛠️ Available Scripts

Run these from the **monorepo root**:

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start all apps and packages in development/watch mode |
| `pnpm build` | Build all apps and packages (respects Turbo cache) |
| `pnpm test` | Run all tests across the monorepo |
| `pnpm lint` | Lint all packages (ESLint + TypeScript) |
| `pnpm format` | Format all files with Prettier |
| `pnpm clean` | Remove all build artifacts and node_modules |
| `pnpm db:generate` | Generate Prisma client from schema |
| `pnpm db:push` | Push Prisma schema changes to the database |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:seed` | Seed the database with initial data |
| `pnpm docker:up` | Start all Docker services in detached mode |
| `pnpm docker:down` | Stop all Docker services |
| `pnpm docker:logs` | Tail logs from all Docker services |

To run a script for a **specific workspace**:

```bash
pnpm --filter web dev           # Start only the web app
pnpm --filter backend dev       # Start only the backend
pnpm --filter shared build      # Build only the shared package
```

---

## 🌐 API Endpoints Overview

The backend exposes a RESTful API at `http://localhost:4000`. Full Swagger docs are available at `/api/docs`.

| Module | Base Path | Key Endpoints |
|--------|-----------|--------------|
| Auth | `/api/auth` | `POST /register`, `POST /login`, `POST /refresh`, `GET /me` |
| Users | `/api/users` | `GET /`, `GET /:id`, `PATCH /:id`, `DELETE /:id` |
| Profiles | `/api/profiles` | `GET /:userId`, `PUT /:userId` |
| Jobs | `/api/jobs` | `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id` |
| Proposals | `/api/proposals` | `POST /`, `GET /job/:jobId`, `PATCH /:id/status` |
| Payments | `/api/payments` | `POST /intent`, `POST /webhook`, `GET /history` |
| Chat | `/api/chat` | `GET /rooms`, `POST /rooms`, `GET /rooms/:id/messages` |
| Files | `/api/files` | `POST /upload`, `DELETE /:key` |
| Search | `/api/search` | `GET /jobs`, `GET /freelancers` |
| Notifications | `/api/notifications` | `GET /`, `PATCH /:id/read`, `POST /push` |

> 💡 WebSocket events for real-time chat and notifications are documented in the Swagger UI under the **WebSocket** section.

---

## 🏗️ Tech Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Web Frontend** | Next.js | 14.x | SSR/SSG web app with App Router |
| **Mobile** | React Native + Expo | SDK 51 | Cross-platform iOS & Android app |
| **Backend** | NestJS | 10.x | Microservices API framework |
| **Language** | TypeScript | 5.x | End-to-end type safety |
| **ORM** | Prisma | 5.x | Type-safe database access |
| **Database** | PostgreSQL | 15 | Primary relational database |
| **Cache** | Redis | 7 | Session store, caching, queues |
| **Search** | Elasticsearch | 8.11 | Full-text search & analytics |
| **Messaging** | Apache Kafka | 7.5 | Async event streaming |
| **Auth** | JWT + Passport | — | Authentication & authorization |
| **OAuth** | Google, GitHub | — | Social login |
| **Payments** | Stripe | — | Payment processing & escrow |
| **Storage** | AWS S3 | — | File & media storage |
| **Email** | SendGrid | — | Transactional email |
| **Push Notifications** | Firebase FCM | — | Mobile push notifications |
| **Styling (Web)** | Tailwind CSS | 3.x | Utility-first CSS |
| **Validation** | Zod | 3.x | Runtime schema validation |
| **Build System** | Turborepo | 2.x | Monorepo task orchestration |
| **Package Manager** | pnpm | 9.x | Fast, disk-efficient packages |
| **Containerization** | Docker + Compose | — | Local dev & deployment |
| **CI/CD** | GitHub Actions | — | Automated pipelines |
| **Testing** | Jest + Testing Library | — | Unit & integration tests |

---

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests for a specific app
pnpm --filter backend test
pnpm --filter web test

# Run tests in watch mode
pnpm --filter backend test -- --watch

# Generate coverage report
pnpm --filter backend test -- --coverage
```

Coverage reports are generated in each package's `coverage/` directory and uploaded to CI artifacts on every pull request.

---

## 🐳 Docker Services

| Service | Port | URL | Purpose |
|---------|------|-----|---------|
| PostgreSQL | 5432 | — | Primary database |
| Redis | 6379 | — | Cache & session store |
| Elasticsearch | 9200 | http://localhost:9200 | Search engine |
| Zookeeper | 2181 | — | Kafka coordinator |
| Kafka | 9092 | — | Message broker |
| Kafka UI | 8090 | http://localhost:8090 | Kafka management UI |
| MailHog | 8025 / 1025 | http://localhost:8025 | Dev email catcher |

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork** the repository and create a new branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Follow conventional commits** for commit messages:
   ```
   feat: add freelancer rating system
   fix: resolve payment webhook race condition
   docs: update API endpoint documentation
   chore: upgrade dependencies
   ```

3. **Write tests** for any new functionality.

4. **Run the full check suite** before opening a PR:
   ```bash
   pnpm lint && pnpm test && pnpm build
   ```

5. **Open a Pull Request** against the `develop` branch with a clear description of changes.

### Commit Message Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Valid types are:

| Type | Description |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only changes |
| `style` | Changes that do not affect the meaning of the code |
| `refactor` | A code change that neither fixes a bug nor adds a feature |
| `perf` | A code change that improves performance |
| `test` | Adding missing tests or correcting existing tests |
| `chore` | Changes to the build process or auxiliary tools |
| `ci` | Changes to CI configuration files and scripts |

### Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code, auto-deploys to production on version tags |
| `develop` | Integration branch, auto-deploys to staging |
| `feat/*` | Feature branches, merged into `develop` via PR |
| `fix/*` | Bug fix branches |
| `hotfix/*` | Critical production fixes, merged into `main` directly |

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2024 Freelancer Platform Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🙋 Support

- 📧 Email: support@freelancerplatform.com
- 💬 Discord: [Join our server](https://discord.gg/freelancer-platform)
- 🐛 Issues: [GitHub Issues](https://github.com/your-org/freelancer-platform/issues)
- 📖 Docs: [docs.freelancerplatform.com](https://docs.freelancerplatform.com)

---

<div align="center">
  <sub>Built with ❤️ using Turborepo, Next.js, NestJS, and React Native</sub>
</div>