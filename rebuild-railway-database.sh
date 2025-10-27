#!/bin/bash

# Script to rebuild Railway PostgreSQL database from scratch
# This will drop all tables and recreate them with the latest schema

set -e  # Exit on any error

echo "🔥 RAILWAY DATABASE REBUILD SCRIPT"
echo "===================================="
echo ""
echo "⚠️  WARNING: This will DELETE ALL DATA in your Railway database!"
echo ""
read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Operation cancelled"
    exit 1
fi

echo ""
echo "📋 Step 1: Checking Railway CLI..."
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Please install it first:"
    echo "   npm install -g @railway/cli"
    exit 1
fi

echo "✅ Railway CLI found"
echo ""

echo "📋 Step 2: Linking to Railway project..."
railway status || {
    echo "❌ Not linked to a Railway project. Run 'railway link' first"
    exit 1
}

echo "✅ Railway project linked"
echo ""

echo "📋 Step 3: Getting DATABASE_URL..."
# New Railway CLI syntax
DATABASE_URL=$(railway variables --json | grep DATABASE_URL | cut -d'"' -f4)

if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not found in Railway variables"
    exit 1
fi

echo "✅ DATABASE_URL found"
echo ""

echo "🗑️  Step 4: Dropping all tables..."
# First, run the drop script
PGPASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\([^@]*\)@.*/\1/p') \
psql "$DATABASE_URL" -f server/migrations/000_drop_all_tables.sql

echo "✅ All tables dropped"
echo ""

echo "🏗️  Step 5: Creating fresh schema..."
# Run the complete schema migration
PGPASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\([^@]*\)@.*/\1/p') \
psql "$DATABASE_URL" -f server/migrations/001_complete_schema.sql

echo "✅ Schema created successfully"
echo ""

echo "🔍 Step 6: Verifying tables..."
PGPASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\([^@]*\)@.*/\1/p') \
psql "$DATABASE_URL" -c "\dt"

echo ""
echo "✅ DATABASE REBUILD COMPLETE!"
echo ""
echo "📝 Next steps:"
echo "   1. Create your first superadmin user via the FirstSetup page"
echo "   2. Test the application thoroughly"
echo ""
