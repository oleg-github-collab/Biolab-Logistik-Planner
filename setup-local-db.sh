#!/bin/bash
# Local PostgreSQL Setup Script for Biolab Logistik Planner

set -e

echo "=================================================="
echo "Biolab Logistik Planner - Local Database Setup"
echo "=================================================="
echo ""

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo "❌ Homebrew not found. Please install from https://brew.sh"
    exit 1
fi

echo "✅ Homebrew found"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "📦 Installing PostgreSQL..."
    brew install postgresql@15
    brew services start postgresql@15

    # Wait for PostgreSQL to start
    echo "⏳ Waiting for PostgreSQL to start..."
    sleep 5
else
    echo "✅ PostgreSQL already installed"

    # Make sure it's running
    if ! brew services list | grep postgresql | grep started &> /dev/null; then
        echo "🚀 Starting PostgreSQL..."
        brew services start postgresql@15
        sleep 3
    fi
fi

# Create database
echo "📊 Creating database 'biolab_logistik'..."
if psql -lqt | cut -d \| -f 1 | grep -qw biolab_logistik; then
    echo "⚠️  Database already exists"
else
    createdb biolab_logistik
    echo "✅ Database created"
fi

# Update .env file
echo "📝 Updating .env file..."
if [ -f .env ]; then
    # Update DATABASE_URL in .env
    if grep -q "DATABASE_URL=" .env; then
        # Replace existing DATABASE_URL
        sed -i '' 's|DATABASE_URL=.*|DATABASE_URL=postgresql://localhost:5432/biolab_logistik|' .env
    else
        # Add DATABASE_URL
        echo "" >> .env
        echo "# PostgreSQL Database" >> .env
        echo "DATABASE_URL=postgresql://localhost:5432/biolab_logistik" >> .env
    fi
    echo "✅ .env updated"
else
    echo "❌ .env file not found"
    exit 1
fi

# Run migrations
echo "🔄 Running PostgreSQL migrations..."
npm run migrate:pg

echo ""
echo "=================================================="
echo "✅ Setup Complete!"
echo "=================================================="
echo ""
echo "You can now start the server with:"
echo "  npm start"
echo ""
echo "For first-time setup, visit:"
echo "  http://localhost:5000/first-setup"
echo ""
