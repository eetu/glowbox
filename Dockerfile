# syntax=docker/dockerfile:1

# --- Cross-compilation helper ---
FROM --platform=$BUILDPLATFORM tonistiigi/xx AS xx

# --- Stage 1: Build frontend (native, output is platform-independent) ---
FROM --platform=$BUILDPLATFORM node:26-alpine AS frontend-build
ARG BLOWBOX_IMAGE_TAG
ENV VITE_BLOWBOX_IMAGE_TAG=$BLOWBOX_IMAGE_TAG
WORKDIR /app
COPY frontend/package.json frontend/yarn.lock frontend/.yarnrc.yml ./
COPY frontend/.yarn/releases ./.yarn/releases
# Yarn is vendored (.yarn/releases/*.cjs + yarnPath in .yarnrc.yml) and invoked
# via node — no corepack, so the build is independent of the node version
# (node 25+ dropped the bundled corepack; vendoring sidesteps that entirely).
RUN node .yarn/releases/yarn-*.cjs install --immutable --network-timeout 1000000
COPY frontend/ .
# adapter-static is configured to emit to ./dist (see svelte.config.js).
RUN node .yarn/releases/yarn-*.cjs build

# --- Stage 2: Build workspace dependencies (cross-compiled, cached) ---
FROM --platform=$BUILDPLATFORM rust:1-alpine AS workspace-deps
COPY --from=xx / /
RUN apk add --no-cache clang lld musl-dev curl
ARG TARGETPLATFORM
RUN xx-apk add --no-cache musl-dev gcc
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY backend/Cargo.toml backend/Cargo.toml
# Stub sources so cargo can parse the workspace + warm the dependency cache.
RUN mkdir -p backend/src \
    && printf 'fn main() {}\n' > backend/src/main.rs \
    && : > backend/src/lib.rs \
    && xx-cargo build --release -p blowbox-backend

# --- Stage 3: Build the backend ---
FROM workspace-deps AS backend-build
ARG TARGETPLATFORM
COPY backend/src ./backend/src
# touch so cargo notices the stub→real source swap.
RUN touch backend/src/main.rs backend/src/lib.rs \
    && xx-cargo build --release -p blowbox-backend

# --- Stage 4: Runtime (scratch) ---
FROM scratch AS runner
WORKDIR /app
LABEL org.opencontainers.image.description="blowbox — a 3D LED-grid display (spinning torus, 3D Pac-Man)"
LABEL org.opencontainers.image.source="https://github.com/eetu/blowbox"

COPY --from=backend-build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=backend-build /app/target/*/release/blowbox-backend ./blowbox-backend
COPY --from=frontend-build /app/dist ./dist

ENV STATIC_DIR=./dist
ENV BLOWBOX_BIND=0.0.0.0:3016

USER 1000

EXPOSE 3016

CMD ["./blowbox-backend"]
