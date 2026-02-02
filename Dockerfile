# Use Node.js 18 LTS - v13.10.1 OBSERVER ROLE FIX
FROM node:18-alpine

# NUCLEAR CACHE BUST - v13.10.1 - OBSERVER WITHOUT EMPLOYMENT TYPE
ARG BUILDTIME_CACHEBUST=1769751100
RUN echo "👁️ v13.10.1 OBSERVER ROLE FIX - CACHE BUSTER: $BUILDTIME_CACHEBUST 👁️"

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies - NO CACHE
RUN npm ci --only=production --no-cache
RUN cd client && npm ci --no-cache

# Copy application code
COPY . .

# Build client - v13.10.1 OBSERVER ROLE FIX
RUN echo "======================================== v13.10.1 OBSERVER ROLE FIX ========================================" && \
    echo "🔥 CACHE BUSTER: $(date +%s)" && \
    echo "Building v13.10.1 (Observer role without employment_type) at $(date)" && \
    echo "==========================================================================================================="
# CRITICAL: Clear ALL caches before build
RUN cd client && rm -rf node_modules/.cache build .cache dist tmp
# CRITICAL: Set API URL for production build
ARG REACT_APP_API_URL=/api
ARG REACT_APP_BUILD_ID
ARG REACT_APP_BUILD_DATE
# FORCE NEW BUILD - NO CACHE
RUN echo "🔥🔥🔥 FORCING FRESH BUILD - NO CACHE ALLOWED 🔥🔥🔥" && \
    BUILD_ID=$(date +%s) && \
    BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ") && \
    cd client && \
    CI=false \
    GENERATE_SOURCEMAP=false \
    DISABLE_ESLINT_PLUGIN=true \
    REACT_APP_API_URL=${REACT_APP_API_URL:-/api} \
    REACT_APP_BUILD_ID=$BUILD_ID \
    REACT_APP_BUILD_DATE=$BUILD_DATE \
    npm run build && \
    echo "🎉 Build completed at $(date)" && \
    echo "📦 Main bundle:" && \
    ls -lh build/static/js/main.*.js
RUN echo "=============================================================================================" && \
    echo "✅ Build v13.10.1 OBSERVER ROLE FIX complete!" && \
    ls -lh client/build/static/js/main.*.js && \
    echo "=============================================================================================" && \
    cat client/build/asset-manifest.json && \
    echo "============================================================================================="

# Expose port (Railway will override this with PORT env var)
EXPOSE 5000

# VERIFY BUILD BEFORE START
RUN echo "📋 VERIFICATION - Files that will be served:" && \
    ls -la client/build/static/js/ && \
    echo "📄 Index.html references:" && \
    grep -o 'main\.[a-z0-9]*\.js' client/build/index.html

# Start server (server-minimal.js has all routes including /api/messages)
CMD ["node", "server-minimal.js"]
