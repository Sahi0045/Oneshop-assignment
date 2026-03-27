# Freelancer Platform - Database Schema & ERD

## Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o{ projects : "creates"
    users ||--o{ bids : "submits"
    users ||--o{ reviews : "writes"
    users ||--o{ reviews : "receives"
    users ||--o{ notifications : "receives"
    users ||--o{ transactions : "has"
    users ||--o{ disputes : "files"
    users ||--o{ kyc_verifications : "has"
    
    projects ||--o{ bids : "receives"
    projects ||--o{ milestones : "contains"
    projects ||--o{ contracts : "generates"
    projects ||--o{ messages : "has"
    projects }o--o{ skills : "requires"
    projects }o--o{ categories : "belongs_to"
    
    contracts ||--o{ milestones : "tracks"
    contracts ||--o{ transactions : "involves"
    contracts ||--o{ disputes : "may_have"
    
    bids ||--o| contracts : "becomes"
    
    users {
        uuid id PK
        string email UK
        string password_hash
        enum role
        string full_name
        string avatar_url
        jsonb profile_data
        decimal rating
        int total_reviews
        boolean is_verified
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }
    
    projects {
        uuid id PK
        uuid client_id FK
        string title
        text description
        enum type
        enum status
        decimal budget_min
        decimal budget_max
        date deadline
        enum visibility
        jsonb metadata
        timestamp created_at
        timestamp updated_at
    }
    
    bids {
        uuid id PK
        uuid project_id FK
        uuid freelancer_id FK
        decimal amount
        int delivery_days
        text proposal
        enum status
        timestamp created_at
    }
    
    contracts {
        uuid id PK
        uuid project_id FK
        uuid bid_id FK
        uuid freelancer_id FK
        uuid client_id FK
        decimal total_amount
        enum status
        timestamp started_at
        timestamp completed_at
    }
    
    milestones {
        uuid id PK
        uuid contract_id FK
        string title
        text description
        decimal amount
        date due_date
        enum status
        timestamp released_at
    }
    
    transactions {
        uuid id PK
        uuid contract_id FK
        uuid from_user_id FK
        uuid to_user_id FK
        decimal amount
        decimal platform_fee
        enum type
        enum status
        string payment_gateway_id
        timestamp created_at
    }
    
    reviews {
        uuid id PK
        uuid contract_id FK
        uuid reviewer_id FK
        uuid reviewee_id FK
        int rating
        text comment
        timestamp created_at
    }
    
    disputes {
        uuid id PK
        uuid contract_id FK
        uuid filed_by FK
        text reason
        jsonb evidence
        enum status
        uuid resolved_by FK
        text resolution
        timestamp created_at
        timestamp resolved_at
    }
    
    messages {
        uuid id PK
        uuid project_id FK
        uuid sender_id FK
        text content
        jsonb attachments
        boolean is_read
        timestamp created_at
    }
    
    notifications {
        uuid id PK
        uuid user_id FK
        string type
        text content
        jsonb metadata
        boolean is_read
        timestamp created_at
    }
    
    skills {
        uuid id PK
        string name UK
        string slug UK
        int project_count
    }
    
    categories {
        uuid id PK
        string name UK
        string slug UK
        uuid parent_id FK
    }
    
    kyc_verifications {
        uuid id PK
        uuid user_id FK
        string document_type
        string document_url
        enum status
        text rejection_reason
        timestamp verified_at
    }
```

## Detailed Schema Specifications

### Enums

```typescript
enum UserRole {
  FREELANCER = 'freelancer'
  CLIENT = 'client'
  ADMIN = 'admin'
}

enum ProjectType {
  FIXED_PRICE = 'fixed_price'
  HOURLY = 'hourly'
  CONTEST = 'contest'
}

enum ProjectStatus {
  DRAFT = 'draft'
  OPEN = 'open'
  IN_PROGRESS = 'in_progress'
  COMPLETED = 'completed'
  CANCELLED = 'cancelled'
}

enum ProjectVisibility {
  PUBLIC = 'public'
  INVITE_ONLY = 'invite_only'
  PRIVATE = 'private'
}

enum BidStatus {
  PENDING = 'pending'
  SHORTLISTED = 'shortlisted'
  ACCEPTED = 'accepted'
  REJECTED = 'rejected'
  WITHDRAWN = 'withdrawn'
}

enum ContractStatus {
  ACTIVE = 'active'
  COMPLETED = 'completed'
  CANCELLED = 'cancelled'
  DISPUTED = 'disputed'
}

enum MilestoneStatus {
  PENDING = 'pending'
  IN_PROGRESS = 'in_progress'
  SUBMITTED = 'submitted'
  APPROVED = 'approved'
  REJECTED = 'rejected'
}

enum TransactionType {
  ESCROW_LOCK = 'escrow_lock'
  MILESTONE_RELEASE = 'milestone_release'
  REFUND = 'refund'
  WITHDRAWAL = 'withdrawal'
}

enum TransactionStatus {
  PENDING = 'pending'
  COMPLETED = 'completed'
  FAILED = 'failed'
  REFUNDED = 'refunded'
}

enum DisputeStatus {
  OPEN = 'open'
  UNDER_REVIEW = 'under_review'
  RESOLVED = 'resolved'
  CLOSED = 'closed'
}

enum KYCStatus {
  PENDING = 'pending'
  APPROVED = 'approved'
  REJECTED = 'rejected'
}
```

### Indexes

```sql
-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_rating ON users(rating DESC);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- Projects
CREATE INDEX idx_projects_client_id ON projects(client_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_type ON projects(type);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX idx_projects_budget ON projects(budget_min, budget_max);
CREATE INDEX idx_projects_deadline ON projects(deadline);

-- Bids
CREATE INDEX idx_bids_project_id ON bids(project_id);
CREATE INDEX idx_bids_freelancer_id ON bids(freelancer_id);
CREATE INDEX idx_bids_status ON bids(status);
CREATE INDEX idx_bids_amount ON bids(amount);

-- Contracts
CREATE INDEX idx_contracts_project_id ON contracts(project_id);
CREATE INDEX idx_contracts_freelancer_id ON contracts(freelancer_id);
CREATE INDEX idx_contracts_client_id ON contracts(client_id);
CREATE INDEX idx_contracts_status ON contracts(status);

-- Transactions
CREATE INDEX idx_transactions_contract_id ON transactions(contract_id);
CREATE INDEX idx_transactions_from_user_id ON transactions(from_user_id);
CREATE INDEX idx_transactions_to_user_id ON transactions(to_user_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

-- Messages
CREATE INDEX idx_messages_project_id ON messages(project_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- Notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
```
