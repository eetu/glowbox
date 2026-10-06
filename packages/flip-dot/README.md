# @glowbox/flip-dot

An **electromechanical flip-dot board component** — a sibling rendering core to
**[@glowbox/led-grid](https://www.npmjs.com/package/@glowbox/led-grid)**,
**[@glowbox/nixie](https://www.npmjs.com/package/@glowbox/nixie)** and
**[@glowbox/seven-segment](https://www.npmjs.com/package/@glowbox/seven-segment)**.
A grid of circles is a trivial canvas exercise; this gives you the
**electromechanics**: discs that physically rotate, frame changes that sweep the
board as a scan wave, dithering for one-bit content, and an optional solenoid
click. Zero runtime deps.

```sh
yarn add @glowbox/flip-dot
```

```ts
import { createFlipDots, ditherFrame } from '@glowbox/flip-dot';

const board = createFlipDots(canvas, { cols: 28, rows: 14, sound: true });
board?.set(3, 5, true); // flip one dot
board?.setFrame(ditherFrame((x, y) => luma(x, y), 28, 14)); // or a whole frame
```

Give it a canvas; it owns the 2D render, the flip animation, resize, and the
render loop — which runs **only while dots are in flight**; a settled board costs
nothing.

## What a dot grid can't do

- **The flip is physical.** Each dot is a painted disc rotating about its pivot
  axis (diagonal by default, the way the real pivot pins sit) — mid-flip it
  foreshortens to an edge-on sliver, then the other face swings in. Not a
  cross-fade; a rotation.
- **The scan wave.** A frame change doesn't happen at once: rows flip in a
  driver sweep (`stagger: 'scan'`, the signature ripple of the real boards),
  scattered (`'random'`), or all at once (`'none'`). A dot re-targeted mid-flip
  completes its previous flip first — nothing hangs edge-on.
- **Mechanism-honest detail.** The drive-pole notch is bitten out of the disc rim
  at 90° to the pivot axis and mirrors between faces (the electromagnet's pole
  pair straddles the axis — the flip hands the notch from one pole tip to the
  other). The `'square'` shape is the octagonal bus-sign vane: **one triangular
  flap folding across the diagonal hinge** over two painted base halves — blank
  hides the base's pole hole, open reveals it, and mid-fold the cell shows the
  diagonal-triangle state the photos of those boards are full of.
- **The rattle.** `sound: true` (or a `0..1` volume) synthesizes the solenoid
  click — tuned against a recording of a real board: a narrow metallic ring in
  the 6.5–10.5 kHz band, a 2–4 ms strike, wide click-to-click level spread.
  Dense sweeps collapse into a budgeted rattle instead of a buzz. Sound starts
  on the first user gesture (autoplay policy) — and the AudioContext itself is
  not created until the page has seen one (`navigator.userActivation`), so a
  sound-enabled board adds zero audio footprint to a host page that runs its
  own audio. Survives tab hide/restore; nothing to wire up.

## Content is one bit — dither it

`ditherFrame(src, cols, rows, opts?)` turns grayscale (a row-major `0..1` array
or an `(x, y) => luma` function) into a binary frame ready for `setFrame`:
`'threshold'` (default — at flip-dot resolutions a clean cut gives stable
silhouettes), `'bayer'` (ordered halftone), or `'floyd'` (error-diffused, best
for stills). Pure logic, runs under plain node.

## Options

| option       | default              | notes                                                         |
| ------------ | -------------------- | ------------------------------------------------------------- |
| `cols, rows` | `28×14`              | one classic panel; tile bigger boards freely                  |
| `shape`      | `'disc'`             | `'disc'` \| `'square'` (octagonal vane, folding flap)         |
| `onColor`    | fluorescent yellow   | lit face (any CSS string or `[r,g,b]` 0..1)                   |
| `offColor`   | near-black           | dark face — kept distinct from the board on purpose           |
| `board`      | `'#101114'`          | the panel behind the dots; `null` = bare discs                |
| `gap`        | `0.14`               | cell fraction around each dot                                 |
| `shaded`     | `false`              | opt-in lighting: gradients, waffle sockets, pole studs, glint |
| `flipMs`     | `70`                 | one disc's flip (0 = instant; forced by reduced motion)       |
| `axis`       | `135`                | pivot-axis angle°; notch/hinge/squash all follow it           |
| `stagger`    | `'scan'`             | `'scan'` \| `'random'` \| `'none'`                            |
| `scanMs`     | `150`                | total sweep spread                                            |
| `sound`      | off                  | `true` (= 0.5) or `0..1` volume                               |
| `theme`      | `'dark'`             | `'light'` / `'auto'` bundle the colour defaults (see Themes)  |
| `pixelRatio` | `2`                  | cap on devicePixelRatio                                       |
| `label`      | `'flip-dot display'` | `aria-label`; `''` hides from the a11y tree                   |

All options update live via `setOptions(patch)`. API: `set(x, y, on)`,
`get(x, y)`, `setFrame(bits | fn)`, `clear()`, `fill()`, `resize()`,
`snapshot()` (PNG data URL), `dispose()` (hands the canvas back clean). The
default look is **flat matte** — that's how the real boards photograph;
`shaded: true` adds the full lighting story.

## The sound engine

`createMechSound({ volume })` is exported on its own: a tiny mechanical-tick
synth over **one shared, refcounted AudioContext** (a dashboard of boards costs
one context, not one each — the last `dispose()` closes it). A tick is a
resonant ping + a high-passed noise strike, all knobs per tick (`freq`, `decay`,
`noise`, `noiseHz`, `gain`, `pan`, `delay`) — the flip-dot click is one recipe
over it, a split-flap card slap is another. Floppotron trick: fire ordinary
clicks at a pitch's repetition rate and the mechanism sings.

## Performance

Faces are baked sprites; dense boards (>512 dots) additionally use a
pre-squashed atlas so a mid-flip dot is a single `drawImage`. The demo board
(56×28) animates its worst case at **~134 fps at dpr 2 on an Apple M1**
(`scripts/bench-flip-dot.mjs` in the repo); idle is zero by construction.

## Pixel dots

For a game painting into its own low-resolution raster, the board comes as **whole-pixel
data with its physics**. **`flipDotPixels({ cols, rows, dot, gap, shape })`** lays the dots
out once, row-major, as parts `{ col, row, x, y, rects }`: `rects` is the face at rest (round
from 3 px, a square at 1–2, the vane an octagon). **`flipFrames(dot, { shape, axis })`** is one
dot through its flip in `4 · dot` steps, each `{ a, b, edge }` rects: face A, face B and the
disc edge-on, so the faces take whatever colours the game's theme paints. The disc
foreshortens across its axis; the vane folds its flap over the hinge, both faces showing
mid-fold. **`flipPhases(changes, t, { cols, rows, seed, stagger, scanMs, flipMs })`** gives
each dot's phase at `t` seconds, 0 face A … 1 face B, from the frames the board was given
(`{ t, frame }[]`): the scan wave, each solenoid's jitter and a disc finishing its last flip
before the next, in closed form, so the same changes, moment and seed give the same board at
any frame rate. **`flipLandings(changes, from, to, timing)`** lists the discs that hit their
stops in a window, which is when to tick `createMechSound`.

The flip reads as a turn from 4 px. At 3 a disc twinkles through a point, and at 1–2 px a
dot is a pixel blinking through its edge, as the canvas board goes flat below 4 device pixels
a cell; the scan wave and the clicks are there at any size.

```ts
import { flipDotPixels, flipFrames, flipLandings, flipPhases } from '@glowbox/flip-dot';

const timing = { cols: 28, rows: 7, seed: 1 };
const board = flipDotPixels({ ...timing, dot: 4 });
const frames = flipFrames(4);
const changes = [{ t: -1, frame: gate }]; // at rest; push { t, frame } to change it

// Each frame:
const phases = flipPhases(changes, t, timing);
fill(plastic, x0 - 1, y0 - 1, board.width + 2, board.height + 2);
board.parts.forEach(({ x, y }, i) => {
	const { a, b, edge } = frames[Math.round(phases[i] * (frames.length - 1))];
	for (const r of a) fill(faceA, x0 + x + r.x, y0 + y + r.y, r.w, r.h);
	for (const r of b) fill(faceB, x0 + x + r.x, y0 + y + r.y, r.w, r.h);
	for (const r of edge) fill(rim, x0 + x + r.x, y0 + y + r.y, r.w, r.h);
});
for (const { col } of flipLandings(changes, lastT, t, timing).slice(0, 3))
	sound.tick({ freq: 8000, decay: 0.008, pan: (col / 27) * 1.4 - 0.7 });
```

## Themes

`theme` bundles the colour **defaults**: `'dark'` (the default — fluorescent discs on a
near-black panel), `'light'` (near-black discs on a bone panel), or `'auto'` to follow
the page's `prefers-color-scheme`. A disc is painted on both faces, so either way round
is real hardware — this is an inversion, not a filter.

Any colour you set yourself stays yours through every later theme change.

The theme also sets how hard `shaded` bites — a shadow's strength belongs to the room,
not to the module. The light board keeps the same geometry (socket wells, waffle facets,
disc rim fall-off, axle dimples) at a fraction of the density in a warm grey; the lit
facets get more white to read on pale plastic, and the edge-on flap sliver is lit metal
against a dark board, its own shade against a pale one.

---

Framework wrappers ship `<FlipDots>` alongside the other cores:
**[@glowbox/svelte](https://www.npmjs.com/package/@glowbox/svelte)** ·
**[@glowbox/react](https://www.npmjs.com/package/@glowbox/react)** ·
**[@glowbox/vue](https://www.npmjs.com/package/@glowbox/vue)**. Pairs with
**[@glowbox/crt](https://www.npmjs.com/package/@glowbox/crt)**. Live demo:
<https://eetu.github.io/glowbox/flipdot> — turn the sound on. Especially on the
GIF show.
