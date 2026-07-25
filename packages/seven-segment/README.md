# @glowbox/seven-segment

A **seven-segment display component** — a sibling rendering core to
**[@glowbox/nixie](https://www.npmjs.com/package/@glowbox/nixie)**'s tube and
**[@glowbox/led-grid](https://www.npmjs.com/package/@glowbox/led-grid)**'s LED grid. A
font can give you the static shapes; this gives you the segment as a **physical light
source**: per-segment cross-fades, ageing down to a dead segment, and real display
materials. Zero runtime deps.

```sh
yarn add @glowbox/seven-segment
```

```ts
import { createSevenSegment } from '@glowbox/seven-segment';

const digit = createSevenSegment(canvas, { value: 7, style: 'vfd' });
digit?.setValue(8);
```

Give it a canvas + a value; it owns the 2D render, glow, transitions, and resize. A
clock or counter is a **row of digits** (one per canvas) — put the `':'` separator in a
narrower slot.

## What a font can't do

- **Per-segment dynamics.** A value change cross-fades each segment individually with a
  small per-segment stagger, so digits smear the way real multiplexed hardware does
  (`transition` ms, default 90; instant under `prefers-reduced-motion`). The render
  loop runs only while something is moving.
- **Ageing.** `age: 0..1` applies a deterministic per-instance wear fingerprint — every
  digit ages differently. Segments dim unevenly; past `~0.7` the most-worn segment
  starts **dying** (sparse flicker dips, scheduled by timeouts — an idle display costs
  nothing); from `~0.95` it is **permanently dead**, only its dark ghost body left,
  while the runner-up takes over the flickering. Decorative by design: a fully aged `8`
  reads as a `6`, exactly like the real broken sign.
- **Materials.** `style: 'led'` (default) is the classic red-orange emitter behind a
  smoked window — unlit segment ghosts, vignette, rim. `style: 'vfd'` is vacuum-
  fluorescent phosphor: cyan-green with a whiter hot core, a wider halo, and the fine
  anode-grid mesh over the window.

## Value

`0`–`9`, `-`, hex `A b C d E F` (case-tolerant), `:` (the two-dot clock separator —
fits by height, so a slim slot keeps full-size dots), or `null` / `''` for all dark.
`dp: true` lights the decimal point. Longer strings truncate to the first character
(with a one-time console warning) — compose a row for multi-digit values.

## Options

| option       | default    | notes                                                      |
| ------------ | ---------- | ---------------------------------------------------------- |
| `value`      | `null`     | the shown symbol (see above)                               |
| `dp`         | `false`    | light the decimal point                                    |
| `style`      | `'led'`    | `'led'` \| `'vfd'`                                         |
| `color`      | per style  | segment colour (any CSS string or `[r,g,b]` 0..1)          |
| `background` | per style  | window tint                                                |
| `glow`       | `0.7`      | 0..1 halo strength                                         |
| `ghost`      | `true`     | show unlit segments as dark bodies                         |
| `age`        | `0`        | wear 0..1 (dimming → flicker → dead segment)               |
| `transition` | `90`       | per-segment cross-fade ms (0 = instant)                    |
| `pixelRatio` | `2`        | cap on devicePixelRatio                                    |
| `label`      | the symbol | `aria-label`; a blank, unlabelled display is `aria-hidden` |

All options update live via `setOptions(patch)`; `setValue(v)` re-lights. Methods:
`resize()`, `snapshot()` (PNG data URL), `dispose()`.

## 3D / compositing

Like nixie's `nixieCathodes`, the geometry is exportable — the core stays 2D, no
3D-engine dependency: **`segmentGeometry()`** returns the seven named outline polygons
plus the decimal-point circle in the **`SEGMENT_VIEWBOX`** (60×100, y-down, un-slanted
— apply **`SEGMENT_SLANT`** as an x-shear for the italic); **`litSegments(symbol)`**
tells you which named segments to light. Extrude the polygons into prisms and you have
a real 3D module.

---

Framework wrappers ship `<SevenSegment>` alongside `<LedGrid>` + `<NixieTube>`:
**[@glowbox/svelte](https://www.npmjs.com/package/@glowbox/svelte)** ·
**[@glowbox/react](https://www.npmjs.com/package/@glowbox/react)** ·
**[@glowbox/vue](https://www.npmjs.com/package/@glowbox/vue)**. Live demo:
<https://eetu.github.io/glowbox/> (the `/seven` clock).
