# Frontend Dockerfile
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Build stage
FROM base AS builder
WORKDIR /app

# Build arguments for environment variables
ARG PUBLIC_VITE_API_BASE_URL
ARG PUBLIC_RECAPTCHA_SITE_KEY

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Remove unnecessary files but keep .env files for build
RUN find . -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true

# Set environment variables for build
ENV PUBLIC_VITE_API_BASE_URL=${PUBLIC_VITE_API_BASE_URL}
ENV PUBLIC_RECAPTCHA_SITE_KEY=${PUBLIC_RECAPTCHA_SITE_KEY}

# Build the application with environment variables
RUN npm run build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 sveltekit

# Copy the built application
COPY --from=builder /app/build ./build
COPY --from=builder /app/package*.json ./
COPY --from=deps /app/node_modules ./node_modules

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Change ownership of the app directory
RUN chown -R sveltekit:nodejs /app
USER sveltekit

# Expose port
EXPOSE 3002

ENV PORT=3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Start the server
CMD ["node", "build"]