# Changelog

All notable changes to the glowbox packages are documented here. The format is based
on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the packages share a
version and are released together.

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

## [1.0.0-rc.2] — 2026-07-13

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

[1.0.0-rc.3]: https://github.com/eetu/glowbox/releases/tag/v1.0.0-rc.3
[1.0.0-rc.2]: https://github.com/eetu/glowbox/releases/tag/v1.0.0-rc.2
