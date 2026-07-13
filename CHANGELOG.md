# Changelog

All notable changes to the glowbox packages are documented here. The format is based
on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the packages share a
version and are released together.

## [1.0.1] — 2026-07-13

### Fixed

- **`@glowbox/nixie` crashed Node/SSR at import** (`ReferenceError: Path2D is not
defined`): the colon glyph built its `Path2D` at module scope. Any SSR framework
  importing a wrapper (SvelteKit with SSR on, Next.js, Nuxt) crashed at import time even
  if the component never rendered. Glyph paths are now built lazily on first draw.
- **`@glowbox/nixie` is now genuinely zero-dep** — the colour parser is vendored (same
  `Color` contract), dropping the `@glowbox/led-grid` runtime dependency that made every
  nixie install pull the whole WebGL package.
- **led-grid**: the canvas gets `touch-action: none` while `drag`/`zoom` are enabled, so
  touch-orbit no longer fights page scroll on mobile; the per-frame orbit matrix rebuild
  no longer allocates.
- **extras**: `makeImagePlayer` no longer re-samples a static image every frame (the
  sample is cached per source until the target dims/fit change; repeated GIF frames
  benefit too).
- **demo**: hard refresh / deep links on `/nixie` no longer 404 on GitHub Pages (routes
  prerender as shell pages; the SPA fallback is `404.html`); the page ships a real
  `<title>` + description + social cards; the nixie 3D mode's inert width/height
  sliders are disabled with a hint.

### Added

- **`label`** option/prop across the family: `createLedDisplay` sets `role="img"` +
  `aria-label` on its canvas (default `'LED grid'`); `createNixieTube` names the canvas
  after the lit symbol (a blank, unlabelled tube is `aria-hidden`). All six wrapper
  components take a live-updatable `label` prop.
- **React**: the dist carries `'use client'`, so the components import cleanly under
  Next.js App Router / React Server Components.
- **CI/release**: a publish-integrity smoke test (`scripts/publish-smoke.mjs` — pack all
  six → npm-install the tarballs → bare-node import + `tsc` against shipped types +
  browser mount from dist) runs in CI and gates every release; the release workflow
  verifies the tag against **all six** package versions (previously only led-grid);
  `@glowbox/svelte` gains its missing size-limit budget.

## [1.0.0] — 2026-07-13

First stable release of the glowbox family — two glowing display rendering cores, thin
framework wrappers, and a content-helpers package. The feature-complete surface of the
`1.0.0-rc.*` series:

- **`@glowbox/led-grid`** — framework-agnostic 3D WebGL LED-grid voxel display (zero deps).
- **`@glowbox/nixie`** — 2D-canvas nixie-tube core, plus a 3D compositing API
  (`nixieCathodes` / `nixieStyle` / `nixieMesh` / `glyphPath` / `bare`) to build real 3D
  tubes without a 3D-engine dependency.
- **`@glowbox/svelte` / `@glowbox/react` / `@glowbox/vue`** — thin wrappers, each shipping
  `<LedGrid>` + `<NixieTube>`.
- **`@glowbox/extras`** — GIF / image / text content helpers over the draw API.

## [1.0.0-rc.3] — 2026-07-13

### Added

- **`@glowbox/nixie`** 3D / compositing API — the whole tube can be built in a 3D engine
  while nixie stays 2D (no 3D-engine dependency): `nixieCathodes()` (the full front→back
  digit stack — paths + depths — so every numeral is present and one is lit),
  `nixieStyle(style)` (squash + wire stroke width), `nixieMesh(w, h)` (honeycomb anode
  grille), `glyphPath(symbol)` / `GLYPH_VIEWBOX` (raw centreline + coordinate space), and
  `NIXIE_WIRE_COLOR`. Plus `{ bare: true }` — a tube's glowing contents on a transparent
  canvas (no 2D glass module; straight, un-premultiplied alpha) for texturing;
  `mesh` / `ghost` stay independent of `bare`.
- **`examples/svelte-gallery`** `/nixie` gains a **2D/3D toggle**: the 3D view builds real
  bent-wire cathodes (three.js `TubeGeometry` from `nixieCathodes`) glowing inside
  refractive glass tubes on a stand — the scene owns only the glass + bloom.

## 1.0.0-rc.2 — 2026-07-13

First public release candidate — a framework-agnostic 3D LED-grid display with
wrappers for the three major frameworks and a content-helpers package. (The LED-grid
core ships as **`@glowbox/led-grid`**, a peer of the `@glowbox/nixie` core — not a
generic `@glowbox/core`.)

### Added

- **`@glowbox/led-grid`** — plain-TS WebGL LED-grid display (zero deps): an nx×ny×nz
  lattice you draw voxels onto, orbitable (auto-spin + drag + zoom).
  - Two render styles: **`hologram`** (HDR bloom emitters, tone-mapped, reads on any
    background) and **`comic`** (flat cel-shaded discs/squares with an ink outline).
  - Grouped, live-updatable options: `led` / `color` / `camera` / `interaction` /
    `quality`; colours accept `[r,g,b]` (0..1, `>1` blooms) or any CSS string.
  - **`led.stagger`** — brick lattice (every other row offset half a cell), which also
    reduces view-dependent moiré.
  - **`resize(size?)`** — recompute the drawing buffer, or change the grid dimensions
    in place on the same canvas (no context loss), preserving camera + options.
  - **WebGL context-loss recovery** — the display rebuilds its renderer on restore and
    repaints existing content.
  - **`quality.fps`** — optional frame-rate cap for the render loop (power/cadence knob:
    ambient displays, or matching a hardware LED-cube's refresh rate).
  - Culling: only lit voxels are packed/drawn each frame, so cost scales with LEDs
    that are _on_, not grid volume; live `display.stats` (fps / frame / draw / render).
  - Voxel API: `plot` `add` `get` `clear` `fill` `line` `box` `sphere`, usable
    headlessly via `createVoxelGrid`.
- **`@glowbox/svelte`**, **`@glowbox/react`**, **`@glowbox/vue`** — glowbox components
  for each framework: **`<LedGrid>`** (identical prop contract — `size`, `draw`, the
  grouped option props — with an imperative display handle; size changes resize in place)
  and **`<NixieTube>`** (a single tube: `value` + appearance props over `@glowbox/nixie`,
  updating live via `setValue`/`setOptions`).
- **`@glowbox/extras`** — content helpers on the core's draw API: a **GIF/image
  animation player** (`makeGifPlayer` / `makeImagePlayer`, plane/depth/fit options,
  GIF decode + disposal compositing via `gifuct-js`) and a **`text`** helper. Building
  blocks `sampleImageToGrid`, `framesFromBuffer`, `paintImage` are exported too.
- **`@glowbox/nixie`** — a _sibling rendering core_: a single glowing nixie-tube
  numeral on a 2D canvas. Each digit is a thin geometric **filament** (a single-stroke
  wire) that glows warm-orange with a hot core, over the full stack of unlit dull-metal
  cathode wires nested behind the glass — with a honeycomb anode mesh and glass vignette.
  `createNixieTube(canvas, { value, style, color, glow, … })` with
  `setValue` / `setOptions` / `resize` / `snapshot`; three tube styles
  (`classic` / `slim` / `tall`). Renders **size-adaptively** — the full filament + mesh +
  cathode stack when large, degrading to a bold legible glyph at small sizes — and on any
  page/glass colour (`color` + `background` retint glow and glass together). Compose a
  row of tubes into a clock or counter.

[1.0.1]: https://github.com/eetu/glowbox/releases/tag/v1.0.1
[1.0.0]: https://github.com/eetu/glowbox/releases/tag/v1.0.0
[1.0.0-rc.3]: https://github.com/eetu/glowbox/releases/tag/v1.0.0-rc.3
