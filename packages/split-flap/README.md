# @glowbox/split-flap

An **electromechanical split-flap (Solari) display component** — a sibling
rendering core to
**[@glowbox/led-grid](https://www.npmjs.com/package/@glowbox/led-grid)**,
**[@glowbox/nixie](https://www.npmjs.com/package/@glowbox/nixie)**,
**[@glowbox/seven-segment](https://www.npmjs.com/package/@glowbox/seven-segment)**
and **[@glowbox/flip-dot](https://www.npmjs.com/package/@glowbox/flip-dot)**.
Text on cards is a trivial CSS exercise; this gives you the **mechanism**: a
drum of flap cards per module, gravity releases with true perspective,
forward-only wrap-through cascades, chroma drums for rough images, and an
optional card-slap. Zero runtime deps.

```sh
yarn add @glowbox/split-flap
```

```ts
import { createSplitFlap } from '@glowbox/split-flap';

const board = createSplitFlap(canvas, { cols: 12, rows: 1, sound: true });
board?.setText('DEPARTURES');
```

Give it a canvas; it owns the 2D render, the flip animation, resize, and the
render loop — which runs **only while cards are in flight**; a resting board
costs nothing.

## What a text cross-fade can't do

- **Every character is two half-cards.** Each module is a drum of flaps hinged
  at the split line; a card carries the top half of one character on its front
  and the bottom half of the _next_ on its back. A flip is a **release, not a
  tween**: the catch lets go, the card falls under gravity (slow off the catch,
  accelerating, hard stop on the stack — with a settle bounce on the last flap
  of a run), and the next character's top half is already standing behind it.
- **The drum is a ratchet.** It only rotates forward: reaching an _earlier_
  character wraps through the whole flap sequence — the cascading rattle that
  IS the departure board. `charset` order is drum order.
- **True perspective.** The falling card renders as projected strips: its free
  edge swings toward the viewer and magnifies past the window near edge-on —
  the physical tell a flat scale-y squash can't fake.
- **The clack.** `sound: true` (or a `0..1` volume) synthesizes the card
  landing — a papery band-limited thud over a low stack thump, no pitched ping
  anywhere. Cascades collapse into a budgeted clatter instead of a buzz. Sound
  starts on the first user gesture (autoplay policy) and the AudioContext is
  not created until the page has seen one; survives tab hide/restore.

## Drums

The drum is a string — index order is flip order, one **grapheme** per flap
(katakana with a combining dakuten, or an emoji, is one card). Presets:
`DRUM_NORDIC` (default: A–Z ÅÄÖ, digits, `:./-?!()@,'&+`), `DRUM_ALNUM` (the classic
40-flap complement), `DRUM_DIGITS` (the dedicated time/track module — short
drum, snappy rollovers). Characters not on the drum display as blank; input is
NFC-normalised and uppercased as a fallback.

**Drum zones** put different drums at different locations — the way the real
boards were built, letter modules only where letters can appear:

```ts
const board = createSplitFlap(canvas, {
	cols: 20,
	rows: 8,
	charset: DRUM_NORDIC, // the board drum: destinations
	drums: [
		{ x: 0, y: 0, cols: 5, rows: 8, charset: DRUM_DIGITS }, // the time field
		{ x: 18, y: 0, cols: 2, rows: 8, charset: ' 0123456789' } // the track field
	]
});
```

A zone is a rectangle of modules (`cols`/`rows` default 1×1) carrying its own
flap sequence; later zones win overlaps, and a zone re-clips if the board is
re-tiled. The short field drum is the point: a minute rollover on `DRUM_DIGITS`
wraps in a couple of flips — on the full board drum it would cascade through
the whole alphabet first.

## Chroma drums — rough images

Real installations card their drums with solid colours and use a wall of
modules as a low-res screen. `palette` maps a flap's grapheme to paint:

```ts
import { chromaDrum, createSplitFlap, paletteFrame } from '@glowbox/split-flap';

const { charset, palette } = chromaDrum(); // grey ramp + 12 hues × 3 shades, serpentine
const wall = createSplitFlap(canvas, { cols: 40, rows: 20, charset, palette });
wall?.setText(paletteFrame(rgbPixels, 40, 20, palette)); // nearest-colour mapping
```

`chromaDrum({ hues, shades, grays })` scales from a monochrome drum
(`hues: 0`) to near-continuous colour; neighbouring colours are neighbouring
flaps, so gradients cost flips, not wraps. `paletteFrame` (pure, node-safe)
maps row-major RGB onto the drum, with optional Floyd–Steinberg dithering.

A palette entry can also be a **face spec** — `{ glyph, ink, paint }` — so one
drum can carry a dedicated re-inked flap (`x: { glyph: 'X', ink: 'red' }` for a
cancelled platform, or a whole word like `'DELAYED'` on a single card, the way
the real remark flaps were printed). A duplicated full alphabet in a second
colour is deliberately NOT the pattern: it doubles the drum and slows every
flip on the board.

## Options

| option       | default                | notes                                                       |
| ------------ | ---------------------- | ----------------------------------------------------------- |
| `cols, rows` | `12×1`                 | one destination line; tile bigger boards freely             |
| `charset`    | `DRUM_NORDIC`          | the drum — flap sequence in rotation order                  |
| `drums`      | —                      | drum zones: rectangles of modules with their own drum       |
| `palette`    | —                      | per-flap faces: paint (chroma) or `{ glyph, ink, paint }`   |
| `card`       | near-black             | flap plastic (any CSS string or `[r,g,b]` 0..1)             |
| `ink`        | warm white             | the printed characters                                      |
| `board`      | `'#0c0c0f'`            | the frame behind/between modules                            |
| `gap`        | `0.08`                 | cell fraction around each module                            |
| `font`       | Helvetica stack        | the letterform                                              |
| `shaded`     | `false`                | opt-in lighting: wells, hinge clips, the fallen pile, glint |
| `flipMs`     | `90`                   | one flap's fall (0 = instant; forced by reduced motion)     |
| `sound`      | off                    | `true` (= 0.5) or `0..1` volume                             |
| `pixelRatio` | `2`                    | cap on devicePixelRatio                                     |
| `label`      | `'split-flap display'` | `aria-label`; the shown text is appended; `''` hides        |

All options update live via `setOptions(patch)` — swapping
`charset`/`drums`/`palette` re-cards the modules in place. API: `setText(string | string[])`,
`setLine(row, text)`, `setChar(x, y, ch)`, `getChar`, `getText()`, `clear()`,
`cellAt(clientX, clientY)` (viewport point → module), `cellRect(x, y)` (module →
viewport rectangle of its card window), `resize()`, `snapshot()` (PNG data URL),
`dispose()` (hands the canvas back clean). The default look is **flat matte** — that's how the boards photograph;
`shaded: true` adds the full mechanical anatomy, matched against module
close-ups.

## Clickable modules

The board attaches no pointer handlers — it's a display — but it owns the
layout maths, so it answers the two geometry questions interaction needs:
`cellAt` maps a pointer event to a module, `cellRect` maps a module back to its
on-screen card window (for overlays and tooltips):

```ts
canvas.addEventListener('click', (e) => {
	const cell = board.cellAt(e.clientX, e.clientY);
	if (cell) board.setChar(cell.x, cell.y, '█'); // yours from here
});
```

Pair this with a tiny zone drum (`' ░█'`) and a column of modules becomes a
working scrollbar or selector — the thumb lands in a flip or two, because the
whole drum is three flaps.

Accessibility follows the same split. The board exposes itself as an **image**
(`role="img"`, with the shown text in the label — zone drums included, since
the label reads what the modules read), never as a widget: a canvas can't be
focused, arrow-keyed or announced. If you make modules interactive, the
semantics are yours — layer a real control over or beside the canvas (an
`<input type="range">` for the scrollbar column, a `<button>` for a tally
counter; `cellRect` gives you the exact place to put it) and pass `label: ''`
to hide the canvas when the control carries the same information.

## The sound engine

`createMechSound({ volume })` is exported on its own: a tiny mechanical-tick
synth over **one shared, refcounted AudioContext**. A tick is a resonant ping +
a band-shaped noise burst, all knobs per tick (`freq`, `decay`, `noise`,
`noiseHz`, `noiseLpHz`, `noiseDecay`, `gain`, `pan`, `delay`) — this copy
extends the flip-dot original with noise shaping, because a card slap is a
soft band-limited flutter, not a bright click.

## Performance

Card faces are baked half-sprites per character (lazily — a clock never pays
for the drum's unused letters); resting modules are two `drawImage` calls, and
the render loop stops when the last card lands. A 40×20 chroma wall (800
modules) cascades smoothly at dpr 2; the practical ceiling is a couple of
thousand modules.

---

Framework wrappers ship `<SplitFlap>` alongside the other cores:
**[@glowbox/svelte](https://www.npmjs.com/package/@glowbox/svelte)** ·
**[@glowbox/react](https://www.npmjs.com/package/@glowbox/react)** ·
**[@glowbox/vue](https://www.npmjs.com/package/@glowbox/vue)**. Pairs with
**[@glowbox/crt](https://www.npmjs.com/package/@glowbox/crt)**. Live demo:
<https://eetu.github.io/glowbox/splitflap> — turn the sound on, and give the
Chroma show a minute.
