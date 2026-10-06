# @glowbox/nixie

A **nixie-tube display component** — a sibling rendering core to
**[@glowbox/led-grid](https://www.npmjs.com/package/@glowbox/led-grid)**'s LED grid. It renders a single glowing numeral the way a
real nixie works: a stack of bent-wire cathodes inside a glass tube, only one lit. Each
digit is a thin geometric **filament** (a single-stroke vector wire) that glows
warm-orange with a hot core, in front of the full stack of unlit dull-metal cathode
wires nested behind the honeycomb anode mesh. Zero runtime deps.

```sh
yarn add @glowbox/nixie
```

```ts
import { createNixieTube } from '@glowbox/nixie';

const tube = createNixieTube(canvas, { value: 7, style: 'classic', glow: 0.8 });
tube?.setValue(8);
```

Give it a canvas + a value; it owns the 2D render, glow, and resize. A clock or counter
is just a **row of tubes** — and the row is built in too:

```ts
import { createNixieRow } from '@glowbox/nixie';

const row = createNixieRow(container, { value: '12:34:56' });
setInterval(() => row?.setValue(new Date().toTimeString().slice(0, 8)), 250);
```

## Value

A single symbol per tube: a char `0`–`9`, `:`, `.`, `-`, or `null` / `''` for
all-cathodes-dark. `setValue(v)` relights it live. A longer string is truncated to its
first character (with a one-time console warning) — use `createNixieRow` for multi-digit
values.

## Row

`createNixieRow(container, opts)` lights **one tube per character** of `value`
(`'12:34'`, `'3.14'`, `'-42'`) inside any block element, with the narrow separators
(`:` `.` `-`) in slimmer slots. The row owns slot sizing — tubes fill the container
height at a digit aspect and shrink to fit its width — and reads to assistive tech as
**one** image (`aria-label` = the whole string), not one per tube. All appearance options
below apply and fan out live via `setOptions`; row extras: `gap` (px between tubes,
default 6), `digitAspect` (digit width:height, default 0.56), `separatorScale`
(separator slot width as a fraction of a digit's, default 0.47), and `label` (row
`aria-label`, defaults to the value). `setValue` with the same string length relights
tubes in place (a ticking clock never recreates canvases); `tubes` exposes the live
`NixieTube`s; `dispose()` removes everything it added.

## Options

| option       | default     | notes                                                              |
| ------------ | ----------- | ------------------------------------------------------------------ |
| `value`      | —           | the lit symbol (see above)                                         |
| `style`      | `'classic'` | physical tube numeral shape: `'classic'` · `'slim'` · `'tall'`     |
| `color`      | warm orange | glow colour — a `Color` (`[r,g,b]` 0..1 or any CSS string)         |
| `glow`       | `0.7`       | glow strength 0..1                                                 |
| `background` | near-black  | tube glass colour behind the numerals                              |
| `mesh`       | `true`      | draw the honeycomb anode mesh over the tube                        |
| `ghost`      | `true`      | draw the other, unlit cathodes faintly behind — the stacked depth  |
| `wire`       | dull nickel | unlit cathode-wire colour (the filament stack behind the glass)    |
| `theme`      | `'dark'`    | `'light'` / `'auto'` bundle the colour defaults (see Themes below) |
| `pixelRatio` | `2`         | cap on devicePixelRatio                                            |
| `bare`       | `false`     | contents only, transparent canvas (no glass) — for 3D/compositing  |
| `label`      | lit symbol  | accessible name (`aria-label`); a blank unlabelled tube is hidden  |

All update live via `setOptions(patch)`.

## Sizing & backgrounds

The render is **size-adaptive**: at large sizes you get the full illusion (a thin
filament under a heavy bloom, behind the honeycomb mesh and the nested cathode stack); as
the tube shrinks it switches methods rather than forcing a sub-pixel wire to survive its
own blur — dropping the stack, then the bloom passes, and fattening the wire, so a tiny
tube stays a legible bold glyph. The tube draws as a rounded glass module that casts a
soft drop shadow into a transparent margin, so it floats correctly on **any** backdrop —
including light/white pages. (A bloom can't read against white, so the glass itself stays
dark; the shadow + glass rim, not a light glass, are what let it sit right on a light
surface.) `color` and `background` retint the glow and glass together (e.g. a blue tube:
`{ color: '#57b6ff', background: '#04121f' }`), and the vignette rim follows the glass
tint instead of going pure black.

## 3D / compositing

nixie stays 2D and depends on no 3D engine, but exposes everything a 3D scene needs so you
only supply the glass + effects. Build a real bent-wire tube (reads from **every** angle,
spins a full 360° — unlike a flat plane that thins out edge-on):

- **`nixieCathodes()`** → the full digit stack `0`–`9` in physical front→back order, each
  `{ symbol, path, depth, offset }`. Extrude every cathode's `path` at its `depth` (as a z
  offset) and light the one matching the current value — so the whole stack is present and
  one numeral glows among the rest.
- **`nixieStyle(style)`** → `{ squash: [x, y], strokeWidth }` — the tube's proportions and
  filament gauge (use `strokeWidth` as the wire diameter so 3D matches 2D).
- **`nixieMesh(w, h)`** → the honeycomb anode-grille cells (`{ radius, cells }`) over a
  `w`×`h` face, to build the grille in front of the stack.
- **`glyphPath(symbol)` / `GLYPH_VIEWBOX`** → the raw SVG centreline (`d`) for one symbol
  (e.g. the `:` / `-` separators) and its coordinate space (`{ width: 60, height: 100 }`,
  y-down). **`NIXIE_WIRE_COLOR`** is the dull-nickel colour for the unlit cathodes.
- **`{ bare: true }`** (an option, not a helper) renders a tube's glowing contents on a
  **transparent** canvas — no glass module — for texturing onto a plane; straight
  (un-premultiplied) alpha, `mesh` / `ghost` independent.

```ts
import { nixieCathodes, nixieStyle, GLYPH_VIEWBOX } from '@glowbox/nixie';

for (const { symbol, path, depth } of nixieCathodes()) {
	// extrude `path` (in GLYPH_VIEWBOX coords) → your tube geometry, place at z = f(depth)
}
```

The Svelte gallery's `/nixie` route has a 2D/3D toggle whose 3D scene is built entirely
from these (three.js owns only the glass cylinder + bloom).

## Pixel tubes

For a game drawing into its own low-resolution raster, the tubes come as **whole-pixel
rects**: the canvas tube's own wires, a pixel wide (two from 48 px tall), each glyph's
extremes snapped to whole pixels, unbroken at every height. It reads as a nixie from
16 px, where the ghost stack shows as wire behind the lit one. 11 px is a hand-drawn
fallback: legible digits, the stack a smudge. **`nixiePixelText(text, { height, gap,
colon, wire })`** lays out a row, one tube per character: a digit tube is its ten cathodes
front to back as parts `{ index, symbol, depth, rects, on }`, the lit one `on` and the
others the ghosts to paint dim (farther by `depth`, as the canvas does); `:` `.` `-` are
separator tubes, one part as wide as its ink. Each pixel belongs to one part, so they paint
in any order. **`nixiePixels(symbol, height)`** is one tube. **`nixieLevels(layout, { age,
seed, t })`** gives each part's light at `t`, 0 a ghost … 1 lit: the cathodes age, the
most-worn one flickers past 0.7 and dies at 0.95, seeded so a world that rewinds sees the
same flicker. The shape (`PixelLayout` of `PixelPart`s) is the one every glowbox core
shares for pixel data.

```ts
import { nixieLevels, nixiePixelText } from '@glowbox/nixie';

const row = nixiePixelText('12:34', { height: 16, colon: blinkOn }); // once per change
const levels = nixieLevels(row, { age: 0.3, seed: 7, t }); // every frame
row.parts.forEach(({ rects, depth }, i) => {
	const ink = levels[i] > 0 ? glow(levels[i]) : ghost(depth);
	for (const r of rects) fill(ink, x0 + r.x, y0 + r.y, r.w, r.h);
});
```

## Methods

`setValue(v)`, `setOptions(patch)`, `resize()` (after the canvas box changes),
`snapshot(): string` (PNG data URL), `dispose()`.

## Themes

`theme` bundles the housing: `'dark'` (the default), `'light'`, or `'auto'` to follow the
page's `prefers-color-scheme`.

A lit numeral needs dark glass to bloom against, so a nixie tube is a **dark object in
both themes** — what the light theme changes is the hardware around the glass: a heavier
drop shadow and a brighter rim, so the tube sits on a pale page instead of floating on
it. `background` and `wire` stay yours to set.

Part of the **glowbox** family of glowing retro displays — see
**[@glowbox/led-grid](https://www.npmjs.com/package/@glowbox/led-grid)** (3D LED grid). Live demos:
<https://eetu.github.io/glowbox/>.
