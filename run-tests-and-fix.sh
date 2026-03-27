#!/bin/bash

# NivixPe Platform - Test & Fix Script
# This script runs all tests and fixes issues

set -e  # Exit on error

echo "🚀 NivixPe Platform - Test & Fix Script"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo "ℹ️  $1"
}

# Step 1: Check Prerequisites
echo "Step 1: Checking Prerequisites..."
echo "-----------------------------------"

if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
fi
print_success "Node.js installed: $(node --version)"

if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi
print_success "npm installed: $(npm --version)"

echo ""

# Step 2: Install Dependencies
echo "Step 2: Installing Dependencies..."
echo "-----------------------------------"

print_info "Installing backend dependencies..."
cd packages/backend

# Remove package-lock.json if it exists to avoid conflicts
if [ -f "package-lock.json" ]; then
    print_info "Removing old package-lock.json..."
    rm package-lock.json
fi

npm install --legacy-peer-deps || { print_error "Backend npm install failed"; exit 1; }
print_success "Backend dependencies installed"

cd ../..

print_info "Installing admin dependencies..."
cd apps/admin

# Remove package-lock.json if it exists
if [ -f "package-lock.json" ]; then
    print_info "Removing old package-lock.json..."
    rm package-lock.json
fi

npm install --legacy-peer-deps || { print_error "Admin npm install failed"; exit 1; }
print_success "Admin dependencies installed"

cd ../..

print_info "Installing web dependencies..."
cd apps/web

# Remove package-lock.json if it exists
if [ -f "package-lock.json" ]; then
    print_info "Removing old package-lock.json..."
    rm package-lock.json
fi

npm install --legacy-peer-deps || { print_error "Web npm install failed"; exit 1; }
print_success "Web dependencies installed"

cd ../..

echo ""

# Step 3: Prisma Setup
echo "Step 3: Setting up Prisma..."
echo "-----------------------------------"

cd packages/backend

print_info "Validating Prisma schema..."
npx prisma validate || { print_error "Prisma schema validation failed"; exit 1; }
print_success "Prisma schema is valid"

print_info "Generating Prisma client..."
npx prisma generate || { print_error "Prisma client generation failed"; exit 1; }
print_success "Prisma client generated"

print_warning "Skipping database migration (requires running database)"
print_info "To run migrations manually: cd packages/backend && npx prisma migrate dev"

cd ../..

echo ""

# Step 4: TypeScript Compilation
echo "Step 4: Testing TypeScript Compilation..."
echo "-----------------------------------"

print_info "Compiling backend..."
cd packages/backend
npm run build || { print_error "Backend compilation failed"; exit 1; }
print_success "Backend compiled successfully"

cd ../..

print_info "Compiling admin dashboard..."
cd apps/admin
npm run build || { print_error "Admin compilation failed"; exit 1; }
print_success "Admin dashboard compiled successfully"

cd ../..

print_info "Compiling web app..."
cd apps/web
npm run build || { print_error "Web app compilation failed"; exit 1; }
print_success "Web app compiled successfully"

cd ../..

echo ""

# Step 5: Linting
echo "Step 5: Running Linters..."
echo "-----------------------------------"

print_info "Linting backend..."
cd packages/backend
npm run lint || print_warning "Backend linting found issues (non-fatal)"

cd ../..

echo ""

# Step 6: Check for Circular Dependencies
echo "Step 6: Checking for Circular Dependencies..."
echo "-----------------------------------"

cd packages/backend

if command -v madge &> /dev/null; then
    print_info "Checking circular dependencies..."
    npx madge --circular --extensions ts src/ || print_warning "Circular dependencies found"
else
    print_warning "madge not installed, skipping circular dependency check"
    print_info "Install with: npm install -g madge"
fi

cd ../..

echo ""

# Step 7: Summary
echo "========================================="
echo "📊 Test Summary"
echo "========================================="
echo ""
print_success "All compilation tests passed!"
echo ""
echo "✅ Backend: Compiled successfully"
echo "✅ Admin Dashboard: Compiled successfully"
echo "✅ Web App: Compiled successfully"
echo "✅ Prisma Schema: Valid"
echo "✅ Prisma Client: Generated"
echo ""
echo "⚠️  Note: Database migrations not run (requires running database)"
echo "⚠️  Note: Unit tests not run (tests need to be written)"
echo ""
echo "========================================="
echo "🎯 Next Steps"
echo "========================================="
echo ""
echo "1. Start PostgreSQL and Redis:"
echo "   docker-compose up -d postgres redis"
echo ""
echo "2. Run database migrations:"
echo "   cd packages/backend"
echo "   npx prisma migrate dev --name init"
echo ""
echo "3. Start the services:"
echo "   Terminal 1: cd packages/backend && npm run dev"
echo "   Terminal 2: cd apps/admin && npm run dev"
echo "   Terminal 3: cd apps/web && npm run dev"
echo ""
echo "4. Access the applications:"
echo "   Backend API: http://localhost:4000"
echo "   Admin Dashboard: http://localhost:3001"
echo "   Web App: http://localhost:3000"
echo ""
print_success "Test & Fix Script Completed Successfully! 🎉"
