# Changelog

All notable changes to the glowbox packages are documented here. The format is based
on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the packages share a
version and are released together.

## [Unreleased]

### Added

- **Gallery: two interactive split-flap shows** (demo only, no package changes).
  **Scroller** — a text scrolled by a scrollbar built from the panel itself: the
  right-hand column rides a five-flap rail drum (`' ▲▼░█'`), taps on the arrows turn
  a page and taps on the rail jump (`cellAt` hit-testing). No auto-scroll — the text
  is an
  easter egg (a small story about a boy and the split-flap board at the edge of the
  city that never got the LED upgrade), and reading pace belongs to the reader. **Poll** — tap a row to vote for a display core: three
  drum kinds on one board (letter names, five-colour chroma bars, `DRUM_DIGITS`
  tallies), and when a bar hits the edge every bar halves — renormalisation as a
  full-board cascade. Votes trickle in on their own between taps.

## [1.7.1] — 2026-07-29

### Added

- **`@glowbox/split-flap`: `cellAt(clientX, clientY)` and `cellRect(x, y)`** — the
  pointer↔module mapping, owned by the library that owns the layout maths: `cellAt`
  turns a pointer event into a module coordinate, `cellRect` turns a module back into
  the viewport rectangle of its card window (gap and fallen stack excluded — the
  exact place to put a focusable DOM overlay). The README's clickable-modules recipe
  now uses them.

### Fixed

- **`@glowbox/split-flap`: non-finite coordinates threw in 1.7.0.**
  `setChar(NaN, 0, ch)` (also `setLine`/`getChar`) slipped past the bounds guards —
  NaN fails every comparison — and hit the new per-module drum lookup as
  `drum[NaN]`, a `TypeError` where 1.6.0's board-global drum made the same index
  harmless. The guards now reject non-finite coordinates explicitly.
- **Sound note (not a bug):** an "AudioContext opens without a gesture" report
  against 1.7.0 reproduced identically on 1.6.0 — and only under CDP-driven probes:
  a Playwright/Puppeteer `evaluate` runs with `userGesture: true`, permanently
  activating the page, after which booting audio is exactly what the autoplay
  policy permits. Measured passively, neither version opens a context without a
  real gesture. Documented at the gesture gate in both vendored sound engines.

## [1.7.0] — 2026-07-29

### Added

- **`@glowbox/split-flap`: drum zones** — `drums: [{ x, y, cols, rows, charset }]`
  puts different drums at different locations, the way the real boards were built:
  letter modules for the destination field, dedicated short digit drums for the
  time and track columns (short drum, short wraps, snappy rollovers). Later zones
  win overlaps; zones re-card live via `setOptions` and re-clip when the board is
  re-tiled. `<SplitFlap>` in svelte/react/vue passes `drums` through. The gallery's
  departures show now runs its time and track fields on dedicated drums — the red-X
  cancelled flap rides a 12-flap track drum instead of the full alphabet.

### Fixed

- **`@glowbox/crt`: the wrapped display stays accessible.** Element mode used to hide
  the composited source canvases with `visibility: hidden`, which strips them from the
  accessibility tree — and since the output canvas is `aria-hidden` (a visual
  duplicate), a wrapped display vanished from assistive tech entirely, voiding the
  display cores' `role="img"` + live-label contract. Sources are now hidden with
  `opacity: 0` (identical layout and visuals; the semantics stay readable), and the
  contract is documented in the README — including the same rule for canvas-mode
  placement.

## [1.6.0] — 2026-07-28

The fifth display core: an **electromechanical split-flap (Solari) display** — the
departure board. Where the flip-dot rattles, this one _cascades_. Now **ten**
packages in lockstep.

### Added

- **`@glowbox/split-flap`** — `createSplitFlap(canvas, opts)`, a 2D-canvas board of
  split-flap modules. Zero deps, SSR-import-safe, ~5.8 kB.
  - **Mechanism-honest model**: each module is a drum of flap cards hinged at the
    split line (a card carries the top half of one character on its front, the
    bottom half of the next on its back); a flip is a gravity **release** with a
    hard stop and a settle bounce, rendered with **true perspective** (projected
    strips — the free edge magnifies toward the viewer near edge-on). The drum is a
    **ratchet**: reaching an earlier character wraps the whole flap sequence, the
    cascade that made these boards famous.
  - **Drums as data**: `charset` order is drum order, one grapheme per flap
    (katakana and emoji ride as single cards; input is NFC-normalised). Presets
    `DRUM_NORDIC` (default, with ÅÄÖ), `DRUM_ALNUM`, `DRUM_DIGITS`.
  - **Chroma drums**: `palette` paints flaps solid and a wall of modules becomes a
    rough image display — `chromaDrum()` generates a full hue-ring drum (grey ramp
    plus hues × shades, serpentine so gradients are neighbouring flaps; `hues: 0`
    for monochrome), `paletteFrame()` maps RGB frames onto it (nearest-colour, or
    Floyd–Steinberg). **`FlapFace`** re-inks individual flaps
    (`{ glyph, ink, paint }`) for dedicated marks — a red X, a whole-word DELAYED
    card — without duplicating alphabets.
  - **Card-slap sound** over the vendored `createMechSound`, extended with noise
    shaping (`noiseLpHz`, `noiseDecay`): a papery band-limited thud, no pitched
    ping, tuned by ear. Budgeted clatter, gesture-deferred AudioContext, tab-restore
    safe.
  - **Flat matte by default**; `shaded: true` adds the mechanical anatomy matched
    against module close-ups — recessed wells, card gradients, hinge clips in front
    of the flaps, the ribbed pile of fallen cards, the edge-on glint.
  - API: `setText` / `setLine` / `setChar` / `getText`, live `setOptions`
    (charset/palette swaps re-card the modules in place), `aria-label` reads the
    shown text.
- **`<SplitFlap>`** in `@glowbox/svelte` / `react` / `vue` — `text` prop drives
  `setText`, options update live, imperative handle via `oncreate` / ref / expose.
- **Demo**: `/splitflap` in the gallery — departures with Finnish stations (late
  trains lose their platform to a dedicated red-X flap), a date-and-seconds flip
  clock, free text, a **chroma slideshow** of postcard frames with a
  mono/coarse/rich/ultra drum selector, matrix rain on a half-width-katakana drum,
  and self-playing snake and pong on three-flap drums; a resolution section
  (presets and free cols × rows) mirrors the LED page.

### Changed

- **`@glowbox/flip-dot`** shaded mode grew the disc's **stop posts**. Real
  mechanisms vary by manufacturer, but all of them stop the disc against one of
  two posts sitting at ±90° to the pivot axis; the rim hole wraps the post the
  current face rests against and mirrors to the other on flip. A matte **post
  head** now shows through the hole, the free post peeks past the rim, and the
  board is a **molded waffle** — square sockets with pyramid facets catching
  light in the corners between discs.
- **`createMechSound`** (flip-dot and split-flap, vendored copies kept identical):
  the tick gained noise shaping — `noiseLpHz` (band-limit the burst from above)
  and `noiseDecay` (burst length). Additive; existing recipes unchanged.
- Size budgets adjusted for real growth (svelte 6.5 kB, react 2 kB, flip-dot
  5.5 kB — the mechanism details above). The chroma slideshow ships as a purpose-built `chroma.gif` (six locally
  generated postcard frames, 8-second delays baked in).

## [1.5.1] — 2026-07-27

Version-number recovery, no code changes: the `v1.5.0` publish run stopped at
`@glowbox/flip-dot` — its `1.5.0` had been accidentally published (and unpublished)
during the manual first-publish dance, and npm permanently burns a version number
that ever existed. Three packages had already shipped `1.5.0`; `1.5.1` is the same
code for all nine, in lockstep.

## [1.5.0] — 2026-07-27

The fourth display core: an **electromechanical flip-dot board**. Where the LED grid
glows, the nixie burns and the seven-segment fades, this one _moves_ — and, if you let
it, clicks. Now **nine** packages in lockstep.

### Added

- **`@glowbox/flip-dot`** — `createFlipDots(canvas, opts)`, a 2D-canvas board of
  physically flipping dots. Zero deps, SSR-import-safe, ~4.6 kB.
  - **Physical flips**: each disc rotates about its pivot axis (diagonal by default,
    like the real pivot pins), foreshortening to an edge-on sliver mid-flip; frame
    changes sweep the board as a row-driver **scan wave** (stagger scan / random /
    none). A dot re-targeted mid-flip completes its previous flip first.
  - **Mechanism-honest detail** (researched against patents, photos and a 3D model of
    the mechanism): the drive-pole **notch** sits 90° off the pivot axis and mirrors
    between disc faces — the electromagnet's pole pair straddles the axis. The
    `shape: 'square'` style is the octagonal bus-sign vane: **one triangular flap
    folding across the diagonal hinge** over two painted base halves — blank hides
    the base's pole hole, open reveals it.
  - **Flat matte by default** (how the boards photograph); `shaded: true` opts into
    the lighting story — face gradients, socket wells, axle dimples, edge-on glint.
  - **`ditherFrame`** — threshold (default) / Bayer / Floyd–Steinberg, pure and
    node-tested, for driving the one-bit board from grayscale.
  - **`createMechSound`** — a mechanical-tick synth over ONE shared, refcounted
    AudioContext (a page of boards costs one context, not one each). The solenoid
    click is tuned against a recording of a real board (narrow 6.5–10.5 kHz ring,
    2–4 ms strike, wide level spread); a click budget keeps continuous shows a
    rattle, not a buzz; suspended/interrupted contexts self-resume on tab return;
    and the context is not even created until the page has seen a user gesture
    (`navigator.userActivation`) — zero audio footprint on a host page running
    its own audio (found in the `1.5.0-rc.1` shakedown against a real app).
    Exported as split-flap groundwork — a flap slap is just another recipe.
  - Perf: baked face sprites, a pre-squashed atlas on dense boards, `fillRect`
    board in flat mode — the demo board's worst case runs ~134 fps at dpr 2 on an
    Apple M1 (**`scripts/bench-flip-dot.mjs`**); idle costs zero by construction.
- **`<FlipDots>` in all three wrappers** (`@glowbox/svelte` / `react` / `vue`):
  frame + option props over the core, imperative board handle via
  `oncreate` / ref / `expose`.
- **Demo gallery `/flipdot`**: clock with a seconds sweep, the loop.gif dithered to
  one bit (turn the sound on), plasma, a live-editable text marquee, and a
  click-to-count tally counter — plus sound, CRT, shape/axis/stagger/dither knobs.
- **Gallery UI unified across all four cores**: the primary selectors (example/show
  plus style) live in the header only — no duplicated controls in the drawer;
  headers wrap on mobile instead of hiding things.

## [1.4.1] — 2026-07-26

### Fixed

- **`@glowbox/led-grid`: the display canvas can now be sampled reliably from outside
  its own render tick** — the WebGL context is created with
  `preserveDrawingBuffer: true`. Without it, Safari may clear the buffer after
  compositing, so an effects layer (`@glowbox/crt`) or any `drawImage`/`toDataURL`
  reading the canvas from its own rAF could see black. The cost is one buffer copy per
  composite — noise next to the bloom passes. Nixie and seven-segment need no change:
  2D contexts always preserve their buffer.

## [1.4.0] — 2026-07-26

The family's first **effects layer**: where the display cores render physically honest
objects, `@glowbox/crt` renders _watching one through a curved phosphor screen_ — and
it composes over **any** canvas, glowbox or not. Now **eight** packages in lockstep.

### Added

- **`@glowbox/crt`** — `createCrtScreen(source, opts)`, a per-frame WebGL pass with
  barrel curvature (real resampling), scanlines, an RGB phosphor mask, **phosphor
  persistence from real frame history** (moving content ghosts), convergence error
  that worsens toward the edges, vignette, mains flicker, a rolling refresh band, and
  static — all 0..1 knobs, live-updatable; `prefers-reduced-motion` freezes the
  temporal ones. Zero deps, SSR-import-safe.
  - **Element mode** — slap it over a whole element: `createCrtScreen(clockDiv)`
    mounts itself, composites every descendant canvas at its layout position (slots
    added/removed later are picked up), hides the originals (still laid out — their
    observers keep working), and **forwards pointer/wheel to the child canvas under
    the cursor**, so drag-orbit/zoom work straight through the tube. `dispose()`
    restores everything.
  - Canvas mode stays as the low-level API (you place the output canvas).
  - Perf: ~1 ms/frame at 1080p on an Apple M1; measured by the new
    **`scripts/bench-crt.mjs`**. Uniform locations cached, no CPU-side upload flip
    (shader-side V-flip), `texSubImage2D` streaming, and a single-fullsize-canvas
    fast path in element mode.
- **Demo gallery**: a **CRT** toggle on the LED gallery (with a nine-knob "crt" panel
  section) and on the `/seven` clock — the whole eight-canvas row on one tube.
- No framework wrappers, deliberately: element mode is one call from any framework.
- **Testing** (the layers the package suite can't reach): a SwiftShader-pinned
  **golden** of the tube look over a colour-bar test card; **webkit** joins the crt
  browser suite; a gallery e2e drives **real (trusted) mouse drag + wheel** through
  the overlay and verifies forwarding to the hidden source.

### Fixed (hardened through `1.4.0-rc.1…3` against a real app)

- **Creation-order races self-heal**: a screen created before its container lays out
  (or inside a closed panel) resolves once layout arrives — `frame()` checks the
  backing store against the live CSS box, beyond ResizeObserver; three orderings
  regression-tested.
- **The wrapped element keeps its CSS**: outside the curved face the output is
  transparent (backgrounds/borders/radius show around the tube), and the element-mode
  face floor defaults to the container's computed background colour (`background`
  overrides). Non-canvas children remain the documented compositor limit.
- **WebGL context lifecycle** (found on Safari, whose per-page context budget is
  small): `dispose()` deletes the GL objects and **releases the context slot** via
  `WEBGL_lose_context` (the output canvas is package-owned — led-grid deliberately
  keeps its consumer-owned context, guarded by its StrictMode test); the screen
  **recovers from context loss** (rebuilds everything on restore instead of staying
  black); dispose no longer double-loses an already-evicted context. Real
  lose/restore round-trip tested on chromium + webkit.
- **Cleanup audit across the family**: all three canvas cores now remove their
  `role`/`aria-label`/`aria-hidden` from the consumer's canvas on dispose (the row,
  the CRT, the wrappers, and the demo's three.js scene already restored everything).
- **Docs for real apps**: wrapping your own WebGL (the `preserveDrawingBuffer`
  gotcha, Safari-strict) and the context-budget rules, in the crt README; the
  shared-context multi-view architecture recorded as a trigger on the roadmap's
  WebGL2 2.0 entry.

## [1.3.1] — 2026-07-26

### Fixed

- **`@glowbox/seven-segment` + `@glowbox/nixie` threw on tiny canvases**
  (`IndexSizeError: arcTo … radius is negative`): with the window/glass pads floored
  at 2px/4px, a canvas under ~5px (seven-segment) / ~9px (nixie) wide or tall drove
  the inset box negative and fed `arcTo` a negative corner radius — crashing at
  creation. The box now clamps to a ≥1px sliver (and `roundRect` clamps the radius
  defensively); regression tests mount both cores at 1px. Thanks for the isolated
  report.

## [1.3.0] — 2026-07-25

The **seven-segment display** joins the family — the third rendering core, and the
first of the display-core franchise. The bar it had to clear: genuinely better than
"just use a 7-seg font" — so everything a font structurally can't do.

### Added

- **`@glowbox/seven-segment`** — a zero-dep 2D-canvas seven-segment digit
  (`createSevenSegment(canvas, opts)`), sibling core to nixie:
  - **Per-segment dynamics**: value changes cross-fade each segment individually with
    a small stagger (real multiplexing smear); rAF only while moving; instant under
    `prefers-reduced-motion`.
  - **Ageing** (`age: 0..1`): a deterministic per-instance wear fingerprint dims
    segments unevenly; past ~0.7 the most-worn segment flickers (sparse timeout-driven
    dips — idle cost ≈ 0); from ~0.95 it is **permanently dead** while the runner-up
    takes over the flickering.
  - **Materials**: `'led'` (red-orange emitter, smoked window, unlit segment ghosts) and
    `'vfd'` (phosphor cyan, whiter hot core, wider halo, anode-grid mesh).
  - `0–9`, `-`, hex `A b C d E F` (case-tolerant), the decimal point (`dp`), and `':'`
    as a first-class two-dot clock separator (height-fitted for slim slots).
  - **3D parity**: `segmentGeometry()` / `SEGMENT_VIEWBOX` / `SEGMENT_SLANT` /
    `litSegments()` export the named segment polygons + font, nixieCathodes-style.
- **`<SevenSegment>` in all three wrappers** (svelte/react/vue) alongside `<LedGrid>` +
  `<NixieTube>`, with the same live-update prop contract.
- **Demo**: a `/seven` clock route (HH:MM:SS with real colon modules) — style toggle,
  glow, the **age slider**, ghost toggle, sizes; a third "7-seg" tab in the core nav.
- The publish smoke packs/imports/type-checks/mounts all **seven** packages.

### Added (from right after 1.2.0)

- **StackBlitz starters** (`examples/starters/{svelte,react,vue}`): minimal Vite apps
  on the published packages — a pulsing sphere + torus on `<LedGrid>` and a ticking
  `<NixieTube>` — booted by new **"Open in StackBlitz"** links in the wrapper READMEs
  and the root README. Verified against the live 1.2.0 npm packages.

## [1.2.0] — 2026-07-25

"Clocks & music" — the two use-cases the library exists for.

### Added

- **`@glowbox/nixie`: `createNixieRow(container, opts)`** — the framework-free
  multi-tube row/clock helper: one tube per character (`'12:34:56'`, `'3.14'`),
  narrow separator slots, container-fitted sizing (`gap` / `digitAspect` /
  `separatorScale`), one `img` to assistive tech, live `setValue`/`setOptions`,
  in-place relighting for ticking clocks.
- **`@glowbox/nixie`: a decimal-point glyph** — `'.'` joins `0–9`, `:`, `-` (a single
  low dot, authentic to real tubes), height-fitted like the colon.
- **`@glowbox/extras`: audio-reactive helpers** — `makeAudioBands(analyser, opts)`
  distils any `AnalyserNode` into log-spaced, punchy-attack/gliding-release 0..1 bands
  plus `level`/`peak`; `makeBarsVisualizer` and `makeRadialVisualizer` draw them on any
  grid plane. Zero deps; node-testable.
- **`@glowbox/extras`: player transport controls** — the GIF/image players' draw fn
  now carries `pause()` / `play()` / `seek(s)` / `rate` (negative plays backwards) /
  `paused` / `ready` (non-breaking); plus **`makeFramePlayer(frames, opts)`** to play
  any procedural `{ src, delay }` sequence with the same controls.
- **`@glowbox/led-grid`: `quality.alpha`** — transparent-canvas mode (premultiplied
  compositing): the glow floats over whatever the page puts behind the canvas
  (parity with nixie's `bare`); `color.background` is ignored. Fixed at creation.
- **`@glowbox/extras`: the bitmap font learns `·`** (U+00B7) — the natural LED-ticker
  separator no longer renders as the missing-glyph box.
- **Demo gallery**: a **Music viz** example (simulated groove by default; a tiny
  generative WebAudio synth — kick/hats/bassline, zero assets — through the real
  analyser pipeline on the sound toggle); a **Sphere** example — an LED ball playing
  shows (a cursor-tracking blinking eye, plasma, the yellow-dude smiley, a glossy
  8-ball, a turning globe) with a show dropdown (default: auto-rotate); a
  **transparent** toggle behind the grid; **Rain v2** (floor splashes, wind gusts,
  leaning trails, heavy drops); and per-example **view-source links** in the panel.

### Changed

- The demo's `/nixie` 2D clock now runs on `createNixieRow` — one call replaces the
  hand-built row (slot sizing, separator widths, fit-scaling all moved into the
  library).

## [1.1.1] — 2026-07-25

### Changed

- **`@glowbox/nixie`: redrawn digit filaments** for `0`, `2`, `4`, `5`, `6`, `7`, `8`
  and `9` — rebalanced proportions on the shared centrelines: rounder bowls, a smoother
  `2` shoulder-to-diagonal transition, a wider `4` apex, and deliberately varied digit
  extents (a taller `0` and `8`, deeper `6`/`9` bowls) for the bent-wire-in-a-tube
  character of real nixie filaments. All tube styles pick the new shapes up
  automatically.

### Fixed

- **`@glowbox/led-grid` no longer throws where `ResizeObserver` is missing** (jsdom,
  older engines): the observer is optional now, matching nixie — auto-resize simply
  disables; `resize()` still works.
- **`@glowbox/extras`: `text(g, s, { font: 'system' })` under node/SSR** now throws the
  library's own clear error (`glowbox: 2D canvas unavailable`) instead of a raw
  `ReferenceError: document is not defined`.
- **`@glowbox/nixie` warns (once) when a multi-char `value` is truncated** to its first
  symbol, instead of silently dropping the rest.
- **npm listings**: cross-package README links now point at npmjs.com (relative links
  404 there); all six packages carry the `glowbox` keyword; extras' description +
  keywords now mention the 1.1.0 bitmap font and scroller.
- **Docs**: the wrapper READMEs now list `outlineColor`/`offSize`, note the
  `prefers-reduced-motion` `autoOrbit` default and `onFrame` stacking, and state that
  `bare` is core-only; the root README describes both cores (and the real publish
  order); led-grid's voxel-API intro includes `torus`/`cylinder`; nixie documents the
  single-symbol truncation.
- **Repo/CI** (nothing shipped): svelte typechecks against nixie source (no prior build
  needed); the publish smoke also exercises react/vue `NixieTube` types and fails
  clearly if the vendored yarn is missing; workflow SHA-pin comments corrected to their
  real versions, jobs gain timeouts + least-privilege `permissions`; dependabot's react
  group no longer swallows `vitest-browser-react` from the test group; the size-limit
  toolchain moves to v13 in lockstep and gets its own dependabot group (a solo major
  bump had split it across majors with an unmet peer); a lockstep
  `scripts/bump-version.mjs` (the roadmap already claimed it existed).

## [1.1.0] — 2026-07-13

"Text & confidence": the library gets its own typography, and the safety net any
future renderer work needs.

### Added

- **`@glowbox/extras`: a bundled 5×7 bitmap LED font** — hand-authored dot-matrix
  glyphs for printable ASCII (unknown chars render a hollow box). `text()` now defaults
  to it: deterministic on every OS, DOM-free (runs headlessly in node), **multi-line**
  via `\n`, integer `scale`. The system-font path remains as `font: 'system'`.
  `measureText(str, scale?)` returns the ink box; `FONT_5X7` / `glyph5x7(ch)` expose
  the raw font.
- **`@glowbox/extras`: `makeTextScroller(text, opts)`** — a seamless marquee draw
  callback (bitmap or system font; string or live getter; per-column colour function
  for gradients). The gallery's scroller now runs on it — with the bitmap font as its
  default look.
- **`@glowbox/led-grid`: `torus` + `cylinder`** voxel primitives (filled or ~1-voxel
  shell, orientable via an `axis` parameter), matching `sphere`/`box` conventions.
- **`onFrame` stacks subscribers**: each call adds a callback (run in subscription
  order); the returned `stop()` removes only its own. Previously a second subscription
  silently replaced the first.
- **Testing**: the core's browser suite now also runs on **WebKit** (the risk browser
  for the WebGL1 half-float HDR extensions); **golden screenshot tests** (hologram /
  comic / rgb / lattice) pinned to SwiftShader so one committed baseline serves every
  platform; pointer-interaction tests (drag / wheel / pinch / clamps); a React
  **StrictMode double-mount** test; `/nixie` route e2e covering the 2D clock **and**
  the three.js 3D scene.
- **`scripts/bench-led-grid.mjs`** — a manual benchmark against the built package;
  measured numbers (Apple M1: 60 fps through 64³ dense) now back the README's
  perf guidance.

### Changed

- **`autoOrbit` honours `prefers-reduced-motion`**: the default flips to off when the
  user asks for reduced motion; an explicit `autoOrbit` (either way) still wins.
- **`text()` renders the bitmap font by default** (was: system bold sans-serif — pass
  `font: 'system'` for the old look).
- led-grid's pointer capture no longer throws on synthetic/inactive pointer ids.

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

[1.4.0]: https://github.com/eetu/glowbox/releases/tag/v1.4.0
[1.3.1]: https://github.com/eetu/glowbox/releases/tag/v1.3.1
[1.3.0]: https://github.com/eetu/glowbox/releases/tag/v1.3.0
[1.2.0]: https://github.com/eetu/glowbox/releases/tag/v1.2.0
[1.1.1]: https://github.com/eetu/glowbox/releases/tag/v1.1.1
[1.1.0]: https://github.com/eetu/glowbox/releases/tag/v1.1.0
[1.0.1]: https://github.com/eetu/glowbox/releases/tag/v1.0.1
[1.0.0]: https://github.com/eetu/glowbox/releases/tag/v1.0.0
[1.0.0-rc.3]: https://github.com/eetu/glowbox/releases/tag/v1.0.0-rc.3
