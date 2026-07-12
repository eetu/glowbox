# glowbox — repo overview

A generic **3D LED-grid display** shipped as an installable component library:
a framework-agnostic WebGL core plus thin framework wrappers, developed in a
Yarn-workspaces monorepo with runnable demo SPAs. Part of eetu's homebrew family
(Svelte, halo-design, ts-style) — but it is a **library**, not a self-hosted
app: no backend, no Pi deploy. Demos ship to GitHub Pages.

## Layout

```text
packages/
  core/     @glowbox/led-grid   — plain-TS WebGL display + canvas-like voxel API. ZERO deps.
  svelte/   @glowbox/svelte — Svelte 5 <LedGrid> wrapper (peer: svelte; dep: @glowbox/led-grid).
examples/
  svelte-gallery/           — SvelteKit SPA demo (spinning torus + 3D Pac-Man) → GitHub Pages.
```

Root is the workspace: shared `tsconfig.base.json`, `.prettierrc`, vendored yarn
(`.yarn/releases/*.cjs`, no corepack), and orchestration scripts that fan out
with `yarn workspaces foreach`.

## Conventions

- **The library is display-only.** `@glowbox/led-grid` = a framework-agnostic core
  (`createLedDisplay`, plain TS) with a pure `createVoxelGrid` factored out for
  headless drawing/testing. It ships **no programs**; content (torus, games,
  music viz) is the client's — see `examples/svelte-gallery/src/lib/examples`.
- **Canvas-like voxel API.** "A tiny 3D canvas" — `plot`/`add`/`get`/`clear`/
  `fill`/`line`/`box`/`sphere` over an nx×ny×nz grid; colours `[r,g,b]` 0..1
  (values >1 bloom under the additive glow). The display owns WebGL render,
  orbit (auto + drag), resize and the `onFrame(cb)` loop; programs only write
  voxels each frame.
- **LEDs are additive glowing point-sprites on black** (order-independent, no
  depth sort, see-through — the real LED-cube look). See `core/src/renderer.ts`.
- **Packaging.** `@glowbox/led-grid` builds with Vite lib mode + `vite-plugin-dts`;
  `@glowbox/svelte` with `@sveltejs/package` (ships `.svelte` source + `.d.ts`).
  Both are public-npm scoped packages (`publishConfig.access: public`), exports
  with `types` + (`import`/`svelte`) conditions.
- **Monorepo dev loop.** The demo + the svelte package resolve `@glowbox/*` to
  package **source** (SvelteKit `kit.alias`; a Vite alias in the svelte tests),
  so dev/typecheck/test need no prior build. The `workspace:^` deps are for
  install-linking + publish version rewrite.
- **halo-design tokens** in `examples/svelte-gallery/src/lib/styles/halo.css`.

## Testing (house convention: `spa-frontend → Testing`)

- **vitest, two projects, split by filename.** Node `*.test.ts` for pure logic
  (`core/src/__tests__/voxel-grid.test.ts`). **Browser** (real headless chromium
  via `@vitest/browser-playwright`) for anything needing WebGL/DOM — routed by
  `*.browser.test.ts` in core and `*.svelte.test.ts` in the svelte package
  (`vitest-browser-svelte`). Both assert lit pixels via `gl.readPixels`.
- **Playwright = the full built app.** One e2e in `examples/svelte-gallery/e2e`
  (`vite build && vite preview`) — boots the gallery, switches examples, checks
  the canvas paints. Reserved for as-shipped checks only.
- CI installs chromium once (`yarn playwright install --with-deps chromium`).

## Working on this repo

- `yarn dev` — demo gallery on `:5173` (Vite; HMR into library source).
- `yarn build` — topological: `@glowbox/led-grid` → `@glowbox/svelte` → demo.
- `yarn test` / `yarn validate` (= lint + format + typecheck + test). Yarn is
  vendored: `node .yarn/releases/yarn-*.cjs <script>`.
- Per-package: `yarn workspace @glowbox/led-grid <script>`, etc.

## Status / next (handoff)

- **Restructured from the old sibling-app** (Rust backend + SvelteKit SPA) into
  this library monorepo. Backend / Dockerfile / Rust CI removed; library split
  into `@glowbox/led-grid` + `@glowbox/svelte`; demo moved to `examples/`.
- **CI** is node-only (`ci.yaml`); `release.yaml` publishes to npm on `v*` tags;
  `pages.yaml` deploys the demo to GitHub Pages.
- **Rename pending (manual):** the repo/dir/remote are still the typo `blowbox`.
  Standardize on **glowbox**: `gh repo rename glowbox`, `git remote set-url
origin git@github.com:eetu/glowbox.git`, and `mv ~/dev/blowbox ~/dev/glowbox`.
- **Before first publish:** create the `@glowbox` npm scope, add repo secret
  `NPM_TOKEN`, enable GitHub Pages (source = GitHub Actions).
- **Next:** React/Vue wrappers over the same core; more example programs; a
  playable (input-driven) Pac-Man.

## Out of scope

- No database / server API / auth. If a program needs persistence, that's the
  consuming app's job, not the library's.
- The examples are **attract-mode** (self-playing); no keyboard/touch input is
  wired (the display's only pointer use is drag-to-orbit).
