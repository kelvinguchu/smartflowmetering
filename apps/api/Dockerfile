ARG NODE_IMAGE=node:22.22.1-alpine3.22

FROM ${NODE_IMAGE} AS deps
WORKDIR /usr/src/app
COPY package.json ./
RUN npm install

FROM ${NODE_IMAGE} AS release
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY src ./src
COPY package.json ./
COPY tsconfig.json ./
RUN chown -R node:node /usr/src/app

USER node
EXPOSE 3000
ENTRYPOINT ["node", "--import", "tsx", "src/index.ts"]
