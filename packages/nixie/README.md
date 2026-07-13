# @glowbox/nixie

A **nixie-tube display component** — a sibling rendering core to
**[@glowbox/led-grid](../led-grid)**'s LED grid. It renders a single glowing numeral the way a
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
is just a **row of tubes** (one component per canvas).

## Value

A single symbol per tube: a char `0`–`9`, `:`, `-`, or `null` / `''` for all-cathodes-dark.
`setValue(v)` relights it live.

## Options

| option       | default     | notes                                                             |
| ------------ | ----------- | ----------------------------------------------------------------- |
| `value`      | —           | the lit symbol (see above)                                        |
| `style`      | `'classic'` | physical tube numeral shape: `'classic'` · `'slim'` · `'tall'`    |
| `color`      | warm orange | glow colour — a `Color` (`[r,g,b]` 0..1 or any CSS string)        |
| `glow`       | `0.7`       | glow strength 0..1                                                |
| `background` | near-black  | tube glass colour behind the numerals                             |
| `mesh`       | `true`      | draw the honeycomb anode mesh over the tube                       |
| `ghost`      | `true`      | draw the other, unlit cathodes faintly behind — the stacked depth |
| `pixelRatio` | `2`         | cap on devicePixelRatio                                           |
| `bare`       | `false`     | contents only, transparent canvas (no glass) — for 3D/compositing |
| `label`      | lit symbol  | accessible name (`aria-label`); a blank unlabelled tube is hidden |

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

## Methods

`setValue(v)`, `setOptions(patch)`, `resize()` (after the canvas box changes),
`snapshot(): string` (PNG data URL), `dispose()`.

Part of the **glowbox** family of glowing retro displays — see
**[@glowbox/led-grid](../led-grid)** (3D LED grid). Live demos:
<https://eetu.github.io/glowbox/>.
