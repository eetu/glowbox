# glowbox roadmap (post-1.1)

Direction distilled from the 2026-07-13 post-release review. Horizons are themes, not
promises; each item should ship with its demo. Versions are lockstep across all six
packages.

## 1.1 — "text & confidence" — SHIPPED 2026-07-13

Everything planned landed in 1.1.0 — see `CHANGELOG.md` for the full list.

## 1.2 — "clocks & music" — SHIPPED 2026-07-25

Everything below landed in 1.2.0 (see `CHANGELOG.md`); the StackBlitz starters +
README links followed right after against the published packages
(`examples/starters/`). (The torus demo deliberately keeps its hand-rolled tumbling
torus — `d.torus()` is axis-aligned/single-colour, see the note in `torus.ts`.)

- **`createNixieRow`** — a framework-free multi-tube row/clock helper (the demo
  hand-builds exactly this), plus a decimal-point glyph (authentic to real tubes;
  letters are not — skipped) and a dev-warning on multi-char `value` truncation.
- **Audio-reactive helper in extras**: `AnalyserNode` → smoothed bands/levels + canned
  bars/radial visualizers (~150 lines, zero deps), and a gallery music-viz example —
  the most shareable demo content this library can produce.
- **led-grid transparent-canvas mode** (`alpha: true` + premultiplied compositing) —
  parity with nixie's `bare`; "glowing widget floating over your dashboard" is the core
  decorative promise.
- **GIF/image player controls**: `pause()` / `seek()` / `rate` attached to the returned
  draw fn (non-breaking).
- **StackBlitz links in the react/vue READMEs** (most of a hosted demo's value at ~none
  of the cost) and per-example **"view source" links in the gallery** — the example
  files are the real tutorial.

## Strategic bets (ranked)

1. **`@glowbox/bridge` — stream the voxel buffer to real hardware.** WLED/DDP over UDP
   first, Art-Net/E1.31 second. The frame buffer is already a `Float32Array`; the fps
   cap and rgb sub-emitter layouts already show hardware sympathy. A small standalone
   package (map + gamma + pack + send) with zero renderer risk — and it upgrades the
   story to "the software twin of your LED cube: the same `onFrame` renders in the
   browser and on the wall". Ships as 1.3-class, additive.
2. **Display-core franchise** — ship each core the moment it's done (minors are free;
   don't batch a finished core behind an unfinished one), as the mood strikes. The
   franchise grew a second axis in 1.4.0: **effects layers** (`@glowbox/crt`) that
   multiply every core instead of adding one — same wow bar applies.
   **Seven-segment SHIPPED in 1.3.0** — it cleared the "beats a 7-seg font" bar with
   per-segment dynamics, the ageing arc (dim → flicker → dead segment), and LED/VFD
   materials. Next: flip-dot (dithering + optional click; also the family's first
   genuinely 3D spectacle if a 3D demo ever itches) → split-flap (most delightful,
   most work, last). The bar for every core: real wow beyond the trivial alternative,
   or it doesn't ship. Nixie proved the pattern: standalone 2D core + wrapper
   components + a demo page; the 1.0.1 decoupling made cores independent.
3. **WebGL2 instanced-quad renderer — the only true 2.0, trigger-based.** Fixes the
   2–64 px sprite clamp (hi-dpi close-ups), makes float buffers guaranteed (the LDR
   fallback disappears), enables per-LED geometry, and solves lattice-mode cost. Do it
   only when triggered (a close-up LED-wall look is wanted, or bridge users at 64³+,
   or — added 2026-07-26 — a page needs more simultaneous displays than Safari's
   WebGL context budget allows: the shared-context multi-view architecture, one
   full-viewport canvas scissored per display, belongs to this rewrite since it
   inverts the display-owns-its-canvas assumption; the same rewrite should consider a
   led-grid-integrated CRT pass so grid+effect costs one context), only after the
   golden screenshots exist — and go WebGL2-only when it happens.

## Deliberately not doing

- **CJS builds** — `require(esm)` works in current Node; these are browser-runtime
  packages. Never.
- **WebGPU** — no visible payoff for an additive point cloud at these sizes; WebGL2
  covers the use-case for years.
- **Docs site / Storybook / typedoc** — six good READMEs + the live gallery are the
  right docs at this scale.
- **Changesets / per-PR bundle-size diffs** — team tooling; lockstep solo releases need
  a bump-all script and the release guard, which exist.
- **Full browser matrix** — WebKit on the core tests captures the real risk; the rest is
  CI minutes and flake.
- **Input/games API in the library** — a playable Pac-Man is great _gallery_ content
  someday; keyboard handling belongs to the consuming app (display-only stays the
  contract).
- **Web-component wrapper** — deferred, not rejected: the vanilla core is already a
  5-line embed; revisit if plain-HTML/Astro demand shows up.
- **Nixie letters** (decimal point only), **GIF loop-count fidelity / streaming**,
  **webcam/video sources** — niche until someone asks.
