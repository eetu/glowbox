# @glowbox/lcd

A character **LCD module** (HD44780-class — the 16×2) as a canvas component: the
glowbox family's first **reflective** display. Dark ink on a lit pane, native to a
light page the way every emissive sibling is native to a dark one. Zero dependencies.

The reason it exists is the **liquid crystal**, not the character grid (a div grid and
an LCD webfont render the layout for free):

- **A dot is a shutter, and shutters are slow.** Every dot chases its target over real
  tens of milliseconds — rise faster than fall, so moving text drags a trailing ghost.
  Cutting the power doesn't blank the glass; the ink drains out at crystal speed.
- **The contrast pot is a knob, not a colour.** Too low sinks the ink into the ghost
  lattice; overdriving past ~0.85 raises the undriven dots and grows passive-matrix
  **crosstalk** — faint streaks down heavily driven columns, exactly what twisting the
  trimmer too far does.
- **Boot is the uninitialised controller**: power-up shows the top row as solid blocks
  for a moment — the most recognisable 16×2 symptom there is.
- **CGRAM**: 8 custom glyph slots (`setGlyph`), addressed from text by code points 0–7,
  5×8 like the hardware — the bar-chart/animation party trick.
- **`age`** runs the family wear arc at column-driver granularity: dimming, then a
  flickering column, then a dead blank stripe of bare lattice.

```sh
yarn add @glowbox/lcd
```

```ts
import { createLcdModule } from '@glowbox/lcd';

const lcd = createLcdModule(canvas, { cols: 16, rows: 2, text: 'HELLO\nWORLD' });
lcd?.setLine(1, 'READY>');
lcd?.setCursor(6, 1);
lcd?.setOptions({ cursor: 'block' });
```

## Options

| option       | default         | notes                                                                                          |
| ------------ | --------------- | ---------------------------------------------------------------------------------------------- |
| `cols`       | `16`            | character columns                                                                              |
| `rows`       | `2`             | character rows                                                                                 |
| `text`       | `''`            | `'\n'` splits rows, or one string per row; truncated/padded to the grid                        |
| `panel`      | `'green'`       | `'green'` (STN, readable unlit) · `'blue'` (negative — needs its backlight) · `'white'` (FSTN) |
| `backlight`  | `true`          | `true`/`false` or a 0..1 level; on the blue glass it IS the image                              |
| `contrast`   | `0.8`           | the trimmer 0..1; past ~0.85 the lattice darkens and crosstalk streaks grow                    |
| `response`   | `0.4`           | liquid-crystal speed 0..1 (≈100 ms rise); 0 snaps, 1 is cold glass                             |
| `ghost`      | `true`          | the resting dot lattice                                                                        |
| `cursor`     | `'none'`        | `'line'` (steady underline) · `'block'` (blinking); position via `setCursor`                   |
| `age`        | `0`             | wear 0..1: dim → flickering column → dead column                                               |
| `glyphs`     | —               | extension face over the vendored ASCII font (see below); `null` resets                         |
| `on`         | `true`          | power; off drains the ink, then the pane sits unlit                                            |
| `boot`       | `true`          | the uninitialised boot row (skipped under reduced motion)                                      |
| `bezel`      | dark plastic    | `Color`; a frame hugging the glass (spare canvas stays transparent); `null` = no plastic       |
| `pixelRatio` | `2`             | cap on `devicePixelRatio`                                                                      |
| `label`      | `'lcd display'` | accessible name (`aria-label`); the shown text is appended; `''` hides                         |

Colours are the family `Color` (`[r,g,b]` 0..1 or any CSS string). Every option is
live-updatable via `setOptions(patch)`.

## Handle

`setText(text)` / `setLine(row, text)` / `setGlyph(slot, rows)` / `setCursor(col, row)`
/ `power(on)` drive the module; `cellAt(clientX, clientY)` and `cellRect(x, y)` expose
the layout maths (viewport coordinates — the family hit-test pair); `setOptions`,
`resize`, `snapshot()` (PNG data URL) and `dispose()` are the family contract. The
canvas gets `role="img"` and an `aria-label` that reads what the module says.

### Custom glyphs (CGRAM)

```ts
// A bar-chart glyph in slot 0: 8 rows of 5-bit masks, bit 4 = leftmost dot.
lcd.setGlyph(0, [0, 0, 0, 0b11111, 0b11111, 0b11111, 0b11111, 0]);
lcd.setText('LEVEL ' + '\u0000'.repeat(5)); // text addresses CGRAM by code point
```

### Extension faces (`glyphs`)

The vendored face covers printable ASCII (`repertoire5x7()` lists it). Teach the
module more by injecting a glyph table — character → 5×7 ASCII art (`'#'` = ink,
7 rows of 5), the face's own authoring format:

```ts
import { createLcdModule, LATIN_5X7 } from '@glowbox/lcd';
createLcdModule(canvas, { glyphs: LATIN_5X7 }); // Å Ä Ö å ä ö Ø ø Æ æ Ü ü ß É é Ñ ñ Ç ç °
```

`LATIN_5X7` is the Western-European/Nordic table — the A02 ROM's territory (the
ubiquitous A00 ROM had katakana here and no accents at all; that's what CGRAM was
for). It ships in the package but tree-shakes away unless imported. CGRAM code
points 0–7 always win over injected glyphs; patch `glyphs: null` to hand back the
plain face. Author your own table in the same art format (`compile5x7` gives the
raw masks if you need them).

## No sound

An LED-backlit module is silent — like the vfd, this core ships no sound module. (The
EL-inverter whine of older glass is a niche for the day someone misses it.)

Wrappers: **[@glowbox/svelte](https://www.npmjs.com/package/@glowbox/svelte)** ·
**[@glowbox/react](https://www.npmjs.com/package/@glowbox/react)** ·
**[@glowbox/vue](https://www.npmjs.com/package/@glowbox/vue)**. Live demo:
<https://eetu.github.io/glowbox/>.
