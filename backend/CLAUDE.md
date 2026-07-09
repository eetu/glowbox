# voxl/backend

Tiny axum binary: serve the embedded SPA + an unauth `/status`. voxl is a pure
client-side app, so there's **no database, no auth, no `/api`**.

- `config.rs` — `VOXL_BIND` (default `0.0.0.0:3016`), `STATIC_DIR` (`./dist`).
- `routes.rs` — `/status` (liveness) + a `fallback` `serve_spa` handler that
  returns a real asset under `static_dir` if the path maps to one (with `..`
  traversal rejected), else `index.html` (200) so the client router owns the
  route. Not tower-http `ServeDir` (its not_found leaks 404s onto client routes).
- `lib.rs` — `run_server`; builds the CSP at boot by hashing the SPA's inline
  bootstrap `<script>`(s) into `'sha256-…'` (no `'unsafe-inline'` for scripts).
  Google Fonts hosts are allowed for halo-design; everything else same-origin.

`cargo clippy --workspace -- -D warnings` + `cargo test` in CI.
