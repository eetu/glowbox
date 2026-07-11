# @glowbox/core

Framework-agnostic **3D LED-grid display** — an nx×ny×nz lattice of glowing
"LEDs" you draw on like a tiny 3D canvas, rendered in WebGL and orbitable
(auto-spin + drag + zoom). Zero dependencies.

```sh
yarn add @glowbox/core
```

```ts
import { createLedDisplay } from '@glowbox/core';

const d = createLedDisplay(canvas, {
	size: [8, 8, 8],
	led: { glow: 3, offColor: '#0a0a12' },
	color: { background: '#000', gain: 1.1 },
	camera: { autoOrbit: true },
	interaction: { zoom: true }
});
d?.onFrame((d, dt) => {
	d.clear();
	d.sphere([4, 4, 4], 3, '#00aaff'); // filled=false → a hollow shell
	d.plot(2, 5, 1, [1.4, 0.8, 0]); // array form; >1 blooms
});
```

The display owns the WebGL render, orbit, zoom, resize and the animation loop —
you just write voxels each frame. It holds **no** content of its own.

## Colours

Everywhere a colour is accepted (`background`, `offColor`, `tint`, and every draw
call) the type is `Color`:

- `[r, g, b]` numbers in `0..1` — values `>1` are **extra-bright** (more bloom / HDR headroom).
- any CSS string — `'#0a0a12'`, `'#f80'`, `'rgb(0 128 255)'`, `'tomato'`, `'hsl(…)'`.
  (Strings are `0..255` → `0..1`, so only the array form can exceed 1.)

**Unlit LEDs** draw nothing by default (`offColor` is black) — only lit LEDs show,
so the display reads as floating light with no dark lattice. To hint the physical
grid, set `offColor` to a faint colour: it renders a tiny speck (`led.offSize`,
default 0.35 of the glow) at each off node, the size of a real LED package.

## Rendering (`led.style`)

Two looks, both reading on **any** background (dark or light):

- **`hologram`** _(default)_ — LEDs as real emitters: each lit LED is a bright point
  with a soft glow **halo**, tone-mapped and composited _in front of_ the background.
  Internally an HDR (half-float) bloom pipeline (emissive → blur → ACES tone-map →
  over-composite), falling back to an LDR over-composite when the half-float WebGL
  extensions are unavailable.
- **`comic`** — flat **cel-shaded** pop-art: each lit LED is a solid disc (or square)
  with an optional bold ink outline — a comic-book / Ben-Day look. Brightness is
  posterized into a few bands (keeping each LED's hue **and** relative brightness), so
  tonal content — images, fading trails — reads faithfully. Set `led.vivid` for the
  punchy flat variant instead: every lit LED at the **full value** of its hue (dim
  voxels read vivid) — great for bold graphic content. Opaque and depth-tested; pairs
  well with a light "paper" background.

`glow`/`offColor`/`offSize` apply to the hologram style; `outline`/`outlineColor` to
`comic`. `shape: 'square'` makes LEDs tile gap-free (no bg between them); `'round'` is
the dotty LED-grid look.

**Performance.** Only **lit** voxels are packed and drawn each frame, so cost scales
with how many LEDs are _on_, not with the grid volume — a thin shape in a huge grid
stays cheap. (Setting `offColor` to a non-black lattice necessarily draws every node,
so leave it black for big sparse grids.) The `display.stats` object exposes live
`fps` / `frameMs` / `drawMs` / `renderMs` for profiling.

## Voxel API

`plot / add / get / clear / fill / line / box / sphere`, plus `index` / `inBounds`
and the raw `leds` `Float32Array`. `sphere`/`box` take a `filled` flag (shell/edges
otherwise). Draw voxels headlessly with `createVoxelGrid(nx, ny, nz)` — same API,
no canvas.

## Options (all optional except `size`)

| group         | fields (defaults)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `led`         | `style` `'hologram'\|'comic'` · `shape` `'round'\|'square'` · `stagger` (false; brick lattice — offset every other row half a cell, also cuts moiré) · `rgb` (false; render each LED as R/G/B sub-emitters) · `rgbLayout` (`auto`\|`triad`\|`quad`\|`stripe`; sub-die packing) · `vivid` (false; comic: flat full-value pop-art vs cel-shade) · `outline` (0.25; comic ink border, 0 = off) · `outlineColor` (dark) · `size` (0.6) · `glow` (2.2) · `offColor` (black = no lattice; set faint to hint the grid) · `offSize` (0.35) |
| `color`       | `background` (`[.01,.01,.02]`) · `gain` (1) · `tint` (`[1,1,1]`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `camera`      | `yaw`/`pitch` (.6/.4) · `distance` (3.6) · `fov` (.9) · `projection` `'perspective'\|'orthographic'` · `autoOrbit` (true) · `orbitSpeed` (.45) · `pitchLimits` (±1.4)                                                                                                                                                                                                                                                                                                                                                              |
| `interaction` | `drag` (true) · `dragSpeed` (.01) · `zoom` (false) · `zoomLimits` (`[1.5,10]`)                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `quality`     | `pixelRatio` (2) · `antialias` (true) · `paused` (false) · `fps` (uncapped; cap the loop — see below)                                                                                                                                                                                                                                                                                                                                                                                                                              |

## Display methods

`onFrame(cb) → stop()`, `render()`, `setGain(g)`, `setPaused(b)` (freeze → render
on demand), `setOptions(patch)` (live-update anything but `size`), `setCamera({yaw,
pitch,distance})`, `resize(size?)`, `snapshot(): string` (PNG data URL — for previews /
LED-cube frame export), `dispose()`.

**Frame-rate cap.** `quality.fps` limits the render loop (e.g. `{ quality: { fps: 30 } }`);
omit it for the display's native refresh rate. It's a **power / cadence** knob — lower it
for an always-on ambient display to cut GPU/battery, or match a hardware LED-cube's
refresh rate. It is _not_ a speed-up: each frame still costs the same, so it won't rescue a
GPU-bound scene (watch `display.stats.fps` for the actual rate).

`resize()` recomputes the drawing buffer from the canvas box; `resize([nx, ny, nz])`
also **changes the grid size in place** — reallocating on the same canvas (no context
loss), preserving camera + options. The display also **recovers from WebGL context
loss** on its own (tab backgrounded, driver reset): it rebuilds the renderer on restore
and repaints your content.

Framework wrappers build on this core — see **[@glowbox/svelte](../svelte)**,
**[@glowbox/react](../react)** and **[@glowbox/vue](../vue)**; content helpers (GIF /
image / text) live in **[@glowbox/extras](../extras)**. Live demos:
<https://eetu.github.io/glowbox/>.
