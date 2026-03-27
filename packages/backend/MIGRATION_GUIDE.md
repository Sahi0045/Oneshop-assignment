# Database Migration Guide

## Schema Changes Summary

The Prisma schema has been updated to support the complete Auth Service implementation. Here are the key changes:

### User Model Changes

**Removed Fields:**
- `fullName` → Split into `firstName` and `lastName`
- `avatarUrl` → Renamed to `avatar`
- `isVerified` → Renamed to `isEmailVerified`

**Added Fields:**
- `firstName` (String) - User's first name
- `lastName` (String) - User's last name
- `avatar` (String?) - Profile picture URL
- `bio` (String?) - User biography
- `hourlyRate` (Decimal?) - Hourly rate for freelancers
- `isEmailVerified` (Boolean) - Email verification status
- `isKycVerified` (Boolean) - KYC verification status
- `profileCompleteness` (Int) - Profile completion score (0-100)

**Modified Fields:**
- `passwordHash` - Now nullable (for OAuth-only users)

### KYCVerification Model Changes

**Added Fields:**
- `faceImageUrl` (String?) - URL of uploaded face image
- `faceMatchScore` (Decimal?) - Face matching confidence score
- `createdAt` (DateTime) - Record creation timestamp
- `updatedAt` (DateTime) - Record update timestamp

### New Models

**UserSkill (Junction Table):**
- `userId` (String) - Foreign key to User
- `skillId` (String) - Foreign key to Skill
- Composite primary key: [userId, skillId]

## Migration Steps

### Step 1: Backup Your Database

```bash
# PostgreSQL backup
pg_dump -U your_user -d freelancer_db > backup_$(date +%Y%m%d).sql
```

### Step 2: Generate Migration

```bash
cd packages/backend
npx prisma migrate dev --name auth_service_complete
```

This will:
1. Analyze schema changes
2. Generate SQL migration file
3. Apply migration to database
4. Regenerate Prisma Client

### Step 3: Data Migration (if you have existing data)

If you have existing users, you'll need to migrate the data:

```sql
-- Split fullName into firstName and lastName
UPDATE users
SET 
  first_name = SPLIT_PART(full_name, ' ', 1),
  last_name = CASE 
    WHEN ARRAY_LENGTH(STRING_TO_ARRAY(full_name, ' '), 1) > 1 
    THEN SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)
    ELSE ''
  END;

-- Rename avatarUrl to avatar
UPDATE users
SET avatar = avatar_url
WHERE avatar_url IS NOT NULL;

-- Rename isVerified to isEmailVerified
UPDATE users
SET is_email_verified = is_verified;

-- Initialize new fields
UPDATE users
SET 
  is_kyc_verified = false,
  profile_completeness = 0
WHERE is_kyc_verified IS NULL;
```

### Step 4: Recalculate Profile Completeness

After migration, recalculate profile completeness for all users:

```typescript
// Run this script or create an endpoint
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function recalculateAllProfiles() {
  const users = await prisma.user.findMany({
    include: { skills: true },
  });

  for (const user of users) {
    let score = 0;
    if (user.isEmailVerified) score += 15;
    if (user.isKycVerified) score += 20;
    if (user.bio && user.bio.length >= 50) score += 10;
    if (user.avatar) score += 10;
    if (user.hourlyRate && user.hourlyRate.toNumber() > 0) score += 10;
    if (user.skills.length >= 3) score += 15;
    if (user.firstName && user.firstName.length >= 2) score += 10;
    if (user.lastName && user.lastName.length >= 2) score += 10;

    await prisma.user.update({
      where: { id: user.id },
      data: { profileCompleteness: score },
    });
  }

  console.log(`Updated ${users.length} user profiles`);
}

recalculateAllProfiles()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### Step 5: Verify Migration

```bash
# Check database schema
npx prisma db pull

# Validate Prisma schema
npx prisma validate

# Generate client
npx prisma generate
```

## Rollback Plan

If you need to rollback:

```bash
# Restore from backup
psql -U your_user -d freelancer_db < backup_YYYYMMDD.sql

# Or use Prisma migrate
npx prisma migrate resolve --rolled-back MIGRATION_NAME
```

## Testing After Migration

1. **Test User Registration:**
   - Verify firstName and lastName are saved correctly
   - Check profileCompleteness is calculated

2. **Test OAuth Login:**
   - Ensure OAuth users can be created without password
   - Verify avatar is saved from OAuth provider

3. **Test KYC Upload:**
   - Upload test document
   - Upload test face image
   - Verify faceMatchScore is calculated

4. **Test Profile Update:**
   - Update profile fields
   - Verify profileCompleteness recalculates

## Common Issues

### Issue: Prisma Client Out of Sync

**Solution:**
```bash
npx prisma generate
```

### Issue: Migration Fails Due to Existing Data

**Solution:**
1. Create a custom migration with data transformation
2. Use `prisma migrate dev --create-only` to generate SQL
3. Edit the SQL file to include data migration
4. Apply with `prisma migrate deploy`

### Issue: TypeScript Errors After Migration

**Solution:**
```bash
# Regenerate Prisma Client
npx prisma generate

# Restart TypeScript server in your IDE
# VS Code: Cmd+Shift+P > "TypeScript: Restart TS Server"
```

## Production Migration

For production environments:

```bash
# 1. Create migration without applying
npx prisma migrate dev --create-only --name auth_service_complete

# 2. Review generated SQL in prisma/migrations/

# 3. Test on staging environment

# 4. Apply to production
npx prisma migrate deploy
```

## Post-Migration Checklist

- [ ] All existing users have firstName and lastName
- [ ] Avatar URLs are migrated correctly
- [ ] Email verification status is preserved
- [ ] Profile completeness is calculated for all users
- [ ] KYC table is accessible
- [ ] UserSkill junction table is created
- [ ] All tests pass
- [ ] API endpoints work correctly
- [ ] No TypeScript errors
- [ ] Prisma Client is regenerated
