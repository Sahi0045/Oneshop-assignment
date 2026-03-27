# Installation Fix Guide
**Issue:** Workspace dependency and NestJS CLI errors

## 🔧 Quick Fix

### Step 1: Install Backend Dependencies
```bash
cd packages/backend

# Remove old lock file
rm -f package-lock.json

# Install with legacy peer deps flag
npm install --legacy-peer-deps

# Verify NestJS CLI is available
npx nest --version
```

### Step 2: Install Admin Dependencies
```bash
cd ../../apps/admin

# Remove old lock file
rm -f package-lock.json

# Install dependencies
npm install --legacy-peer-deps
```

### Step 3: Install Web Dependencies
```bash
cd ../web

# Remove old lock file
rm -f package-lock.json

# Install dependencies
npm install --legacy-peer-deps
```

### Step 4: Setup Prisma
```bash
cd ../../packages/backend

# Validate schema
npx prisma validate

# Generate Prisma client
npx prisma generate
```

### Step 5: Test Compilation
```bash
# Test backend build
cd packages/backend
npx nest build

# Test admin build
cd ../../apps/admin
npm run build

# Test web build
cd ../web
npm run build
```

## ✅ Expected Output

After running these commands, you should see:
```
✅ Backend dependencies installed
✅ Admin dependencies installed
✅ Web dependencies installed
✅ Prisma client generated
✅ Backend compiles successfully
✅ Admin compiles successfully
✅ Web compiles successfully
```

## 🚀 Start Services

Once everything is installed and compiled:

```bash
# Terminal 1 - Backend
cd packages/backend
npm run start:dev

# Terminal 2 - Admin
cd apps/admin
npm run dev

# Terminal 3 - Web
cd apps/web
npm run dev
```

## 🐛 Troubleshooting

### Issue: "nest: command not found"
**Solution:** Use `npx nest` instead of `nest`

### Issue: "Unsupported URL Type workspace:"
**Solution:** Already fixed in package.json - removed workspace dependency

### Issue: Peer dependency conflicts
**Solution:** Use `--legacy-peer-deps` flag

### Issue: Module not found errors
**Solution:** 
```bash
# Clear all node_modules
rm -rf packages/backend/node_modules
rm -rf apps/admin/node_modules
rm -rf apps/web/node_modules

# Reinstall
cd packages/backend && npm install --legacy-peer-deps
cd ../../apps/admin && npm install --legacy-peer-deps
cd ../web && npm install --legacy-peer-deps
```

## 📋 Verification Checklist

- [ ] Backend node_modules exists
- [ ] Admin node_modules exists
- [ ] Web node_modules exists
- [ ] Prisma client generated (packages/backend/node_modules/.prisma)
- [ ] Backend compiles without errors
- [ ] Admin compiles without errors
- [ ] Web compiles without errors
- [ ] No TypeScript errors
- [ ] All imports resolve correctly

## 🎯 Next Steps

After successful installation:

1. **Setup Database**
   ```bash
   docker-compose up -d postgres redis
   cd packages/backend
   npx prisma migrate dev --name init
   ```

2. **Start Development**
   ```bash
   # Run all services as shown above
   ```

3. **Test Endpoints**
   ```bash
   curl http://localhost:4000/api/health
   curl http://localhost:3000
   curl http://localhost:3001
   ```

## 📝 Notes

- The `--legacy-peer-deps` flag is needed due to React 18 peer dependency conflicts
- NestJS CLI is now used via `npx` to avoid global installation
- All workspace dependencies have been removed from package.json
- Prisma client must be generated before building

---

**Status:** Installation issues fixed ✅  
**Ready for:** Development and testing
