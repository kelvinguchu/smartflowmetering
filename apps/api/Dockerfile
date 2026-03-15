ARG NODE_IMAGE=node:22.22.1-alpine3.22

FROM ${NODE_IMAGE} AS deps
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
# npm workspaces needs these to resolve the dependency graph, but changes
# to them are rare so this layer stays cached most of the time.
COPY apps/admin-dashboard/package.json ./apps/admin-dashboard/package.json
COPY apps/public-website/package.json ./apps/public-website/package.json
COPY packages/ui/package.json ./packages/ui/package.json
RUN npm install --workspace=apps/api --include-workspace-root=false

FROM ${NODE_IMAGE} AS release
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY apps/api/package.json ./apps/api/package.json
COPY --from=deps /usr/src/app/apps/api/node_modules ./apps/api/node_modules
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/tsconfig.json
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
    && chown -R node:node /usr/src/app

WORKDIR /usr/src/app/apps/api
USER node
EXPOSE 3000
ENTRYPOINT ["node", "--import", "tsx", "src/index.ts"]
