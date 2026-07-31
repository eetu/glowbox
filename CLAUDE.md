# glowbox — repo overview

Glowing retro **display components** shipped as installable npm packages: seven
framework-agnostic rendering cores (a 3D WebGL LED grid + 2D-canvas nixie tube,
seven-segment, flip-dot, split-flap, neon-sign and VFD-panel displays), thin
Svelte/React/Vue wrappers over all, and content helpers — developed in a
Yarn-workspaces monorepo with a runnable demo SPA. Part of eetu's homebrew family
(Svelte, halo-design, ts-style) — but it is a **library**, not a self-hosted app:
no backend, no Pi deploy. The demo ships to GitHub Pages; packages publish to npm.

## Layout

```text
packages/
  led-grid/  @glowbox/led-grid — plain-TS WebGL 3D LED display + canvas-like voxel API. Zero deps.
  nixie/     @glowbox/nixie    — 2D-canvas nixie-tube core + stateless 3D-compositing helpers. Zero deps.
  seven-segment/ @glowbox/seven-segment — 2D-canvas 7-seg core: per-segment fades, ageing→dead segments, LED/VFD styles. Zero deps.
  flip-dot/  @glowbox/flip-dot — 2D-canvas electromechanical board: physical disc/vane flips, scan-wave stagger, ditherFrame, shared-AudioContext solenoid click (createMechSound = split-flap groundwork). Zero deps.
  split-flap/ @glowbox/split-flap — 2D-canvas Solari board: drum-of-cards model (forward-only wraps), perspective falls, grapheme drums + drum zones (per-field drums) + chroma drums (chromaDrum/paletteFrame/FlapFace), card-slap sound (vendored createMechSound + noise shaping). Zero deps.
  neon/      @glowbox/neon     — 2D-canvas glass-tube neon sign: single-stroke tube letterforms (vendored Hershey script+sans faces, custom NeonFont escape hatch), sign art (SVG path data → tubes via pathToStrokes, placed behind/beside the text, own gas/colour + flasher circuit, shared `frame` registers multi-piece drawings, `opaque` faces cut rear tubes for real overlap), visible unlit glass, electrode strike sequences, wear arc, rate-capped flasher programs, `polarity: 'absorb'` (the one invented element — tubes that ink a pale wall, per sign or per art piece, so neon works in a light theme; ink composites on one layer per frame, never per pass), tappable tubes (`sectionAt` + `jolt`, split-flap's geometry-only contract), transformer hum (createHum in the vendored sound engine; Hershey ack ships as HERSHEY_LICENSE + LICENSE-hershey). Zero deps.
  vfd/       @glowbox/vfd      — 2D-canvas vacuum-fluorescent PANEL: the franchise's first heterogeneous core. Declare a `frame` + `layout` of element kinds (`digits` 7/14/16-seg + 5x7 matrix, `legend` screen-printed words, `bars` spectrum/VU with peak-hold caps, `icon` from plain SVG *fill* data — several in one box lit in turn = the hardware's own frame animation, `scale` tuning dial with discrete cursor blocks, `dots` raw cols x rows grid from a bitmap/fn (the graphic half: animations + smooth column scrolling, which a character-addressed field cannot do; grey levels are honest since anodes dim by duty cycle), `rule` silkscreen); `panel.ts` compiles ALL of them to one flat anode inventory (fixed patch + integer address + multiplex column), so the envelope physics is a few uniform passes over one Float32Array: phosphor persistence (fast attack / slow release = the smear; default 0.05 ≈ 37 ms, LOW on purpose — real ZnO:Zn decays in µs, so a high setting reads as a long exposure, not hardware), the DIMMER, filament haze + panel-continuous grid mesh, filter glass (one multiply pass; crushes undriven-anode ghosts) + panel-level `zones` (extra windows over REGIONS — a filter is plastic over a rectangle, so it belongs to the panel, not to an element whose box it would also tint behind), `selfTest()`, and wear → dim → flicker → dead PLUS the VFD-only dim-grid-column banding. API contract: names are the wiring (duplicate/empty THROWS), driving via the wrong call warns, `bars`/`dots` COPY their input (a fn given to `dots` is kept + sampled per frame), hardware lives in `setLayout(layout, frame?)` and NOT in `setOptions` (the one expensive call must not be reachable by re-sending an option bag), a framed `icon` needs no box at all (its path coords ARE frame coords), `blank(name)` STOPS driving an element — zeros can't clear a `peakHold` cap (caps rest on the floor row, so a window with two jobs could never hand over), and `fallPeaks` leaves a -1 "no cap" alone. `elementAt`/`elementRect` geometry (answering from real anode BOUNDS, not the declared box), no listeners. PERF: `shadowBlur` is the whole frame cost — the glow is a low-res offscreen composited back upscaled (the upscale IS the blur, one pass for the envelope) rather than a gaussian per anode; that plus per-element colour caching took the demo faceplate 5 -> 60 fps and the bench worst case 17-26 -> 40-63. Caching the static ghost/silkscreen layers to an offscreen was MEASURED SLOWER (a full-canvas blit beats ~890 alpha-0.014 fills only in theory) - left inline on purpose. `node scripts/bench-vfd.mjs` for numbers. **No sound module** (a VFD has no voice) — the only core without one. Zero deps.
  crt/       @glowbox/crt      — composable CRT effect over any canvas/element (WebGL pass; curvature, persistence, event forwarding). Zero deps.
  svelte/    @glowbox/svelte   — Svelte 5 <LedGrid> + <NixieTube> + <SevenSegment> + <FlipDots> + <SplitFlap> + <NeonSign> + <VfdPanel> (ships .svelte source).
  react/     @glowbox/react    — React 18/19 components (dist carries 'use client').
  vue/       @glowbox/vue      — Vue 3 render-function components.
  extras/    @glowbox/extras   — GIF/image players + text helper over the draw API (bundles gifuct-js).
examples/
  svelte-gallery/              — SvelteKit SPA demo (LED programs + /nixie + /seven + /flipdot + /splitflap + /neon + /vfd) → GitHub Pages.
                                 /vfd is two panels sharing one envelope option set + one scene clock: faceplate (segment field + annunciators + dial + tape/disc transport + dot ticker) and the analyser strip, which is ONE window with three jobs picked by source (20-band spectrum, EQ curve laid over it, and a 4:3 GIF `dots` area on the `gif` source = the DISPLAY button). Both panels read the same clock or they'd disagree about the scene.
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

Tag `vX.Y.Z` on main → `release.yaml` publishes all twelve to npm via **trusted publishing
(OIDC) + provenance** (no `NPM_TOKEN`). Gates: tag-on-main, tag matches **every**
package's version, the full validate suite, and the publish smoke. Versions are bumped
in lockstep across all `packages/*` `package.json`s via `node scripts/bump-version.mjs <version>`,
plus a CHANGELOG entry (root `CHANGELOG.md`, Keep-a-Changelog). Publishes are idempotent
on rerun (`npm view` guard); prerelease versions (`-rc.N`) go to the `rc` dist-tag.

## Status / next

- **1.0.x–1.8.0 shipped** (latest: 1.8.0 on 2026-07-30 — the neon core) — **twelve**
  packages in lockstep: eleven live on npm, plus **`@glowbox/vfd` in-tree awaiting
  its first release (1.9.0)**, whose first publish needs the new-package flow below.
  NOTE for
  future new packages: npm needs the package to exist before a **trusted publisher**
  can be configured — first-publish a local `-rc.1` with `npm publish --tag rc
--otp=…`, configure the publisher, then tag (the rc doesn't trip the idempotency
  guard, so the stable still ships via OIDC with provenance). Two hard-won details:
  make sure the manual publish uses the `-rc.N` version (a stray publish of the
  STABLE version, even if unpublished, burns that number forever — 1.5.0 → 1.5.1
  happened this way), and mind that the rc briefly holds the `latest` dist-tag
  until the stable ships.
- **Direction:** see `docs/ROADMAP.md` — the strategic bets: `@glowbox/bridge`
  (WLED/DDP hardware streaming), trigger-based WebGL2 renderer (the only 2.0). The
  planned cores all shipped; **neon** was the first post-plan core to clear the
  wow-over-trivial-alternative bar (the glass simulation, not a text-shadow) and
  **vfd** the second (the shared ENVELOPE — persistence, dimmer, self-test, grid
  banding — not the layout, which is what a div grid already does) — the bar stands
  for any next one.

## Out of scope

- No database / server API / auth. If a program needs persistence, that's the consuming
  app's job, not the library's.
- The gallery examples are **attract-mode** (self-playing) — the tappable split-flap
  shows (counter/scroller/poll) and the VFD faceplate (`elementAt` names the zone you
  tapped) take taps via a stage click listener,
  client-side; counter and poll still self-play between taps, and the scroller
  deliberately holds still (it scrolls a story — reading pace is the reader's). No
  _gameplay_ input is wired (pointer use = drag-to-orbit/zoom + those taps). An
  input/games API in the library is explicitly rejected — see ROADMAP "deliberately
  not doing".
