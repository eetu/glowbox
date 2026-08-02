# @glowbox/extras

Content helpers for **[@glowbox/led-grid](https://www.npmjs.com/package/@glowbox/led-grid)** — the opt-in content layer the core
deliberately ships without. Headlined by a **GIF / image animation player**, a **text**
helper with a bundled **5×7 bitmap LED font**, a **text scroller** (marquee) and
**audio-reactive visualizers**. Each helper works with any wrapper: the players, the
scroller and the visualizers return a `DrawFn` (`(d, dt) => void`) draw callback;
`text()` draws once. They operate on the plain `VoxelGrid` / `LedDisplay`, so they also
run headlessly.

```sh
yarn add @glowbox/extras   # @glowbox/led-grid comes along
```

```ts
import { makeGifPlayer, makeImagePlayer, makeTextScroller, text } from '@glowbox/extras';

// Play a GIF on the front face of the grid:
display.onFrame(makeGifPlayer('/loop.gif', { plane: 'xy', fit: 'contain' }));

// …or a still image:
display.onFrame(makeImagePlayer('/logo.png', { fit: 'cover' }));

// …or a seamless text marquee:
display.onFrame(makeTextScroller('HELLO WORLD', { color: '#00e5ff' }));

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
`makeFramePlayer(frames, opts)` plays frames you already decoded (via `decodeGif` /
`framesFromBuffer`) — same callback, no fetch.

### Transport (`PlayerControls`)

Every player's draw callback doubles as a transport: `pause()` / `play()`, `seek(seconds)`,
a writable `rate` (1 = natural speed, negative plays backwards), a readonly `paused`, and
`ready` — a promise resolving `true` once decoded (`false` on a load failure, which only
warns; the callback just keeps drawing nothing). The still-image player accepts the same
calls as no-ops, so the two are interchangeable.

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

## Audio

Audio-reactive helpers over any WebAudio `AnalyserNode` — microphone, `<audio>` element,
or your own synth graph (this module never touches an `AudioContext` itself).

```ts
import { makeAudioBands, makeBarsVisualizer } from '@glowbox/extras';

const analyser = audioCtx.createAnalyser();
sourceNode.connect(analyser);
display.onFrame(makeBarsVisualizer(makeAudioBands(analyser)));
```

`makeAudioBands(analyser, opts)` distils the FFT into a few log-spaced, smoothed 0..1
bands. Options (`AudioBandsOptions`): `bands` (default 16), `minFreq` (40), `maxFreq`
(12000, clamped to Nyquist), `release` (0.72 — rises are instant, decays glide). The
returned `AudioBands` carries `bands` (a `Float32Array`), `level`, a decaying `peak`,
and `update()` — call it once per frame, unless a canned visualizer does it for you.

`makeBarsVisualizer(audio, opts)` (classic spectrum columns) and
`makeRadialVisualizer(audio, opts)` (spokes from the plane's centre) → a `DrawFn`.
Options (`VisualizerOptions`): `plane` / `depth` / `clear` as in `PlayerOptions`,
`gain` (default 1), and `color` — a `Color` or a `(band, height) => Color` for
gradients (default: a warm orange→pink ramp up each column).

## Building blocks

`sampleImageToGrid(src, nx, ny, fit)` (pure, no DOM) does the image → grid mapping.
`decodeGif(url)` / `framesFromBuffer(arrayBuffer)` decode a GIF to `GifFrame`s and
`frameAt(frames, tMs)` picks the frame for a playback time; `decodeImage(url)` decodes a
still image. `paintImage(grid, src, opts)` plots a decoded image onto a plane.
`FONT_5X7` / `glyph5x7(ch)` expose the bitmap font's metrics and per-character row
bitmasks. Reuse any of them for custom effects.

Wrappers: **[@glowbox/svelte](https://www.npmjs.com/package/@glowbox/svelte)** · **[@glowbox/react](https://www.npmjs.com/package/@glowbox/react)** ·
**[@glowbox/vue](https://www.npmjs.com/package/@glowbox/vue)**. Live demos: <https://eetu.github.io/glowbox/>.
