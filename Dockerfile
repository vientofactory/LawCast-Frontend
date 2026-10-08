# Frontend Dockerfile

# hardened_malloc build stage - security-focused memory allocator (GrapheneOS)
# NOTE: Requires host vm.max_map_count >= 1048576:
#   sysctl -w vm.max_map_count=1048576  (host)  or  docker-compose sysctls
FROM node:24-alpine AS hardened-malloc
RUN apk add --no-cache git build-base linux-headers
RUN git clone --depth 1 https://github.com/GrapheneOS/hardened_malloc.git /hardened_malloc
WORKDIR /hardened_malloc
# CONFIG_NATIVE=false  - portable build for Alpine/musl (no host-specific CET/AVX instructions)
# CONFIG_CXX_ALLOCATOR=false - skips libstdc++ linkage so the .so has no extra runtime deps
RUN make CONFIG_NATIVE=false CONFIG_CXX_ALLOCATOR=false

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
# SVELTE_ADAPTER=node selects adapter-node so the output lands in /app/build,
# which the runner stage below copies and `node build` executes. Without it
# the build would emit .svelte-kit/cloudflare and the COPY of /app/build would
# fail (or worse, ship a stale build/ artifact).
ENV SVELTE_ADAPTER=node
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

# Copy hardened_malloc before LD_PRELOAD is active so the library exists
# for all subsequent RUN instructions in this stage
COPY --from=hardened-malloc /hardened_malloc/out/libhardened_malloc.so /usr/local/lib/libhardened_malloc.so

ENV NODE_ENV=production
ENV LD_PRELOAD=/usr/local/lib/libhardened_malloc.so
ENV TZ=Asia/Seoul

# Set container system timezone to KST.
RUN apk add --no-cache tzdata && \
  cp /usr/share/zoneinfo/Asia/Seoul /etc/localtime && \
  echo "Asia/Seoul" > /etc/timezone

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 sveltekit

# Copy the built application
COPY --from=builder /app/build ./build
# Runtime config for `--env-file-if-exists` below: PUBLIC_* feature gates
# ($env/dynamic/public) are resolved from process.env at server start, so the
# production server must read the same .env the dev server reads.
COPY --from=builder /app/.env ./.env
COPY --from=builder /app/package*.json ./
COPY --from=deps /app/node_modules ./node_modules

# Change ownership of the app directory
RUN chown -R sveltekit:nodejs /app

# Remove SUID/SGID bits from binaries to prevent privilege escalation
RUN find /bin /usr/bin /usr/local/bin -xdev \( -perm /4000 -o -perm /2000 \) -exec chmod -s {} + 2>/dev/null || true

USER sveltekit

# Expose port
EXPOSE 3002

ENV PORT=3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Start the server (--env-file-if-exists keeps the command valid when no .env
# ships with the image; explicit environment variables still take precedence)
CMD ["node", "--env-file-if-exists=.env", "build"]