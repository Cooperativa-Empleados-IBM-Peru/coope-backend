# ---------------------------------------------------------------------------
# Build stage: compilers + dev dependencies live only here
# ---------------------------------------------------------------------------
FROM registry.access.redhat.com/ubi10/nodejs-22:latest AS build

# Build toolchain for native modules (ibm_db)
USER root
RUN dnf upgrade -y --refresh --nodocs && \
    dnf install -y --setopt=install_weak_deps=0 --nodocs \
        gcc-c++ make openssl-devel bzip2-devel python3 libxml2 && \
    dnf clean all
USER 1001

WORKDIR /opt/app-root/src

# Dependencies first so this layer is cached until package*.json changes
COPY --chown=1001:0 package.json package-lock.json ./
RUN --mount=type=cache,target=/opt/app-root/src/.npm,uid=1001,gid=0 \
    npm ci

# Only what the TypeScript build needs
COPY --chown=1001:0 tsconfig.json ./
COPY --chown=1001:0 src ./src
RUN npm run build && npm prune --omit=dev

# ---------------------------------------------------------------------------
# Runtime stage: no compilers, no dev dependencies, no sources
# ---------------------------------------------------------------------------
FROM registry.access.redhat.com/ubi10/nodejs-22-minimal:latest

USER root
RUN microdnf upgrade -y --refresh --nodocs && \
    microdnf install -y --setopt=install_weak_deps=0 --nodocs openssl libxml2 libxcrypt-compat && \
    microdnf clean all
USER 1001

WORKDIR /opt/app-root/src

ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000

COPY --from=build --chown=1001:0 /opt/app-root/src/package.json ./
COPY --from=build --chown=1001:0 /opt/app-root/src/node_modules ./node_modules
COPY --from=build --chown=1001:0 /opt/app-root/src/dist ./dist
COPY --chown=1001:0 public ./public

EXPOSE ${PORT}
CMD [ "node", "." ]
