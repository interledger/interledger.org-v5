# syntax=docker/dockerfile:1
#
# The Strapi CMS image. Build it from the repository root, because the install needs
# patches/ next to cms/:
#
#   docker build -f cms/Dockerfile -t interledger-org-cms .
#
# The image holds code only. Content, uploads and the database live in a git
# checkout on a volume, which the deploy-environment provides. The contract between
# this image and its manifests is in the README of interledger/frontend-deploy.

# Keep in step with "engines" and "packageManager" in cms/package.json.
ARG NODE_VERSION=24
ARG PNPM_VERSION=10.27.0

# --- base: Node and pnpm --------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS base
ARG PNPM_VERSION
# A global install, not corepack. Corepack fetches pnpm at first use, and the runtime
# filesystem is read-only.
RUN npm install --global --no-fund --no-audit "pnpm@${PNPM_VERSION}"

# --- build: install dependencies, then build the admin panel and the server ----------
FROM base AS build
# node-gyp needs these when a native module has no prebuilt binary.
RUN apt-get update \
  && apt-get install --yes --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# cms/pnpm-workspace.yaml patches @strapi/content-manager from ../patches.
COPY patches/ patches/
# .npmrc sets node-linker=hoisted. The admin build imports @strapi/admin, which only
# a hoisted install exposes to cms/src.
COPY cms/package.json cms/pnpm-lock.yaml cms/pnpm-workspace.yaml cms/.npmrc cms/
WORKDIR /app/cms
# All dependencies, development ones included. The content-sync Job runs the sync
# scripts with tsx at runtime.
RUN pnpm install --frozen-lockfile

COPY cms/ ./
RUN pnpm run build \
  # Strapi creates this folder at every start, and the runtime filesystem is
  # read-only. The folder holds custom migrations. This project has none.
  && mkdir -p database/migrations

# --- runtime ---------------------------------------------------------------------------
FROM base AS runtime
# git: Strapi commits and pushes content. tini: forwards SIGTERM to Node, so Strapi
# can finish a save before the pod stops.
RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates git tar tini \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/cms /app/cms
# The sync scripts import the site's frontmatter schemas through @site/* (../src/*).
# Node resolves their zod import from /app/node_modules, so link it to the CMS's.
COPY src/schemas/content.ts /app/src/schemas/content.ts
RUN ln -s cms/node_modules /app/node_modules
COPY --chmod=0755 cms/docker/cms-init-repo cms/docker/cms-sync-all /usr/local/bin/

WORKDIR /app/cms
ENV NODE_ENV=production \
    HOME=/tmp \
    npm_config_update_notifier=false

# The UID the manifests run as. It has no passwd entry, so git takes its identity
# from the environment.
USER 1337:1337
EXPOSE 1337

ENTRYPOINT ["/usr/bin/tini", "--"]
# node directly, not `pnpm start`. pnpm does not forward SIGTERM to its child.
CMD ["node", "node_modules/@strapi/strapi/bin/strapi.js", "start"]
