# @glowbox/crt

A **composable CRT screen** for any canvas — the glowbox family's first _effects
layer_. The display cores render physically honest objects (a glass tube, an LED
module); this renders **watching one through a curved phosphor screen**. It wraps any
canvas — a glowbox display, a whole clock row, a chart, your game — and is transparent
to interaction. Zero runtime deps.

```sh
yarn add @glowbox/crt
```

```ts
import { createCrtScreen } from '@glowbox/crt';

// Slap it over a whole element — mounts itself, done:
const crt = createCrtScreen(clockDiv, { persistence: 0.5 });

// …or wrap a single canvas and place the output yourself (low-level mode):
const crt2 = createCrtScreen(myCanvas);
somewhere.appendChild(crt2.canvas);
```

## Element mode — slap it over anything

Pass a container element and the screen does all the ceremony: mounts its output over
the container (promoting it to `position: relative` only if it was static), finds every
descendant canvas and **composites them at their layout positions each frame** (slots
added/removed later are picked up automatically — a rebuilding `createNixieRow` just
keeps working), hides the originals while keeping them laid out (their own
ResizeObservers stay alive), and **forwards pointer + wheel events** to the child
canvas under the cursor — drag-orbit and zoom work straight through the tube.
`dispose()` hands everything back exactly as found.

Your CSS survives around and behind the tube: **outside the curved face the output is
transparent** (the container's background, borders, and radius show around the tube),
and the **face floor defaults to the container's computed background colour** (override
with `background`). The one real limit: it composites _canvases_ — non-canvas
_children_ (text labels, styled divs between the canvases) are not captured; it's a
compositor, not a screenshotter.

## The artifacts

All 0..1 knobs, live-updatable via `setOptions`:

| knob          | default      | what it is                                                                  |
| ------------- | ------------ | --------------------------------------------------------------------------- |
| `curvature`   | `0.35`       | barrel distortion of the tube face (real resampling, black beyond the face) |
| `scanlines`   | `0.45`       | raster lines, following the content rows through the curve                  |
| `mask`        | `0.2`        | RGB phosphor stripe mask (screen space)                                     |
| `persistence` | `0.3`        | **phosphor decay from real frame history** — moving content ghosts          |
| `convergence` | `0.35`       | R/G/B gun misalignment, worsening toward the edges                          |
| `vignette`    | `0.4`        | corner darkening                                                            |
| `flicker`     | `0.15`       | mains brightness wobble                                                     |
| `band`        | `0.12`       | slow rolling refresh band                                                   |
| `noise`       | `0.08`       | static                                                                      |
| `gain`        | `1.08`       | brightness compensation (the mask/scanlines eat some light)                 |
| `background`  | container bg | the face floor behind sparse content (any CSS colour)                       |
| `events`      | `true`       | forward pointer/wheel to the source                                         |
| `pixelRatio`  | `2`          | cap on devicePixelRatio                                                     |

`prefers-reduced-motion` freezes the temporal artifacts (flicker, band, noise
animation) and disables persistence. The output canvas is `aria-hidden` — it is a
visual duplicate; your source keeps the accessible semantics.

## Performance

One texture upload + two fullscreen passes per frame: **≈1 ms/frame at 1080p on an
Apple M1** (measure your own with `scripts/bench-crt.mjs` in the repo); element-mode
compositing of a multi-canvas row is ~free. The render loop is the effect's own rAF —
it pauses with the tab.

---

Pairs with every display core:
**[@glowbox/led-grid](https://www.npmjs.com/package/@glowbox/led-grid)** ·
**[@glowbox/nixie](https://www.npmjs.com/package/@glowbox/nixie)** ·
**[@glowbox/seven-segment](https://www.npmjs.com/package/@glowbox/seven-segment)**.
No framework wrapper needed — element mode is one call from any framework. Live demo:
<https://eetu.github.io/glowbox/> (the CRT toggles on the LED gallery and `/seven`).
