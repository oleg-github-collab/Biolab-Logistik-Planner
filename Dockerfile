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

# Build client
RUN echo "Building client at $(date)"
RUN cd client && CI=false GENERATE_SOURCEMAP=false DISABLE_ESLINT_PLUGIN=true npm run build
RUN echo "Build complete. Files:" && ls -lh client/build/static/js/main.*.js
RUN cat client/build/asset-manifest.json

# Expose port
EXPOSE 5000

# Start server
CMD ["node", "server-minimal.js"]
