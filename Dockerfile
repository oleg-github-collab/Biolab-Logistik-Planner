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

# Build client - v3.4 STABLE
RUN echo "======================================== v3.4 STABLE ========================================" && \
    echo "Building v3.4-STABLE (Calendar Fix + Premium UI) at $(date)" && \
    echo "=============================================================================================="
RUN cd client && CI=false GENERATE_SOURCEMAP=false DISABLE_ESLINT_PLUGIN=true npm run build
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
