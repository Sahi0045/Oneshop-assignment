# Freelancer Platform - System Architecture

## 1. High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Next.js Web App]
        MOBILE[React Native Mobile]
    end
    
    subgraph "CDN & Edge"
        CDN[CloudFlare CDN]
        WAF[Web Application Firewall]
    end
    
    subgraph "API Gateway Layer"
        KONG[Kong API Gateway]
        RATELIMIT[Rate Limiter]
        AUTHZ[Authorization]
    end
    
    subgraph "Microservices"
        AUTH[Auth Service<br/>Node.js + Passport]
        PROJECT[Project Service<br/>NestJS]
        PAYMENT[Payment Service<br/>Node.js]
        CHAT[Chat Service<br/>Socket.IO]
        NOTIF[Notification Service<br/>Node.js]
        SEARCH[Search Service<br/>Elasticsearch]
        ADMIN[Admin Service<br/>NestJS]
    end
    
    subgraph "Data Layer"
        POSTGRES[(PostgreSQL 15<br/>Primary DB)]
        REDIS[(Redis 7<br/>Cache + Sessions)]
        ES[(Elasticsearch<br/>Search Index)]
        S3[(S3/R2<br/>File Storage)]
    end
    
    subgraph "Message Queue"
        KAFKA[Kafka/BullMQ<br/>Event Bus]
    end
    
    subgraph "External Services"
        STRIPE[Stripe/Razorpay<br/>Payment Gateway]
        FCM[Firebase FCM<br/>Push Notifications]
        SENDGRID[SendGrid<br/>Email Service]
        KYC[KYC Provider<br/>ID Verification]
    end
    
    WEB --> CDN
    MOBILE --> CDN
    CDN --> WAF
    WAF --> KONG
    
    KONG --> RATELIMIT
    RATELIMIT --> AUTHZ
    
    AUTHZ --> AUTH
    AUTHZ --> PROJECT
    AUTHZ --> PAYMENT
    AUTHZ --> CHAT
    AUTHZ --> NOTIF
    AUTHZ --> SEARCH
    AUTHZ --> ADMIN
    
    AUTH --> POSTGRES
    AUTH --> REDIS
    PROJECT --> POSTGRES
    PROJECT --> KAFKA
    PAYMENT --> POSTGRES
    PAYMENT --> KAFKA
    CHAT --> REDIS
    CHAT --> POSTGRES
    NOTIF --> KAFKA
    SEARCH --> ES
    ADMIN --> POSTGRES
    
    PROJECT --> SEARCH
    PAYMENT --> STRIPE
    NOTIF --> FCM
    NOTIF --> SENDGRID
    AUTH --> KYC
    
    KAFKA --> NOTIF
    KAFKA --> SEARCH
    
    S3 -.-> WEB
    S3 -.-> MOBILE
```

## 2. Deployment Architecture

```mermaid
graph TB
    subgraph "AWS/GCP Cloud"
        subgraph "Kubernetes Cluster"
            subgraph "Namespace: Production"
                INGRESS[Ingress Controller<br/>NGINX]
                
                subgraph "Service Mesh"
                    SVC1[Auth Pods x3]
                    SVC2[Project Pods x5]
                    SVC3[Payment Pods x3]
                    SVC4[Chat Pods x4]
                    SVC5[Notification Pods x2]
                    SVC6[Admin Pods x2]
                end
            end
        end
        
        subgraph "Managed Services"
            RDS[(RDS PostgreSQL<br/>Multi-AZ)]
            ELASTICACHE[(ElastiCache Redis<br/>Cluster Mode)]
            ELASTICSEARCH[(AWS OpenSearch)]
        end
        
        subgraph "Storage"
            S3BUCKET[S3 Buckets<br/>+ CloudFront]
        end
        
        subgraph "Monitoring"
            PROMETHEUS[Prometheus]
            GRAFANA[Grafana]
            JAEGER[Jaeger Tracing]
            ELK[ELK Stack]
        end
    end
    
    INGRESS --> SVC1
    INGRESS --> SVC2
    INGRESS --> SVC3
    INGRESS --> SVC4
    INGRESS --> SVC5
    INGRESS --> SVC6
    
    SVC1 --> RDS
    SVC2 --> RDS
    SVC3 --> RDS
    SVC4 --> ELASTICACHE
    
    SVC2 --> ELASTICSEARCH
    
    SVC1 -.-> PROMETHEUS
    SVC2 -.-> PROMETHEUS
    SVC3 -.-> PROMETHEUS
    
    PROMETHEUS --> GRAFANA
    SVC1 -.-> JAEGER
    SVC1 -.-> ELK
```

## 3. Service Communication Patterns

### 3.1 Synchronous Communication (REST)
- Client → API Gateway → Microservices
- Service-to-Service: Direct HTTP calls with circuit breakers
- Timeout: 5s default, 30s for payment operations

### 3.2 Asynchronous Communication (Kafka)

```mermaid
sequenceDiagram
    participant Project Service
    participant Kafka
    participant Notification Service
    participant Search Service
    participant Payment Service
    
    Project Service->>Kafka: project.created
    Kafka->>Notification Service: Consume event
    Kafka->>Search Service: Consume event
    
    Note over Notification Service: Send email to client
    Note over Search Service: Index project
    
    Project Service->>Kafka: bid.submitted
    Kafka->>Notification Service: Consume event
    Kafka->>Project Service: Update bid count
    
    Project Service->>Kafka: contract.awarded
    Kafka->>Payment Service: Consume event
    Kafka->>Notification Service: Consume event
    
    Note over Payment Service: Lock escrow funds
```

### 3.3 Real-time Communication (WebSocket)
- Chat Service: Socket.IO with Redis adapter for horizontal scaling
- Notification Service: Server-Sent Events (SSE) for live updates

## 4. Data Flow Patterns

### 4.1 Project Creation Flow

```mermaid
sequenceDiagram
    participant Client
    participant API Gateway
    participant Auth Service
    participant Project Service
    participant Kafka
    participant Search Service
    participant Notification Service
    
    Client->>API Gateway: POST /api/projects
    API Gateway->>Auth Service: Validate JWT
    Auth Service-->>API Gateway: User context
    API Gateway->>Project Service: Create project
    
    Project Service->>Project Service: Validate & save to DB
    Project Service->>Kafka: Publish project.created
    Project Service-->>Client: 201 Created
    
    Kafka->>Search Service: project.created event
    Search Service->>Search Service: Index in Elasticsearch
    
    Kafka->>Notification Service: project.created event
    Notification Service->>Notification Service: Send notifications
```

### 4.2 Payment & Escrow Flow

```mermaid
sequenceDiagram
    participant Client
    participant Payment Service
    participant Stripe/Razorpay
    participant Kafka
    participant Project Service
    participant Notification Service
    
    Client->>Payment Service: Award contract
    Payment Service->>Stripe/Razorpay: Create payment intent
    Stripe/Razorpay-->>Payment Service: Payment intent ID
    Payment Service-->>Client: Redirect to payment
    
    Client->>Stripe/Razorpay: Complete payment
    Stripe/Razorpay->>Payment Service: Webhook: payment.succeeded
    
    Payment Service->>Payment Service: Lock funds in escrow
    Payment Service->>Kafka: Publish escrow.locked
    
    Kafka->>Project Service: Update contract status
    Kafka->>Notification Service: Notify freelancer
    
    Note over Client: Work completed
    
    Client->>Payment Service: Release milestone
    Payment Service->>Payment Service: Calculate fees
    Payment Service->>Stripe/Razorpay: Transfer to freelancer
    Payment Service->>Kafka: Publish milestone.released
```

## 5. Security Architecture

```mermaid
graph TB
    subgraph "Security Layers"
        L1[Layer 1: DDoS Protection<br/>CloudFlare]
        L2[Layer 2: WAF<br/>OWASP Rules]
        L3[Layer 3: API Gateway<br/>Rate Limiting + JWT]
        L4[Layer 4: Service Auth<br/>mTLS + API Keys]
        L5[Layer 5: Data Encryption<br/>At Rest + In Transit]
    end
    
    L1 --> L2
    L2 --> L3
    L3 --> L4
    L4 --> L5
    
    subgraph "Security Controls"
        RBAC[RBAC Authorization]
        AUDIT[Audit Logging]
        SECRETS[Secrets Management<br/>AWS Secrets Manager]
        SCAN[Container Scanning<br/>Trivy]
    end
```

### Security Measures
- **Authentication**: JWT with 15min access + 7d refresh tokens
- **Authorization**: Role-based access control (RBAC)
- **Data Encryption**: TLS 1.3 in transit, AES-256 at rest
- **PCI Compliance**: No card data stored, tokenization via Stripe
- **GDPR**: Data anonymization, right to deletion, audit logs
- **Rate Limiting**: 100 req/min per user, 1000 req/min per IP
- **Input Validation**: Joi/Zod schemas on all endpoints
- **SQL Injection**: Parameterized queries via Prisma ORM
- **XSS Protection**: Content Security Policy headers
- **CSRF**: SameSite cookies + CSRF tokens

## 6. Scalability Strategy

### 6.1 Horizontal Scaling
- All services stateless (session in Redis)
- Auto-scaling: CPU > 70% → add pods
- Load balancing: Round-robin with health checks

### 6.2 Database Scaling
- Read replicas for analytics queries
- Connection pooling (PgBouncer)
- Partitioning: Projects table by created_date (monthly)
- Archival: Move completed projects > 2 years to cold storage

### 6.3 Caching Strategy
```
L1: Browser cache (static assets)
L2: CDN cache (CloudFlare, 1 hour TTL)
L3: Redis cache (API responses, 5 min TTL)
L4: Database query cache
```

### 6.4 Performance Targets
- API Response Time: p95 < 200ms, p99 < 500ms
- Database Queries: < 50ms average
- WebSocket Latency: < 100ms
- File Upload: Support up to 50MB
- Concurrent Users: 10,000+ at launch
- Throughput: 5,000 requests/second

## 7. Monitoring & Observability

```mermaid
graph LR
    subgraph "Metrics"
        PROM[Prometheus]
        GRAF[Grafana Dashboards]
    end
    
    subgraph "Logging"
        FLUENTD[Fluentd]
        ELK[Elasticsearch + Kibana]
    end
    
    subgraph "Tracing"
        JAEGER[Jaeger]
        ZIPKIN[Zipkin]
    end
    
    subgraph "Alerting"
        ALERT[AlertManager]
        PAGER[PagerDuty]
        SLACK[Slack Webhooks]
    end
    
    PROM --> GRAF
    PROM --> ALERT
    ALERT --> PAGER
    ALERT --> SLACK
    
    FLUENTD --> ELK
    JAEGER --> GRAF
```

### Key Metrics to Monitor
- Request rate, error rate, duration (RED metrics)
- CPU, memory, disk usage per service
- Database connection pool utilization
- Kafka consumer lag
- Payment success/failure rates
- WebSocket connection count
- Cache hit ratio

## 8. Disaster Recovery

### 8.1 Backup Strategy
- Database: Automated daily backups, 30-day retention
- Point-in-time recovery: 5-minute granularity
- Cross-region replication for critical data

### 8.2 High Availability
- Multi-AZ deployment
- Database failover: < 60 seconds
- Service failover: Automatic via K8s
- RTO: 1 hour, RPO: 5 minutes

## 9. CI/CD Pipeline

```mermaid
graph LR
    DEV[Developer Push] --> GIT[GitHub]
    GIT --> ACTIONS[GitHub Actions]
    ACTIONS --> LINT[Lint + Format]
    LINT --> TEST[Unit Tests]
    TEST --> BUILD[Docker Build]
    BUILD --> SCAN[Security Scan]
    SCAN --> PUSH[Push to Registry]
    PUSH --> DEPLOY[Deploy to K8s]
    DEPLOY --> SMOKE[Smoke Tests]
    SMOKE --> PROD[Production]
```

### Pipeline Stages
1. Code quality: ESLint, Prettier
2. Testing: Jest (>70% coverage required)
3. Security: Trivy container scan, OWASP dependency check
4. Build: Multi-stage Docker builds
5. Deploy: Blue-green deployment strategy
6. Rollback: Automatic on health check failure
