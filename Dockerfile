# Use Node.js 18 LTS
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm ci --only=production
RUN cd client && npm ci

# Copy application code
COPY . .

# Build client - v12.9 WITH MESSENGER FIXES
RUN echo "======================================== v12.9 MESSENGER FIXES ========================================" && \
    echo "Building v12.9 (Group info, self-contact fix, better colors) at $(date)" && \
    echo "==========================================================================================================="
# CRITICAL: Clear cache before build
RUN cd client && rm -rf node_modules/.cache build .cache
# CRITICAL: Set API URL for production build
ARG REACT_APP_API_URL=/api
ARG REACT_APP_BUILD_ID
ARG REACT_APP_BUILD_DATE
RUN BUILD_ID=${REACT_APP_BUILD_ID:-$(date +%s)} && \
    BUILD_DATE=${REACT_APP_BUILD_DATE:-$(date -u +"%Y-%m-%dT%H:%M:%SZ")} && \
    cd client && \
    CI=false \
    GENERATE_SOURCEMAP=false \
    DISABLE_ESLINT_PLUGIN=true \
    REACT_APP_API_URL=${REACT_APP_API_URL} \
    REACT_APP_BUILD_ID=$BUILD_ID \
    REACT_APP_BUILD_DATE=$BUILD_DATE \
    npm run build
RUN echo "=============================================================================================" && \
    echo "✅ Build v12.9 MESSENGER FIXES complete!" && \
    ls -lh client/build/static/js/main.*.js && \
    echo "=============================================================================================" && \
    cat client/build/asset-manifest.json && \
    echo "============================================================================================="

# Expose port
EXPOSE 5000

# Start server (server-minimal.js has all routes including /api/messages)
CMD ["node", "server-minimal.js"]
