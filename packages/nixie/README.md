# @glowbox/nixie

A **nixie-tube display component** — a sibling rendering core to
**[@glowbox/core](../core)**'s LED grid. It renders a single glowing numeral the way a
real nixie works: a stack of bent-wire cathodes inside a glass tube, only one lit. Each
digit is a thin geometric **filament** (a single-stroke vector wire) that glows
warm-orange with a hot core, in front of the full stack of unlit dull-metal cathode
wires nested behind the honeycomb anode mesh. Zero runtime deps (it borrows only core's
tree-shaken colour helper).

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

## Methods

`setValue(v)`, `setOptions(patch)`, `resize()` (after the canvas box changes),
`snapshot(): string` (PNG data URL), `dispose()`.

Part of the **glowbox** family of glowing retro displays — see
**[@glowbox/core](../core)** (3D LED grid). Live demos:
<https://eetu.github.io/glowbox/>.
