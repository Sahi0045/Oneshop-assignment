#!/bin/bash

# Payment Module Setup Script
# This script installs dependencies and guides through configuration

set -e

echo "================================================"
echo "Payment & Escrow Module Setup"
echo "================================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from packages/backend directory."
    exit 1
fi

echo "✅ Running from correct directory"
echo ""

# Step 1: Install dependencies
echo "📦 Step 1: Installing dependencies..."
echo ""
npm install stripe razorpay

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi
echo ""

# Step 2: Check .env file
echo "🔧 Step 2: Checking environment configuration..."
echo ""

if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "✅ Created .env file"
else
    echo "✅ .env file exists"
fi
echo ""

# Step 3: Check for required environment variables
echo "🔍 Step 3: Checking required environment variables..."
echo ""

MISSING_VARS=()

# Check Stripe variables
if ! grep -q "STRIPE_SECRET_KEY=sk_" .env; then
    MISSING_VARS+=("STRIPE_SECRET_KEY")
fi

if ! grep -q "STRIPE_WEBHOOK_SECRET=whsec_" .env; then
    MISSING_VARS+=("STRIPE_WEBHOOK_SECRET")
fi

# Check Razorpay variables
if ! grep -q "RAZORPAY_KEY_ID=rzp_" .env; then
    MISSING_VARS+=("RAZORPAY_KEY_ID")
fi

if ! grep -q "RAZORPAY_KEY_SECRET=" .env; then
    MISSING_VARS+=("RAZORPAY_KEY_SECRET")
fi

if [ ${#MISSING_VARS[@]} -eq 0 ]; then
    echo "✅ All required environment variables are configured"
else
    echo "⚠️  Missing or incomplete environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "Please update your .env file with the following:"
    echo ""
    echo "# Stripe (get from https://dashboard.stripe.com/test/apikeys)"
    echo "STRIPE_SECRET_KEY=sk_test_xxx"
    echo "STRIPE_WEBHOOK_SECRET=whsec_xxx"
    echo "PLATFORM_FEE_PERCENTAGE=10"
    echo ""
    echo "# Razorpay (get from https://dashboard.razorpay.com/app/keys)"
    echo "RAZORPAY_KEY_ID=rzp_test_xxx"
    echo "RAZORPAY_KEY_SECRET=xxx"
    echo "RAZORPAY_WEBHOOK_SECRET=xxx"
    echo "RAZORPAY_ACCOUNT_NUMBER=xxx"
    echo ""
fi
echo ""

# Step 4: Check Prisma schema
echo "🗄️  Step 4: Checking database schema..."
echo ""

if grep -q "fromUserId" prisma/schema.prisma; then
    echo "⚠️  WARNING: Prisma schema needs migration!"
    echo ""
    echo "The Transaction model in your schema uses 'fromUserId' and 'toUserId',"
    echo "but the payment service expects 'userId' and specific gateway ID fields."
    echo ""
    echo "📖 Please read: PAYMENT_SCHEMA_MIGRATION.md for migration instructions"
    echo ""
    echo "Quick migration steps:"
    echo "1. Backup your database"
    echo "2. Update prisma/schema.prisma (see PAYMENT_SCHEMA_MIGRATION.md)"
    echo "3. Run: npx prisma migrate dev --name update_transaction_model"
    echo "4. Run: npx prisma generate"
    echo ""
else
    echo "✅ Schema appears to be compatible"
fi
echo ""

# Step 5: Generate Prisma Client
echo "🔨 Step 5: Generating Prisma Client..."
echo ""
npx prisma generate

if [ $? -eq 0 ]; then
    echo "✅ Prisma Client generated successfully"
else
    echo "❌ Failed to generate Prisma Client"
    exit 1
fi
echo ""

# Summary
echo "================================================"
echo "Setup Summary"
echo "================================================"
echo ""
echo "✅ Dependencies installed (stripe, razorpay)"
echo "✅ Prisma Client generated"
echo ""

if [ ${#MISSING_VARS[@]} -eq 0 ]; then
    echo "✅ Environment variables configured"
else
    echo "⚠️  Environment variables need configuration"
fi
echo ""

if grep -q "fromUserId" prisma/schema.prisma; then
    echo "⚠️  Database schema needs migration"
    echo ""
    echo "Next steps:"
    echo "1. Configure missing environment variables in .env"
    echo "2. Read PAYMENT_SCHEMA_MIGRATION.md"
    echo "3. Run database migration"
    echo "4. Test payment flows"
else
    echo "✅ Database schema compatible"
    echo ""
    echo "Next steps:"
    if [ ${#MISSING_VARS[@]} -ne 0 ]; then
        echo "1. Configure missing environment variables in .env"
        echo "2. Test payment flows"
    else
        echo "1. Test payment flows"
        echo "2. Deploy to production"
    fi
fi
echo ""

echo "📚 Documentation:"
echo "   - PAYMENT_MODULE_SUMMARY.md - Executive summary"
echo "   - PAYMENT_ESCROW_COMPLETE.md - Complete implementation details"
echo "   - PAYMENT_SCHEMA_MIGRATION.md - Database migration guide"
echo ""

echo "🧪 Testing:"
echo "   - Stripe test mode: Use card 4242 4242 4242 4242"
echo "   - Razorpay test mode: Use card 4111 1111 1111 1111"
echo ""

echo "================================================"
echo "Setup complete! 🎉"
echo "================================================"
