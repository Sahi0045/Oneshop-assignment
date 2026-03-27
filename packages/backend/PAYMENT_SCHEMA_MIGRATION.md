# Payment Module - Prisma Schema Migration Guide

## Overview

The payment service implementation uses Transaction fields that don't match the current Prisma schema. This guide provides the migration path to align the schema with the service implementation.

---

## Current Schema Issues

### Problem

**Service Implementation Uses:**
```typescript
// In payment.service.ts
await this.prisma.transaction.create({
  data: {
    contractId,
    userId,                    // ❌ Not in schema
    type: TransactionType.ESCROW_DEPOSIT,
    status: TransactionStatus.PENDING,
    amount,
    currency,
    stripePaymentIntentId,     // ❌ Not in schema
    stripeTransferId,          // ❌ Not in schema
    stripePayoutId,            // ❌ Not in schema
    stripeRefundId,            // ❌ Not in schema
    description,
    metadata,
  },
});
```

**Current Prisma Schema Has:**
```prisma
model Transaction {
  id               String   @id @default(uuid())
  contractId       String
  fromUserId       String   // ❌ Service uses userId instead
  toUserId         String   // ❌ Not used by service
  amount           Decimal
  platformFee      Decimal
  type             TransactionType
  status           TransactionStatus
  paymentGatewayId String?  // ❌ Service uses specific IDs
  createdAt        DateTime
  
  contract Contract @relation(...)
  fromUser User     @relation("FromUser", ...)
  toUser   User     @relation("ToUser", ...)
}
```

---

## Recommended Solution

### Option 1: Update Schema to Match Service (RECOMMENDED)

This is the simpler path as the service is already fully implemented and tested.

**Updated Transaction Model:**

```prisma
model Transaction {
  id          String            @id @default(uuid()) @db.Uuid
  contractId  String?           @map("contract_id") @db.Uuid
  userId      String            @map("user_id") @db.Uuid
  type        TransactionType
  status      TransactionStatus @default(PENDING)
  amount      Decimal           @db.Decimal(10, 2)
  currency    String            @default("usd") @db.VarChar(3)
  
  // Payment gateway IDs
  stripePaymentIntentId String? @map("stripe_payment_intent_id")
  stripeTransferId      String? @map("stripe_transfer_id")
  stripePayoutId        String? @map("stripe_payout_id")
  stripeRefundId        String? @map("stripe_refund_id")
  razorpayOrderId       String? @map("razorpay_order_id")
  razorpayPaymentId     String? @map("razorpay_payment_id")
  razorpayTransferId    String? @map("razorpay_transfer_id")
  razorpayPayoutId      String? @map("razorpay_payout_id")
  razorpayRefundId      String? @map("razorpay_refund_id")
  
  description   String?  @db.Text
  failureReason String?  @map("failure_reason") @db.Text
  metadata      Json?    @db.JsonB
  
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  // Relations
  contract Contract? @relation(fields: [contractId], references: [id], onDelete: Cascade)
  user     User      @relation("UserTransactions", fields: [userId], references: [id])
  
  @@index([contractId])
  @@index([userId])
  @@index([type])
  @@index([status])
  @@index([createdAt(sort: Desc)])
  @@index([stripePaymentIntentId])
  @@index([razorpayOrderId])
  @@map("transactions")
}

enum TransactionType {
  ESCROW_DEPOSIT
  ESCROW_RELEASE
  PLATFORM_FEE
  REFUND
  WITHDRAWAL
  DISPUTE_HOLD
  DISPUTE_RELEASE
}

enum TransactionStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
  CANCELLED
}
```

**User Model Update:**

```prisma
model User {
  // ... existing fields ...
  
  // Relations
  transactions Transaction[] @relation("UserTransactions")
  
  // Remove these if they exist:
  // fromTransactions Transaction[] @relation("FromUser")
  // toTransactions   Transaction[] @relation("ToUser")
}
```

**Contract Model Update:**

Add dispute-related fields:

```prisma
model Contract {
  // ... existing fields ...
  
  status              ContractStatus @default(ACTIVE)
  disputeReason       String?        @map("dispute_reason") @db.Text
  disputedAt          DateTime?      @map("disputed_at")
  disputeResolvedAt   DateTime?      @map("dispute_resolved_at")
  disputeResolution   String?        @map("dispute_resolution")
  disputeAdminNotes   String?        @map("dispute_admin_notes") @db.Text
  
  // ... rest of fields ...
}

enum ContractStatus {
  ACTIVE
  PAUSED
  COMPLETED
  CANCELLED
  DISPUTED
}
```

---

## Migration Steps

### Step 1: Backup Database

```bash
# Create a backup before migration
pg_dump -U postgres -d freelancer_platform > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Step 2: Update Prisma Schema

Replace the Transaction model in `packages/backend/prisma/schema.prisma` with the updated version above.

### Step 3: Create Migration

```bash
cd packages/backend
npx prisma migrate dev --name update_transaction_model_for_payment_service
```

This will:
1. Generate SQL migration file
2. Apply migration to database
3. Regenerate Prisma Client

### Step 4: Review Migration SQL

Check the generated migration file in `prisma/migrations/` to ensure it:
- Renames columns correctly (fromUserId → userId)
- Adds new columns (stripePaymentIntentId, etc.)
- Drops unused columns (toUserId, paymentGatewayId)
- Preserves existing data

### Step 5: Apply to Production

```bash
# Production migration
npx prisma migrate deploy
```

---

## Data Migration Script

If you have existing transaction data, use this script to migrate it:

```typescript
// scripts/migrate-transactions.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateTransactions() {
  console.log('Starting transaction data migration...');
  
  // Get all existing transactions
  const transactions = await prisma.$queryRaw`
    SELECT * FROM transactions
  `;
  
  console.log(`Found ${transactions.length} transactions to migrate`);
  
  // Update each transaction
  for (const tx of transactions) {
    await prisma.$executeRaw`
      UPDATE transactions
      SET 
        user_id = ${tx.fromUserId},
        stripe_payment_intent_id = ${tx.paymentGatewayId}
      WHERE id = ${tx.id}
    `;
  }
  
  console.log('Migration complete!');
}

migrateTransactions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Run with:
```bash
npx ts-node scripts/migrate-transactions.ts
```

---

## Testing After Migration

### 1. Verify Schema

```bash
npx prisma db pull
npx prisma generate
```

### 2. Test Payment Service

```bash
npm run test:e2e -- payment
```

### 3. Manual Testing

Test these flows:
1. Create escrow deposit
2. Submit milestone
3. Approve milestone
4. Request refund
5. File dispute
6. Resolve dispute
7. Request withdrawal

---

## Rollback Plan

If migration fails:

### Option 1: Restore from Backup

```bash
psql -U postgres -d freelancer_platform < backup_YYYYMMDD_HHMMSS.sql
```

### Option 2: Revert Migration

```bash
npx prisma migrate resolve --rolled-back <migration_name>
```

---

## Alternative: Update Service to Match Schema

If you prefer to keep the current schema (fromUserId/toUserId pattern), update the service instead:

**Changes Required:**
1. Update all `userId` references to `fromUserId` and `toUserId`
2. Implement double-entry logic (debit/credit)
3. Update transaction creation calls throughout payment.service.ts

**Effort:** High (requires refactoring entire service)  
**Recommendation:** Not recommended - schema update is simpler

---

## Summary

**Recommended Approach:**
1. ✅ Update Prisma schema to match service implementation
2. ✅ Run migration with data preservation
3. ✅ Test all payment flows
4. ✅ Deploy to production

**Timeline:**
- Schema update: 15 minutes
- Migration creation: 5 minutes
- Testing: 30 minutes
- Production deployment: 10 minutes

**Total:** ~1 hour

---

**Status:** Ready for migration  
**Risk Level:** Low (with proper backup)  
**Recommendation:** Proceed with Option 1 (Update Schema)
