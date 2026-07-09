# voxl — repo overview

A generic **3D LED-grid display** component + demo playground. Sibling in eetu's
homebrew family (Rust axum + Svelte SPA, halo-design). The reusable library lives
in `frontend/src/lib/led-grid`; example driver programs (spinning torus, 3D
Pac-Man) under `frontend/src/lib/examples`. Once the library is stable it's meant
to be imported as a **viz in `../scene` (tracker)** — this repo is where it's
developed fast, standalone.

## Layout

```text
backend/    Rust axum — serves the built SPA + an unauth /status. No DB/auth
            (voxl is a pure client-side app; LAN-only behind the Pi edge).
frontend/   Svelte SPA (SvelteKit adapter-static → dist/): the led-grid library,
            the example programs, and a demo gallery to switch between them.
Cargo.toml  one-crate Rust workspace (backend).
```

## Conventions

- **The library is display-only.** `frontend/src/lib/led-grid` = a
  framework-agnostic core (`createLedDisplay`, plain TS) + a Svelte wrapper
  (`LedGrid`). It ships **no programs**; content (torus, games, music viz) is the
  client's, under `src/lib/examples`. React/Vue wrappers can layer on the same
  core later (only Svelte shipped).
- **Canvas-like voxel API.** The display is "a tiny 3D canvas": `plot/get/clear/
  fill/line/box/sphere` over an nx×ny×nz grid; colours `[r,g,b]` 0..1 (values >1
  bloom under the additive glow). The display owns WebGL render + orbit (auto +
  drag) + resize + the `onFrame(cb)` loop; programs only write voxels each frame.
- **LEDs are additive glowing point-sprites on black** (order-independent, no
  depth sort, see-through — the real LED-cube look).
- **Pure client-side.** No `/api`. The backend just serves `dist/` + `/status`,
  and hashes the SPA's inline bootstrap script at boot for the CSP (rust-axum
  embed model). `VOXL_BIND` (default `0.0.0.0:3016`), `STATIC_DIR` (`./dist`).
- **halo-design tokens** in `frontend/src/lib/styles/halo.css`; consume `--halo-*`.

## Working on this repo

- Frontend dev `:5173` — `cd frontend && yarn dev` (Vite proxies `/status` →
  `:3016`). `yarn validate` = typecheck + lint + format. Yarn is vendored
  (`node .yarn/releases/yarn-*.cjs …`; no corepack).
- Backend `:3016` — `cargo run` serves `./dist` (run `yarn build` in frontend
  first). One cargo workspace; `cargo clippy --workspace -- -D warnings`.
- Deploy: multi-stage Dockerfile (vendored-yarn SPA build → musl cross-compile →
  scratch, `ghcr.io/eetu/voxl`). `../raspi` deploy wiring is **not done yet** — see
  Status.

## Status / next (handoff)

- **Library MVP done + verified** (standalone demo renders): the display core +
  Svelte `<LedGrid>`, the canvas-like voxel API, and both example programs — a
  spinning torus and a self-playing 3D **maze** Pac-Man (connected maze, arcade
  ghost AI incl. Blinky Cruise-Elroy, power pills → frightened, eaten ghosts
  respawn via a BFS-home field, 3 lives, short fading motion trails).
- **Repo:** private `eetu/voxl`, pushed **code only** — the `.github/workflows/*`
  are in a local unpushed commit; push them after `gh auth refresh -s workflow`
  (the token used lacked the `workflow` scope).
- **Next:**
  1. `../raspi` deploy wiring — `all.py` service dict, `tasks/voxl.py` quadlet,
     Traefik route + `_SUBDOMAIN_NAMES`, `network_restrict`; + Bitwarden item + DNS.
  2. Reintroduce the library as a **"cube" viz in `../scene` (tracker)** once
     stable (it was prototyped there then moved here — a `VizMode` + a driver).
  3. React/Vue wrappers over the same core (only Svelte shipped).
  4. Ideas: more example programs; a playable (input-driven) Pac-Man; tune maze
     density / cube size (currently 7³ Pac-Man, 16³ torus).

## Out of scope

- No database / user data / server API. If a program needs persistence, that's
  the consuming app's job, not the library's.
- Game input: the examples are **attract-mode** (self-playing); no keyboard/touch
  control wired (the display's only pointer use is drag-to-orbit).
