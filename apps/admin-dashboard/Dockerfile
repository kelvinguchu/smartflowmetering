# ==========================================
# Stage 1: Build
# ==========================================
FROM oven/bun:1 AS build
WORKDIR /app

# Copy package files
COPY package.json ./

# Install ALL dependencies (including dev for build)
RUN bun install

# Copy source
COPY . .

# Build args for Vite/TanStack Start
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Build the app with Nitro (outputs to .output/)
RUN bun run build

# ==========================================
# Stage 2: Production Runtime
# ==========================================
FROM oven/bun:1 AS production
WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Copy the Nitro output from build stage
COPY --from=build /app/.output ./.output

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start the Nitro server with Bun (as per TanStack docs)
CMD ["bun", "run", ".output/server/index.mjs"]
