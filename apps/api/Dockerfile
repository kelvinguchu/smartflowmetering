ARG NODE_IMAGE=node:22.22.1-alpine3.22

FROM oven/bun:1.3.4-alpine AS deps
WORKDIR /usr/src/app
COPY package.json ./
RUN bun install

FROM ${NODE_IMAGE} AS release
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY src ./src
COPY package.json ./
COPY tsconfig.json ./
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
    && chown -R node:node /usr/src/app

USER node
EXPOSE 3000
ENTRYPOINT ["node", "--import", "tsx", "src/index.ts"]
