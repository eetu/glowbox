# Security model — blowbox

A LAN-only **3D LED-grid display** playground: a Rust (axum) binary that serves
a static Svelte SPA plus an unauthenticated `/status`. It is a **pure
client-side app** — no database, no user accounts, no `/api`, no secrets. There
is no durable state and no upstream it talks to.

## Trust boundaries & identity

- **No own auth.** In the deployed (gated-host) mode the app sits behind
  oauth2-proxy forward-auth on the Pi edge; access control is entirely the
  edge's job. The backend does not read, trust, or log any
  `X-Auth-Request-*` headers — it has nothing per-user to protect.
- **No sessions, no cookies, no OIDC, no `SESSION_KEY`.** Nothing to
  compromise on the server side.

## Unauthenticated surface

- **`GET /status`** is intentionally auth-free (service name + version only —
  no data, no counts) so gatus can probe liveness. It is served on a Traefik
  monitor router that bypasses oauth2-proxy; the rest of the host stays gated.

## Input surface

- **Static file serving** resolves the requested path and rejects anything that
  escapes `STATIC_DIR` after canonicalisation (path-traversal guard); unmatched
  routes return the SPA shell (`index.html`), never an arbitrary file.
- There is no request body the backend parses — no upload, no query the server
  acts on. All application logic (the LED grid, the example programs) runs in
  the browser on client-owned data.

## Content

- **CSP** is built in-code at boot and set on every response: same-origin
  except Google Fonts (halo-design). **No inline scripts** — the SPA's bootstrap
  `<script>`(s) are hashed into `'sha256-…'` at startup (no `'unsafe-inline'`).
  HSTS / X-Frame-Options / X-Content-Type-Options are Traefik's job.

## Hardening

- **Container**: `scratch` base (no shell/userland), single static binary,
  LAN-only (`../raspi/tasks/network_restrict.py`), small `MemoryMax`. No
  writable mount is required (stateless).

## Reporting

Personal single-user project. Open an issue, or just fix it.
