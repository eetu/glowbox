# glowbox — repo overview

Glowing retro **display components** shipped as installable npm packages: three
framework-agnostic rendering cores (a 3D WebGL LED grid + 2D-canvas nixie tube and
seven-segment displays), thin Svelte/React/Vue wrappers over all, and content
helpers — developed in a
Yarn-workspaces monorepo with a runnable demo SPA. Part of eetu's homebrew family
(Svelte, halo-design, ts-style) — but it is a **library**, not a self-hosted app:
no backend, no Pi deploy. The demo ships to GitHub Pages; packages publish to npm.

## Layout

```text
packages/
  led-grid/  @glowbox/led-grid — plain-TS WebGL 3D LED display + canvas-like voxel API. Zero deps.
  nixie/     @glowbox/nixie    — 2D-canvas nixie-tube core + stateless 3D-compositing helpers. Zero deps.
  seven-segment/ @glowbox/seven-segment — 2D-canvas 7-seg core: per-segment fades, ageing→dead segments, LED/VFD styles. Zero deps.
  crt/       @glowbox/crt      — composable CRT effect over any canvas/element (WebGL pass; curvature, persistence, event forwarding). Zero deps.
  svelte/    @glowbox/svelte   — Svelte 5 <LedGrid> + <NixieTube> + <SevenSegment> (ships .svelte source).
  react/     @glowbox/react    — React 18/19 components (dist carries 'use client').
  vue/       @glowbox/vue      — Vue 3 render-function components.
  extras/    @glowbox/extras   — GIF/image players + text helper over the draw API (bundles gifuct-js).
examples/
  svelte-gallery/              — SvelteKit SPA demo (LED programs + /nixie + /seven clocks) → GitHub Pages.
scripts/
  publish-smoke.mjs            — publish-integrity smoke test (see Testing).
docs/ROADMAP.md                — direction (strategic bets; 1.1/1.2 themes shipped).
```

Root is the workspace: shared `tsconfig.base.json`, `.prettierrc`, vendored yarn
(`.yarn/releases/*.cjs`, no corepack), root scripts fan out with `yarn workspaces foreach`.

## Conventions

- **The library is display-only.** It ships **no programs**; content (torus, games,
  music viz) is the client's — see `examples/svelte-gallery/src/lib/examples`.
- **Canvas-like voxel API** (led-grid): `plot`/`add`/`get`/`clear`/`fill`/`line`/`box`/
  `sphere` over an nx×ny×nz grid; colours `[r,g,b]` 0..1 (>1 blooms) or CSS strings.
  The display owns WebGL render, orbit (auto + drag + pinch/wheel zoom; auto-orbit
  defaults off under `prefers-reduced-motion`), resize, context-loss recovery and the
  `onFrame(cb)` loop (callbacks **stack**; each stop() removes its own); programs only
  write voxels each frame. `createVoxelGrid` is the pure headless version.
- **LEDs are additive glowing point-sprites on black** (order-independent, see-through;
  `hologram` HDR-bloom style + a `comic` cel style). See `packages/led-grid/src/renderer.ts`.
- **Cores stay import-safe in node/SSR**: nothing browser-only (`Path2D`, canvas,
  `ResizeObserver`) may run at module scope — 1.0.0 shipped an SSR import crash this
  way. Guarded by nixie's `ssr-import.test.ts` + the publish smoke.
- **Cores are independent**: nixie vendors its own copy of the colour parser
  (`packages/nixie/src/color.ts`) rather than depending on led-grid — a display core
  must not pull in a sibling. Both set `role="img"` + `aria-label` (the `label` option).
- **Packaging.** ESM-only, `files: ["dist"]`, exports with `types` + `import` (svelte:
  `svelte` condition, ships `.svelte` source via `@sveltejs/package`). All are
  public-npm scoped (`publishConfig.access: public`), versions **lockstep**. size-limit
  budgets in every package (svelte's measures shipped files with `esbuild: false`).
- **Monorepo dev loop.** Demo + wrapper tests resolve `@glowbox/*` to package **source**
  (SvelteKit `kit.alias`; Vite aliases in tests), so dev/typecheck/test need no prior
  build. The `workspace:^` deps are for install-linking + publish version rewrite.
- **halo-design tokens** in `examples/svelte-gallery/src/lib/styles/halo.css`.

## Testing (house convention: `spa-frontend → Testing`)

- **vitest projects per package, split by filename.** Node `*.test.ts` for pure logic
  and import-safety (the bitmap font/scroller are node-testable by design); **browser**
  (real headless chromium via `@vitest/browser-playwright`; the core also runs
  **webkit** — the risk browser for the HDR half-float extensions) for anything needing
  WebGL/canvas/DOM — routed by `*.browser.test.ts` (`*.svelte.test.ts` in the svelte
  package). Browser tests assert lit pixels via `gl.readPixels`/2D readback.
- **Golden screenshots** (`*.golden.test.ts`, led-grid): four looks rendered on a
  SwiftShader-pinned chromium so ONE committed baseline (`src/__tests__/golden/`)
  serves macOS dev and Linux CI. Regenerate intentionally-changed visuals with
  `yarn workspace @glowbox/led-grid test --project golden -u`.
- **`scripts/bench-led-grid.mjs`** — manual perf numbers against the built package
  (the README's perf table cites its output + environment).
- **Playwright e2e = the full built app**: `examples/svelte-gallery/e2e` boots the
  built gallery, switches examples, checks the canvas paints.
- **`node scripts/publish-smoke.mjs` = the published artifacts**: packs all packages →
  npm-installs the tarballs into a throwaway consumer → bare-node imports each package
  (catches SSR crashes) → `tsc` against the shipped `.d.ts` → mounts both cores in
  headless chromium straight from the installed dist (import map, no bundler). Runs in
  CI and gates every release — the only coverage of what npm users actually receive.
- CI installs chromium once (`yarn playwright install --with-deps chromium`).

## Working on this repo

- `yarn dev` — demo gallery on `:5173` (Vite; HMR into library source).
- `yarn build` — topological: cores → wrappers/extras → demo.
- `yarn test` / `yarn validate` (= lint + format + typecheck + test). Yarn is vendored:
  `node .yarn/releases/yarn-*.cjs <script>`.
- `yarn size` — bundle budgets. Per-package: `yarn workspace @glowbox/led-grid <script>`.
- Demo routes prerender as shell pages with a `404.html` SPA fallback (GitHub Pages has
  no rewrites); static SEO/OG tags live in `src/app.html`, per-route titles via
  `<svelte:head>`.

## Publishing

Tag `vX.Y.Z` on main → `release.yaml` publishes all eight to npm via **trusted publishing
(OIDC) + provenance** (no `NPM_TOKEN`). Gates: tag-on-main, tag matches **every**
package's version, the full validate suite, and the publish smoke. Versions are bumped
in lockstep across all `packages/*` `package.json`s via `node scripts/bump-version.mjs <version>`,
plus a CHANGELOG entry (root `CHANGELOG.md`, Keep-a-Changelog). Publishes are idempotent
on rerun (`npm view` guard); prerelease versions (`-rc.N`) go to the `rc` dist-tag.

## Status / next

- **1.0.x–1.4.0 shipped** (latest: 1.4.0 on 2026-07-26 — `@glowbox/crt`, the first
  effects layer) — **eight** packages in lockstep, all live on npm. NOTE for future
  new packages: npm needs the package to exist before a **trusted publisher** can be
  configured — first-publish a local `-rc.1` with `npm publish --tag rc --otp=…`,
  configure the publisher, then tag (the rc doesn't trip the idempotency guard, so
  the stable still ships via OIDC with provenance).
- **Direction:** see `docs/ROADMAP.md` — the strategic bets: `@glowbox/bridge`
  (WLED/DDP hardware streaming), more display cores (flip-dot → split-flap; each must
  clear the wow-over-trivial-alternative bar), trigger-based WebGL2 renderer (the
  only 2.0).

## Out of scope

- No database / server API / auth. If a program needs persistence, that's the consuming
  app's job, not the library's.
- The gallery examples are **attract-mode** (self-playing); no gameplay input is wired
  (pointer use = drag-to-orbit/zoom). An input/games API in the library is explicitly
  rejected — see ROADMAP "deliberately not doing".
