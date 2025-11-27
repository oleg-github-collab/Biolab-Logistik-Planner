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

# Build client - v3.5 PRODUCTION FIX
RUN echo "======================================== v3.5 PRODUCTION ========================================" && \
    echo "Building v3.5-PRODUCTION (Stories + Bot + API URL Fix) at $(date)" && \
    echo "================================================================================================="
# CRITICAL: Set API URL for production build
ARG REACT_APP_API_URL=/api
RUN cd client && \
    CI=false \
    GENERATE_SOURCEMAP=false \
    DISABLE_ESLINT_PLUGIN=true \
    REACT_APP_API_URL=${REACT_APP_API_URL} \
    npm run build
RUN echo "=============================================================================================" && \
    echo "✅ Build v3.4-STABLE complete!" && \
    ls -lh client/build/static/js/main.*.js && \
    echo "=============================================================================================" && \
    cat client/build/asset-manifest.json && \
    echo "============================================================================================="

# Expose port
EXPOSE 5000

# Start server
CMD ["node", "server-minimal.js"]
