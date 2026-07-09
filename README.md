# voxl

A generic **3D LED-grid display** — an nx×ny×nz lattice of glowing "LEDs" you
draw on like a tiny 3D canvas, rendered in WebGL and orbitable. Plus a demo
gallery of example programs (a spinning torus, a self-playing 3D Pac-Man).

Part of eetu's homebrew family: a Rust (axum) binary embeds a Svelte SPA and
ships as one small arm64 container.

## The library

`frontend/src/lib/led-grid` — framework-agnostic core + a Svelte wrapper. The
display owns rendering, orbit, resize and the animation loop; you just draw
voxels each frame:

```ts
import { createLedDisplay } from "$lib/led-grid"; // or the <LedGrid> Svelte wrapper
const d = createLedDisplay(canvas, { size: [8, 8, 8] });
d.onFrame((d, dt) => {
  d.clear();
  d.sphere([4, 4, 4], 3, [0, 0.6, 1]);
  d.plot(2, 5, 1, [1, 0.8, 0]);
});
```

Colours are `[r, g, b]` in 0..1 (values >1 bloom). API: `plot / add / get /
clear / fill / line / box / sphere`, plus the raw `leds` buffer for power users.

The library ships **no programs** — content lives with the consumer (see
`frontend/src/lib/examples`). It's designed to be dropped into other apps
(e.g. as a visualizer in the `scene` tracker).

## Develop

```sh
cd frontend && node .yarn/releases/yarn-*.cjs install && node .yarn/releases/yarn-*.cjs dev
```

Backend (serves the built SPA + `/status`): `cargo run` (run `yarn build` first).
