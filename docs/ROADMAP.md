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
   materials. **Flip-dot SHIPPED in 1.5.0** — physical disc/vane rotation, the scan
   wave, mechanism-honest notch/flap geometry, dithering, and the recording-tuned
   solenoid click; its `createMechSound` (shared AudioContext, per-tick recipes) is
   the mechanical-sound groundwork the next core inherits. **Split-flap SHIPPED in
   1.6.0** — the drum-of-cards model (forward-only wrap-through cascades), gravity
   falls with true perspective, grapheme drums, chroma drums (a wall of modules as
   a low-res image display) and the papery card slap; last of the planned cores.
   **Neon sign LANDED post-1.7.1 (ships as 1.8.0)** — the first unplanned core to
   clear the bar (the trivial alternative is CSS `text-shadow`, so the core is the
   GLASS, not a glow filter): single-stroke tube letterforms from vendored Hershey
   faces, visible unlit glass, electrode strike sequences, the wear arc at tube
   granularity, rate-capped flasher programs, the transformer hum (`createHum`
   joined the shared vendored sound engine). The logo escape hatch shipped with
   it after all: `art` pieces (SVG path data → tubes via `pathToStrokes`)
   composed behind/beside the text with their own gas/colour, their own
   flasher circuit, and real overlap (`opaque` faces cut the rear tubes shy of
   their edge) — inline glyphs were the wrong model; signs put the martini
   glass beside the word and the front die over the rear one. Filed as a
   2.x-class _idea_, no committed plan: font-free tube script — generating the
   connected letterforms procedurally instead of vendoring Hershey data.
   Honest read: that's typeface design wearing a geometry costume; effort
   unknown and probably large, and the vendored faces are good.
   The bar for every core: real wow
   beyond the trivial alternative, or it doesn't ship. Nixie proved the pattern:
   standalone 2D core + wrapper components + a demo page; the 1.0.1 decoupling made
   cores independent.
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
  contract). The cores DO answer geometry and own their own physics, which is not
  the same thing: split-flap's `cellAt`/`cellRect` and neon's `sectionAt` map a
  pointer onto a module/tube, and neon's `jolt()` applies a disturbance the core
  already models (it owns what an unstable tube looks like; the app owns when).
  No core attaches a listener — that's the line.
- **Web-component wrapper** — deferred, not rejected: the vanilla core is already a
  5-line embed; revisit if plain-HTML/Astro demand shows up.
- **Nixie letters** (decimal point only), **GIF loop-count fidelity / streaming**,
  **webcam/video sources** — niche until someone asks.
