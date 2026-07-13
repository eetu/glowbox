# @glowbox/extras

Content helpers for **[@glowbox/led-grid](../led-grid)** — the opt-in content layer the core
deliberately ships without. Headlined by a **GIF / image animation player**, a **text**
helper with a bundled **5×7 bitmap LED font**, and a **text scroller** (marquee). Each
helper works with any wrapper: the players and the scroller return a `(d, dt) => void`
draw callback; `text()` draws once. They operate on the plain `VoxelGrid` /
`LedDisplay`, so they also run headlessly.

```sh
yarn add @glowbox/extras   # @glowbox/led-grid comes along
```

```ts
import { makeGifPlayer, makeImagePlayer, text } from '@glowbox/extras';

// Play a GIF on the front face of the grid:
display.onFrame(makeGifPlayer('/loop.gif', { plane: 'xy', fit: 'contain' }));

// …or a still image:
display.onFrame(makeImagePlayer('/logo.png', { fit: 'cover' }));

// …or draw text in your own frame callback:
display.onFrame((d) => {
	d.clear();
	text(d, 'HI', { color: '#00e5ff' });
});
```

With a framework wrapper, hand the callback to the `draw` prop:

```tsx
<LedGrid size={[32, 32, 8]} draw={makeGifPlayer('/loop.gif')} />
```

## Players

`makeImagePlayer(url, opts)` / `makeGifPlayer(url, opts)` → a draw callback. They load
asynchronously and draw nothing until ready; GIFs advance by their frame delays and
loop. GIF frames are decoded with [`gifuct-js`](https://github.com/matt-way/gifuct-js)
and composited (honouring frame disposal) into full RGBA snapshots.

### Options (`PlayerOptions`)

| option      | default     | notes                                                                |
| ----------- | ----------- | -------------------------------------------------------------------- |
| `plane`     | `'xy'`      | grid plane to paint on — `'xy'` (faces camera), `'xz'`, `'yz'`       |
| `depth`     | middle      | index on the plane's normal axis                                     |
| `fit`       | `'contain'` | aspect fit: `'contain'` (letterbox) · `'cover'` (crop) · `'stretch'` |
| `threshold` | `0.5`       | skip cells with coverage below this                                  |
| `gain`      | `1`         | multiply painted colour (`>1` blooms in the hologram style)          |
| `clear`     | `true`      | clear the grid before painting each frame                            |

## Text

`text(d, str, opts)` draws a string onto a grid plane. Two font paths:

- **`font: 'bitmap'`** _(default)_ — the bundled **5×7 dot-matrix LED font** (printable
  ASCII; unknown chars render a hollow box). Deterministic on every OS, DOM-free (runs
  headlessly in node), **multi-line** via `\n` (lines centred, 1-row gap), integer
  `scale` (default 1 → a 6×8-cell advance per character).
- **`font: 'system'`** — rasterize with the platform's bold sans-serif (browser-only,
  single line). `fontSize` (grid cells; default ~80% of the plane height) and
  `threshold` apply to this path.

Common options: `plane`, `depth`, `color` (a `Color`).
`measureText(str, scale?)` returns the bitmap ink box `{ width, height }` in cells.

## Scroller

`makeTextScroller(text, opts)` → a draw callback that scrolls a message across a plane,
wrapping seamlessly (message + `gap` blank columns tile end to end). `text` may be a
string **or a getter** (`() => string`) so a live UI can retype without recreating.

| option                      | default        | notes                                                            |
| --------------------------- | -------------- | ---------------------------------------------------------------- |
| `font`                      | `'bitmap'`     | `'bitmap'` (bundled 5×7) · `'system'` (rasterized, browser-only) |
| `color`                     | white          | a `Color`, or `(column, elapsed, width) => Color` for gradients  |
| `speed`                     | `10`           | cells per second                                                 |
| `gap`                       | glyph height   | blank columns between repeats                                    |
| `scale`                     | `1`            | bitmap pixel scale                                               |
| `fontFamily`                | sans-serif     | system font family — string or getter                            |
| `fontSize`                  | ~85% of height | system font size in cells                                        |
| `plane` / `depth` / `clear` | —              | as in `PlayerOptions`                                            |

## Building blocks

`sampleImageToGrid(src, nx, ny, fit)` (pure, no DOM) does the image → grid mapping.
`decodeGif(url)` / `framesFromBuffer(arrayBuffer)` decode a GIF to `GifFrame`s and
`frameAt(frames, tMs)` picks the frame for a playback time; `decodeImage(url)` decodes a
still image. `paintImage(grid, src, opts)` plots a decoded image onto a plane.
`FONT_5X7` / `glyph5x7(ch)` expose the bitmap font's metrics and per-character row
bitmasks. Reuse any of them for custom effects.

Wrappers: **[@glowbox/svelte](../svelte)** · **[@glowbox/react](../react)** ·
**[@glowbox/vue](../vue)**. Live demos: <https://eetu.github.io/glowbox/>.
