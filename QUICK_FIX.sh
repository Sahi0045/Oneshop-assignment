#!/bin/bash

# Quick Fix Script - Install all dependencies
echo "🔧 Quick Fix - Installing Dependencies"
echo "======================================"
echo ""

# Backend
echo "📦 Installing backend dependencies..."
cd packages/backend
rm -f package-lock.json
npm install --legacy-peer-deps
echo "✅ Backend done"
echo ""

# Admin
echo "📦 Installing admin dependencies..."
cd ../../apps/admin
rm -f package-lock.json
npm install --legacy-peer-deps
echo "✅ Admin done"
echo ""

# Web
echo "📦 Installing web dependencies..."
cd ../web
rm -f package-lock.json
npm install --legacy-peer-deps
echo "✅ Web done"
echo ""

# Prisma
echo "🔨 Generating Prisma client..."
cd ../../packages/backend
npx prisma generate
echo "✅ Prisma client generated"
echo ""

echo "======================================"
echo "✅ All dependencies installed!"
echo ""
echo "Next steps:"
echo "1. Start database: docker-compose up -d postgres redis"
echo "2. Run migrations: cd packages/backend && npx prisma migrate dev"
echo "3. Start backend: cd packages/backend && npm run start:dev"
echo "4. Start admin: cd apps/admin && npm run dev"
echo "5. Start web: cd apps/web && npm run dev"
