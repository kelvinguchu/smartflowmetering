ARG NODE_IMAGE=node:22.22.1-alpine3.22

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM ${NODE_IMAGE} AS production
WORKDIR /app

RUN apk add --no-cache curl

COPY --from=build /app/.output ./.output

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
