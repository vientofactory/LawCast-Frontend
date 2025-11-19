# Frontend Dockerfile
FROM node:24-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Build stage
FROM base AS builder
WORKDIR /app

# Copy package files for full installation
COPY package*.json ./

# Install all dependencies including devDependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application (SvelteKit will automatically read .env file)
RUN npm run build

# Production image
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