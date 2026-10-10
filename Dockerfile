FROM node:24-alpine AS base
RUN npm install --global pnpm@11
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

FROM base AS build
RUN pnpm install --frozen-lockfile
COPY . .
RUN NODE_OPTIONS=--max-old-space-size=6144 pnpm build

FROM base AS prod-deps
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    TZ=UTC \
    PORT=3000 \
    STORAGE_DIR=/data
COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY scripts ./scripts
COPY src/lib/server/db/migrations ./src/lib/server/db/migrations
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
CMD ["node", "build"]
