FROM node:24-alpine AS base
WORKDIR /usr/src/app

FROM base AS deps
COPY package.json ./
RUN npm install

FROM base AS release
ENV NODE_ENV=production
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY src ./src
COPY tests ./tests
COPY package.json ./
COPY drizzle.config.ts ./
COPY tsconfig.json ./

EXPOSE 3000
ENTRYPOINT ["node", "--import", "tsx", "src/index.ts"]
