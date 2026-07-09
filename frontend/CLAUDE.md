# voxl/frontend

Svelte SPA (SvelteKit + adapter-static → `dist/`, pure client — `ssr=false`,
`prerender=false`). Yarn is **vendored** (`.yarn/releases/*.cjs`, invoked via
`node` — no corepack); run `node .yarn/releases/yarn-*.cjs <script>`.

- `src/lib/led-grid/` — **the reusable library** (the deliverable):
  - `core/` — framework-agnostic: `renderer.ts` (WebGL point-sprite LED render),
    `led-display.ts` (`createLedDisplay` + the canvas-like voxel API + orbit +
    resize + `onFrame` loop). No Svelte imports.
  - `svelte/LedGrid.svelte` — the Svelte host (`<LedGrid size draw>`).
  - `index.ts` — umbrella (`$lib/led-grid` → `LedGrid` + core + types).
- `src/lib/examples/` — demo drivers (NOT part of the library): `torus.ts`,
  `pacman.ts`. Each is a `(display, dt) => void` factory.
- `src/routes/+page.svelte` — demo gallery; **keys `<LedGrid>` on the example**
  so switching remounts a fresh canvas (the display's GL context is lost on
  dispose, so reuse would render blank).

`yarn validate` = typecheck + lint + format before committing.
