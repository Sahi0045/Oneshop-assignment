# Auth Service - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Install Dependencies
```bash
cd packages/backend
npm install
```

### 2. Set Up Database
```bash
# Copy environment file
cp .env.example .env

# Edit .env with your database URL
# DATABASE_URL=postgresql://user:password@localhost:5432/freelancer_db

# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev
```

### 3. Configure Minimum Required Variables
```env
# In your .env file, set these minimum values:
DATABASE_URL=postgresql://user:password@localhost:5432/freelancer_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key-min-32-chars-long
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars
FRONTEND_URL=http://localhost:3000
```

### 4. Start the Server
```bash
npm run dev
```

The server will start at `http://localhost:4000`

### 5. Test the API

**Register a User:**
```bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe",
    "role": "FREELANCER"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
```

**Get Profile Completeness:**
```bash
# Use the accessToken from login response
curl -X GET http://localhost:4000/api/v1/auth/profile/completeness \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 📖 View API Documentation

Open Swagger UI in your browser:
```
http://localhost:4000/api/docs
```

## 🔧 Optional: Configure OAuth & KYC

### For Google OAuth:
1. Get credentials from [Google Cloud Console](https://console.cloud.google.com/)
2. Add to `.env`:
```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:4000/api/v1/auth/google/callback
```

### For GitHub OAuth:
1. Create OAuth App in [GitHub Settings](https://github.com/settings/developers)
2. Add to `.env`:
```env
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
GITHUB_CALLBACK_URL=http://localhost:4000/api/v1/auth/github/callback
```

### For KYC File Uploads:
1. Set up AWS S3 bucket
2. Add to `.env`:
```env
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1
```

### For Email Sending:
1. Get API key from [SendGrid](https://sendgrid.com/)
2. Add to `.env`:
```env
SENDGRID_API_KEY=your-api-key
SENDGRID_FROM_EMAIL=noreply@yourplatform.com
SENDGRID_FROM_NAME=Your Platform
```

## ✅ What's Included

- ✅ Email/Password Authentication
- ✅ Google OAuth2
- ✅ GitHub OAuth2
- ✅ JWT + Refresh Tokens
- ✅ Email Verification
- ✅ Password Reset
- ✅ KYC Document Upload
- ✅ Face Matching (Placeholder)
- ✅ Profile Completeness Score
- ✅ Profile Management
- ✅ Avatar Upload

## 📚 Next Steps

1. Read [AUTH_SERVICE_SETUP.md](./AUTH_SERVICE_SETUP.md) for detailed setup
2. Read [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for database migration
3. Read [AUTH_IMPLEMENTATION_SUMMARY.md](./AUTH_IMPLEMENTATION_SUMMARY.md) for implementation details

## 🆘 Troubleshooting

**Prisma Client errors?**
```bash
npx prisma generate
```

**Database connection errors?**
- Check your DATABASE_URL in .env
- Ensure PostgreSQL is running
- Verify database exists

**Redis connection errors?**
- Check your REDIS_URL in .env
- Ensure Redis is running
- Default: `redis://localhost:6379`

**TypeScript errors?**
```bash
npm run build
```

## 🎯 Production Deployment

See [AUTH_SERVICE_SETUP.md](./AUTH_SERVICE_SETUP.md) for production checklist and deployment guide.
