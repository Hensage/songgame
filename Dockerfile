# syntax = docker/dockerfile:1

FROM node:22-slim

LABEL fly_launch_runtime="Node.js"

WORKDIR /app

ENV NODE_ENV="production"

# Dependencies are pure JavaScript, so no compiler toolchain is required.
COPY --link package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --link . .

EXPOSE 3000

CMD ["node", "server.js"]