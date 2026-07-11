# @glowbox/extras

Content helpers for **[@glowbox/core](../core)** — the opt-in content layer the core
deliberately ships without. Headlined by a **GIF / image animation player**, plus a
**text** helper. Each helper works with any wrapper: the players return a
`(d, dt) => void` draw callback; `text()` draws once. They operate on the plain
`VoxelGrid` / `LedDisplay`, so they also run headlessly.

```sh
yarn add @glowbox/extras   # @glowbox/core comes along
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

`text(d, str, opts)` rasterizes `str` with the system sans-serif and threshold-samples
it onto a grid plane. Options: `plane`, `depth`, `threshold`, `color` (a `Color`), and
`fontSize` (grid cells; default ~80% of the plane height). No font asset.

## Building blocks

`sampleImageToGrid(src, nx, ny, fit)` (pure, no DOM) does the image → grid mapping.
`decodeGif(url)` / `framesFromBuffer(arrayBuffer)` decode a GIF to `GifFrame`s and
`frameAt(frames, tMs)` picks the frame for a playback time; `decodeImage(url)` decodes a
still image. `paintImage(grid, src, opts)` plots a decoded image onto a plane. Reuse any of
them for custom effects.

Wrappers: **[@glowbox/svelte](../svelte)** · **[@glowbox/react](../react)** ·
**[@glowbox/vue](../vue)**. Live demos: <https://eetu.github.io/glowbox/>.
