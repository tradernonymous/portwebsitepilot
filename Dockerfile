# PORT — the production image.
#
# Built from an explicit Dockerfile rather than leaving it to platform auto-detection.
# The generated plan ran `npm ci` twice (the first pass omitted devDependencies, so the
# second tried to install over the top of it) and parked a cache mount on
# `node_modules/.cache`, which made the second install die with EBUSY. This is one
# install, one build, and a runtime that carries nothing but the compiled site.

FROM node:22-bookworm-slim AS build
WORKDIR /app

# Dependencies first, against the lockfile alone, so this layer is reused whenever only
# source files change. --include=dev because the build itself needs vite and tsc.
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

COPY . .
RUN npm run build


# The runtime carries no node_modules at all — server.mjs is deliberately
# dependency-free — so the image is Node plus the built site, and nothing else.

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/dist ./dist
COPY --from=build /app/server.mjs ./server.mjs
COPY --from=build /app/package.json ./package.json

# Railway injects PORT; server.mjs binds 0.0.0.0 and falls back to 3000 locally.
EXPOSE 3000

CMD ["node", "server.mjs"]
