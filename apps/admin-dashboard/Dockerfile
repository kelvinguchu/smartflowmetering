ARG NODE_IMAGE=node:22.22.1-alpine3.22

# ==========================================
# Stage 1: Build
# ==========================================
FROM ${NODE_IMAGE} AS build
WORKDIR /app

# Copy package files
COPY package.json ./

# Install ALL dependencies (including dev for build)
RUN npm install

# Copy source
COPY . .

# Build args for Vite/TanStack Start
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Build the app with Nitro (outputs to .output/)
RUN npm run build

# ==========================================
# Stage 2: Production Runtime
# ==========================================
FROM ${NODE_IMAGE} AS production
WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy the Nitro output from build stage
COPY --from=build /app/.output ./.output

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start the Nitro server with Node
CMD ["node", "--import", "./.output/server/instrument.server.mjs", ".output/server/index.mjs"]
