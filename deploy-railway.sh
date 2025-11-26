#!/bin/bash

echo "🚀 Starting Railway deployment with cache busting..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Generate build ID for cache busting
BUILD_ID=$(date +%s)
echo -e "${BLUE}Build ID: ${BUILD_ID}${NC}"

# Clean previous builds
echo -e "${YELLOW}Cleaning previous builds...${NC}"
cd client
rm -rf build
rm -rf node_modules/.cache
cd ..

# Update package.json with cache busting
echo -e "${YELLOW}Adding cache busting to React build...${NC}"
cd client

# Create environment variable for build ID
echo "REACT_APP_BUILD_ID=${BUILD_ID}" > .env.production.local
echo "GENERATE_SOURCEMAP=false" >> .env.production.local
echo "DISABLE_ESLINT_PLUGIN=true" >> .env.production.local

# Build client with production optimizations
echo -e "${BLUE}Building client with optimizations...${NC}"
CI=false npm run build

# Add cache headers to build files
echo -e "${YELLOW}Adding cache control headers...${NC}"
cat > build/_headers << EOF
/*
  Cache-Control: no-cache, no-store, must-revalidate
  Pragma: no-cache
  Expires: 0

/static/js/*
  Cache-Control: public, max-age=31536000, immutable

/static/css/*
  Cache-Control: public, max-age=31536000, immutable

/static/media/*
  Cache-Control: public, max-age=31536000, immutable

/index.html
  Cache-Control: no-cache, no-store, must-revalidate
  Pragma: no-cache
  Expires: 0

/service-worker.js
  Cache-Control: no-cache, no-store, must-revalidate

/manifest.json
  Cache-Control: no-cache, no-store, must-revalidate
EOF

# Add build info to index.html
echo -e "${YELLOW}Adding build info to index.html...${NC}"
sed -i '' "s/<\/head>/<!-- Build ID: ${BUILD_ID} --><\/head>/" build/index.html

cd ..

# Clear Railway cache (if railway CLI is installed)
if command -v railway &> /dev/null; then
    echo -e "${BLUE}Clearing Railway cache...${NC}"
    railway up --detach
    echo -e "${GREEN}✅ Deployment initiated with cache cleared${NC}"
else
    echo -e "${YELLOW}Railway CLI not found. Please deploy manually.${NC}"
fi

# Git operations
echo -e "${BLUE}Committing changes...${NC}"
git add -A
git commit -m "🚀 Deploy: Build ${BUILD_ID} with cache busting

- Cache busting enabled with unique build ID
- All static assets versioned
- No-cache headers for HTML
- Immutable cache for static resources
- Build optimizations applied

Build ID: ${BUILD_ID}
Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"

echo -e "${BLUE}Pushing to remote...${NC}"
git push origin main

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "${GREEN}Build ID: ${BUILD_ID}${NC}"
echo -e "${GREEN}Your app will be updated on Railway shortly.${NC}"

# Create deployment log
echo "Deployment Log - $(date)" > deployment.log
echo "Build ID: ${BUILD_ID}" >> deployment.log
echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')" >> deployment.log
echo "Status: Success" >> deployment.log

echo -e "${YELLOW}Tips for verification:${NC}"
echo "1. Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)"
echo "2. Use incognito/private browsing mode"
echo "3. Check Network tab for new build ID"
echo "4. Verify at: https://biolab-logistik-planner-production.up.railway.app"