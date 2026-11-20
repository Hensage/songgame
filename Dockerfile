# syntax = docker/dockerfile:1

FROM node:22-slim AS build

WORKDIR /app

# The client is built with dev dependencies (Vite, React plugin, Sass).
COPY --link package.json package-lock.json ./
RUN npm ci

COPY --link client ./client
RUN npm run build


FROM node:22-slim

LABEL fly_launch_runtime="Node.js"

WORKDIR /app

ENV NODE_ENV="production"

# The server's only runtime dependency is pure JavaScript, so no toolchain is required.
COPY --link package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --link server.js ./
COPY --link src ./src
COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["node", "server.js"]
