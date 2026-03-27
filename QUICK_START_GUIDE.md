# Quick Start Guide
**NivixPe Freelancer Platform**

## 🚀 Get Started in 5 Minutes

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 15+
- Redis 7+
- Git

---

## 📦 Installation

### 1. Clone & Install
```bash
# Clone the repository
git clone <repository-url>
cd nivixpe-platform

# Install root dependencies
npm install

# Install all workspace dependencies
npm run install:all
```

### 2. Database Setup
```bash
# Start PostgreSQL and Redis (using Docker)
docker-compose up -d postgres redis

# Or use your local installations
# PostgreSQL: localhost:5432
# Redis: localhost:6379
```

### 3. Environment Configuration

#### Backend (.env)
```bash
cd packages/backend
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/nivixpe"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_REFRESH_SECRET="your-refresh-secret"

# OAuth (optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-secret"
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-secret"

# Payments
RAZORPAY_KEY_ID="your-razorpay-key"
RAZORPAY_KEY_SECRET="your-razorpay-secret"
STRIPE_SECRET_KEY="your-stripe-secret"
STRIPE_WEBHOOK_SECRET="your-stripe-webhook-secret"
```

#### Web App (.env.local)
```bash
cd apps/web
cp .env.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

#### Admin Dashboard (.env.local)
```bash
cd apps/admin
cp .env.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

### 4. Database Migration
```bash
cd packages/backend

# Run migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Seed database (optional)
npm run seed
```

---

## 🏃 Running the Platform

### Option 1: Run All Services (Recommended)
```bash
# From root directory
npm run dev
```

This starts:
- Backend API (http://localhost:4000)
- Web App (http://localhost:3000)
- Admin Dashboard (http://localhost:3001)

### Option 2: Run Services Individually

#### Terminal 1 - Backend
```bash
cd packages/backend
npm run start:dev
```
API available at: http://localhost:4000

#### Terminal 2 - Web App
```bash
cd apps/web
npm run dev
```
Web app available at: http://localhost:3000

#### Terminal 3 - Admin Dashboard
```bash
cd apps/admin
npm run dev
```
Admin dashboard available at: http://localhost:3001

#### Terminal 4 - Mobile App (Optional)
```bash
cd apps/mobile
npm run start
```
Follow Expo instructions to run on device/simulator

---

## 🔑 First-Time Setup

### 1. Create Admin User
```bash
cd packages/backend
npm run create-admin
```

Or manually via Prisma Studio:
```bash
npx prisma studio
```

Create a user with `role: "ADMIN"`

### 2. Login to Admin Dashboard
1. Go to http://localhost:3001
2. Login with admin credentials
3. Verify the dashboard loads

### 3. Create Test Users
1. Go to http://localhost:3000
2. Register as a Client
3. Register as a Freelancer (use different email)

### 4. Test Core Features
- Create a project (as Client)
- Submit a bid (as Freelancer)
- Award contract
- Test chat
- Complete project
- Leave review

---

## 📚 API Documentation

### Swagger UI
http://localhost:4000/api/docs

### Key Endpoints

#### Authentication
```
POST   /auth/register          - Register new user
POST   /auth/login             - Login
POST   /auth/refresh           - Refresh token
GET    /auth/profile           - Get profile
PATCH  /auth/profile           - Update profile
```

#### Projects
```
GET    /projects               - List projects
POST   /projects               - Create project
GET    /projects/:id           - Get project
PATCH  /projects/:id           - Update project
DELETE /projects/:id           - Delete project
```

#### Bids
```
GET    /bids                   - List bids
POST   /bids                   - Submit bid
GET    /bids/:id               - Get bid
PATCH  /bids/:id               - Update bid
POST   /bids/:id/accept        - Accept bid
```

#### Payments
```
POST   /payments/create        - Create payment
POST   /payments/release       - Release payment
POST   /payments/refund        - Refund payment
GET    /payments/:id           - Get payment
```

#### Reviews
```
POST   /reviews                - Create review
GET    /reviews/user/:userId   - Get user reviews
GET    /reviews/user/:userId/rating - Get rating
```

#### Disputes
```
POST   /disputes               - Create dispute
GET    /disputes               - List disputes
GET    /disputes/:id           - Get dispute
```

#### Admin
```
GET    /admin/stats            - Platform stats
GET    /admin/users            - List users
POST   /admin/users/:id/verify - Verify user
POST   /admin/users/:id/ban    - Ban user
GET    /admin/disputes         - List disputes
POST   /admin/disputes/:id/resolve - Resolve dispute
GET    /admin/analytics        - Analytics data
```

---

## 🧪 Testing

### Run Tests
```bash
# Backend tests
cd packages/backend
npm test

# Web app tests
cd apps/web
npm test

# E2E tests
npm run test:e2e
```

### Test Coverage
```bash
npm run test:cov
```

---

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check connection
psql -h localhost -U postgres -d nivixpe

# Reset database
cd packages/backend
npx prisma migrate reset
```

### Redis Connection Issues
```bash
# Check Redis is running
docker ps | grep redis

# Test connection
redis-cli ping
# Should return: PONG
```

### Port Already in Use
```bash
# Find process using port
lsof -i :4000  # Backend
lsof -i :3000  # Web
lsof -i :3001  # Admin

# Kill process
kill -9 <PID>
```

### Prisma Issues
```bash
# Regenerate client
npx prisma generate

# Reset database
npx prisma migrate reset

# View database
npx prisma studio
```

### Module Not Found
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Next.js cache
rm -rf .next
npm run dev
```

---

## 📱 Mobile App Setup

### iOS
```bash
cd apps/mobile
npm run ios
```

### Android
```bash
cd apps/mobile
npm run android
```

### Expo Go
```bash
cd apps/mobile
npm run start
# Scan QR code with Expo Go app
```

---

## 🔧 Development Tools

### Prisma Studio
```bash
cd packages/backend
npx prisma studio
```
Opens at: http://localhost:5555

### Redis Commander
```bash
docker run -d -p 8081:8081 --name redis-commander \
  --env REDIS_HOSTS=local:host.docker.internal:6379 \
  rediscommander/redis-commander
```
Opens at: http://localhost:8081

### Database Migrations
```bash
# Create migration
npx prisma migrate dev --name migration_name

# Apply migrations
npx prisma migrate deploy

# Reset database
npx prisma migrate reset
```

---

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:4000/api/health
```

### Logs
```bash
# Backend logs
cd packages/backend
npm run start:dev

# Docker logs
docker-compose logs -f
```

---

## 🚢 Production Build

### Backend
```bash
cd packages/backend
npm run build
npm run start:prod
```

### Web App
```bash
cd apps/web
npm run build
npm run start
```

### Admin Dashboard
```bash
cd apps/admin
npm run build
npm run start
```

---

## 📖 Additional Resources

- [Architecture Documentation](./docs/architecture.md)
- [Database ERD](./docs/database-erd.md)
- [API Documentation](./docs/openapi.yaml)
- [Implementation Status](./IMPLEMENTATION_STATUS_REPORT.md)
- [Features Built](./FEATURES_BUILT.md)

---

## 🆘 Need Help?

1. Check the documentation in `/docs`
2. Review error logs
3. Check GitHub issues
4. Contact the development team

---

## ✅ Verification Checklist

After setup, verify:
- [ ] Backend API responds at http://localhost:4000
- [ ] Web app loads at http://localhost:3000
- [ ] Admin dashboard loads at http://localhost:3001
- [ ] Can register new user
- [ ] Can login
- [ ] Can create project
- [ ] Can submit bid
- [ ] Chat works (Socket.IO connected)
- [ ] Admin can login
- [ ] Admin dashboard shows stats

---

**Happy Coding! 🚀**
