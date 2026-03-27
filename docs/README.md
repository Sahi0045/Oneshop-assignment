# Freelancer Platform - Technical Documentation

## Overview

This directory contains comprehensive technical documentation for the Freelancer Platform, a scalable global marketplace connecting freelancers with clients through secure payments, verified profiles, and milestone-based delivery.

## Documentation Structure

### 1. [Architecture Diagram](./architecture.md)
Complete system architecture including:
- High-level microservices architecture with API Gateway pattern
- Deployment architecture on Kubernetes
- Service communication patterns (REST, Kafka, WebSocket)
- Data flow diagrams for key operations
- Security architecture with multiple defense layers
- Scalability and performance strategies
- Monitoring and observability setup
- CI/CD pipeline configuration

**Key Highlights:**
- Microservices: Auth, Project, Payment, Chat, Notification, Search, Admin
- Database: PostgreSQL 15 with Prisma ORM
- Cache: Redis 7 for sessions and rate limiting
- Message Queue: Kafka for async event processing
- Search: Elasticsearch for full-text search
- File Storage: AWS S3 / Cloudflare R2
- Deployment: Kubernetes on AWS/GCP

### 2. [Database ERD](./database-erd.md)
Detailed entity relationship diagram with:
- Complete Mermaid ERD visualization
- All database entities and relationships
- Enum definitions for status fields
- Index specifications for query optimization
- Foreign key constraints and cascading rules

**Core Entities:**
- Users (with roles: Freelancer, Client, Admin)
- Projects (Fixed Price, Hourly, Contest)
- Bids & Contracts
- Milestones & Transactions
- Messages & Notifications
- Reviews & Disputes
- Skills, Categories, KYC Verifications

### 3. [Prisma Schema](./prisma-schema.prisma)
Production-ready Prisma schema including:
- All models with proper field types
- Enum definitions matching business logic
- Relations with cascade delete rules
- Indexes for performance optimization
- JSON fields for flexible metadata
- Timestamps for audit trails

**Usage:**
```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed database
npx prisma db seed
```

### 4. [OpenAPI Specification](./openapi.yaml)
Complete REST API documentation with:
- 40+ endpoints across 10 service domains
- Request/response schemas with validation rules
- Authentication flows (JWT Bearer tokens)
- Error response specifications
- Pagination and filtering parameters
- File upload specifications

**API Domains:**
- Auth: Registration, login, OAuth, token refresh
- Users: Profile management, KYC verification
- Projects: CRUD operations with filtering
- Bids: Submit, update, accept/reject
- Contracts: Milestone management, deliverables
- Payments: Escrow, payment intents, webhooks
- Messages: Real-time chat, attachments
- Reviews: Rating system, feedback
- Disputes: Filing, evidence, resolution
- Admin: User verification, analytics, moderation

**Testing:**
```bash
# Import into Postman/Insomnia
# Or use Swagger UI
npx swagger-ui-express openapi.yaml
```

### 5. [Microservices Communication](./microservices-communication.md)
Detailed service interaction patterns:
- Complete user flow diagrams (project lifecycle, disputes, messaging)
- Kafka event topics and schemas
- Service dependency matrix
- Error handling and retry strategies
- Idempotency patterns
- Rate limiting configuration
- Distributed tracing setup
- Data consistency patterns (Saga, Event Sourcing)
- Health check specifications

**Event-Driven Architecture:**
- 10+ Kafka topics for async communication
- Event schemas with versioning
- Dead Letter Queue (DLQ) for failed events
- Consumer groups for parallel processing

## Quick Start

### Prerequisites
```bash
# Required tools
- Node.js 20+
- PostgreSQL 15
- Redis 7
- Docker & Docker Compose
- Kubernetes (for production)
```

### Local Development Setup

1. **Clone and Install**
```bash
git clone <repository>
cd freelancer-platform
npm install
```

2. **Setup Environment Variables**
```bash
cp .env.example .env
# Configure DATABASE_URL, REDIS_URL, JWT_SECRET, etc.
```

3. **Initialize Database**
```bash
cd packages/backend
npx prisma migrate dev
npx prisma db seed
```

4. **Start Services**
```bash
# Using Docker Compose
docker-compose up -d

# Or start individually
npm run dev:web      # Next.js web app
npm run dev:mobile   # Expo mobile app
npm run dev:backend  # NestJS backend
```

5. **Verify Setup**
```bash
# Health check
curl http://localhost:3000/api/health

# API documentation
open http://localhost:3000/api/docs
```

## Architecture Decisions

### Why Microservices?
- **Scalability**: Scale services independently based on load
- **Resilience**: Failure isolation prevents cascading failures
- **Team Autonomy**: Teams can work on services independently
- **Technology Flexibility**: Use best tool for each service

### Why Kafka?
- **Decoupling**: Services don't need to know about each other
- **Reliability**: Event persistence and replay capability
- **Scalability**: Handle millions of events per second
- **Audit Trail**: Complete event history for compliance

### Why PostgreSQL?
- **ACID Compliance**: Critical for financial transactions
- **JSON Support**: Flexible metadata without schema changes
- **Performance**: Excellent query optimization
- **Ecosystem**: Rich tooling and extensions

### Why Redis?
- **Speed**: Sub-millisecond latency for cache hits
- **Pub/Sub**: Real-time messaging support
- **Session Store**: Distributed session management
- **Rate Limiting**: Token bucket algorithm support

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| API Response Time (p95) | < 200ms | Prometheus |
| API Response Time (p99) | < 500ms | Prometheus |
| Database Query Time | < 50ms | Slow query log |
| WebSocket Latency | < 100ms | Custom metrics |
| Page Load (LCP) | < 2.5s | Lighthouse |
| Concurrent Users | 10,000+ | Load testing |
| Throughput | 5,000 req/s | Load testing |
| Uptime | 99.9% | StatusPage |

## Security Measures

### Authentication & Authorization
- JWT with 15min access + 7d refresh tokens
- Role-based access control (RBAC)
- OAuth2 integration (Google, GitHub)
- Multi-factor authentication (MFA) ready

### Data Protection
- TLS 1.3 for all communications
- AES-256 encryption at rest
- PCI-DSS compliant payment handling
- GDPR compliant data processing

### Application Security
- OWASP Top 10 protection
- SQL injection prevention (Prisma ORM)
- XSS protection (Content Security Policy)
- CSRF tokens for state-changing operations
- Rate limiting (100 req/min per user)
- Input validation (Joi/Zod schemas)

### Infrastructure Security
- DDoS protection (CloudFlare)
- Web Application Firewall (WAF)
- Container scanning (Trivy)
- Secrets management (AWS Secrets Manager)
- Network policies (Kubernetes)

## Monitoring & Observability

### Metrics (Prometheus + Grafana)
- Request rate, error rate, duration (RED)
- CPU, memory, disk usage per service
- Database connection pool utilization
- Kafka consumer lag
- Cache hit ratio

### Logging (ELK Stack)
- Structured JSON logs
- Centralized log aggregation
- Log retention: 30 days
- Search and analysis via Kibana

### Tracing (Jaeger)
- Distributed request tracing
- Service dependency mapping
- Performance bottleneck identification
- Error root cause analysis

### Alerting (AlertManager + PagerDuty)
- Error rate > 5%
- Response time p95 > 500ms
- Database connection pool > 80%
- Kafka consumer lag > 1000
- Disk usage > 85%

## Testing Strategy

### Unit Tests
- Coverage target: >70%
- Framework: Jest
- Run: `npm test`

### Integration Tests
- API endpoint testing
- Database integration
- External service mocking

### E2E Tests
- Critical user flows
- Framework: Playwright
- Run: `npm run test:e2e`

### Load Tests
- Tool: k6
- Scenarios: 1k, 5k, 10k concurrent users
- Run: `npm run test:load`

## Deployment

### Staging
```bash
# Deploy to staging
npm run deploy:staging

# Run smoke tests
npm run test:smoke:staging
```

### Production
```bash
# Blue-green deployment
npm run deploy:prod

# Automatic rollback on health check failure
# Manual approval required for database migrations
```

### Rollback
```bash
# Rollback to previous version
kubectl rollout undo deployment/project-service -n production
```

## Contributing

### Code Standards
- TypeScript strict mode
- ESLint + Prettier
- Conventional commits
- PR reviews required

### Git Workflow
1. Create feature branch from `develop`
2. Implement changes with tests
3. Submit PR with description
4. Pass CI checks (lint, test, build)
5. Get approval from 2 reviewers
6. Merge to `develop`
7. Auto-deploy to staging
8. Manual promotion to production

## Support

### Documentation
- API Docs: https://api.freelancerplatform.com/docs
- Developer Portal: https://developers.freelancerplatform.com
- Status Page: https://status.freelancerplatform.com

### Contact
- Technical Support: tech@freelancerplatform.com
- Security Issues: security@freelancerplatform.com
- Slack: #engineering

## License

Proprietary - NivixPe Team © 2026
