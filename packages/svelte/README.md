# @glowbox/svelte

glowbox components for **Svelte 5**: `<LedGrid>` — the 3D WebGL LED-grid display
(over **[@glowbox/led-grid](https://www.npmjs.com/package/@glowbox/led-grid)**) — and `<NixieTube>` — a glowing nixie-tube numeral
(over **[@glowbox/nixie](https://www.npmjs.com/package/@glowbox/nixie)**).

**[⚡ Open in StackBlitz](https://stackblitz.com/github/eetu/glowbox/tree/main/examples/starters/svelte)** —
a running `<LedGrid>` + `<NixieTube>` playground in your browser, no install.

```sh
yarn add @glowbox/svelte
# peer: svelte ^5   (@glowbox/led-grid + @glowbox/nixie come along as dependencies)
```

## `<LedGrid>`

```svelte
<script lang="ts">
	import { LedGrid, type LedDisplay } from '@glowbox/svelte';

	const draw = (d: LedDisplay, dt: number) => {
		d.clear();
		d.sphere([4, 4, 4], 3, '#00aaff');
	};
</script>

<LedGrid
	size={[8, 8, 8]}
	{draw}
	led={{ glow: 3, offColor: '#0a0a12' }}
	camera={{ autoOrbit: true, projection: 'perspective' }}
	color={{ background: '#000', gain: 1.1 }}
	interaction={{ zoom: true }}
/>
```

| prop          | type                                | notes                                                                                                                                        |
| ------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `size`        | `[number, number, number]`          | grid dims `[nx, ny, nz]` (changing it resizes in place — no remount)                                                                         |
| `draw`        | `(d: LedDisplay, dt: number)=>void` | called every frame (dt in seconds); write voxels here                                                                                        |
| `led`         | `LedOptions`                        | `style` `shape` `stagger` `rgb` `rgbLayout` `vivid` `outline` `outlineColor` `size` `offSize` `glow` `offColor`                              |
| `color`       | `ColorOptions`                      | `background` `gain` `tint`                                                                                                                   |
| `camera`      | `CameraOptions`                     | `yaw` `pitch` `distance` `fov` `projection` `autoOrbit` `orbitSpeed` `pitchLimits` (`autoOrbit` defaults off under `prefers-reduced-motion`) |
| `interaction` | `InteractionOptions`                | `drag` `dragSpeed` `zoom` `zoomLimits`                                                                                                       |
| `quality`     | `QualityOptions`                    | `pixelRatio` `antialias` `paused` `fps` (frame-rate cap) `alpha` (transparent canvas; fixed at creation)                                     |
| `label`       | `string`                            | accessible name for the canvas (`aria-label`; default `'LED grid'`)                                                                          |
| `oncreate`    | `(d: LedDisplay \| null)=>void`     | imperative handle — called with the display on create, `null` on teardown                                                                    |

The grouped props mirror `@glowbox/led-grid`'s options 1:1 and update **live** — even `size`
resizes the grid in place (no remount / context loss). Colours accept a `Color` (`[r,g,b]`
0..1, `>1` blooms, or any CSS string). `draw` is bound as one `onFrame` subscription —
`onFrame` callbacks **stack**, so subscribing more via the handle layers on top of `draw`
rather than replacing it. See **@glowbox/led-grid** for every field's default,
the full voxel API, and colour semantics.

## `<NixieTube>`

```svelte
<script lang="ts">
	import { NixieTube } from '@glowbox/svelte';
</script>

<!-- the tube fills its parent — size the parent -->
<div style="width: 80px; height: 150px">
	<NixieTube value="7" tubeStyle="classic" color="#ff6a12" />
</div>
```

| prop         | type                              | notes                                                      |
| ------------ | --------------------------------- | ---------------------------------------------------------- |
| `value`      | `string \| number \| null`        | the lit symbol: `0`–`9`, `:`, `-`, or `null`/`''` for dark |
| `tubeStyle`  | `'classic' \| 'slim' \| 'tall'`   | physical tube style (maps to the core `style` option)      |
| `color`      | `Color`                           | glow colour (default warm nixie orange)                    |
| `glow`       | `number`                          | glow strength 0..1                                         |
| `background` | `Color`                           | tube glass colour                                          |
| `mesh`       | `boolean`                         | draw the honeycomb anode mesh (default `true`)             |
| `ghost`      | `boolean`                         | show the unlit cathode stack (default `true`)              |
| `pixelRatio` | `number`                          | cap on `devicePixelRatio`                                  |
| `label`      | `string`                          | accessible name (`aria-label`); defaults to the lit symbol |
| `oncreate`   | `(tube: NixieTube \| null)=>void` | imperative handle — the tube on create, `null` on teardown |

Props update **live** (`value` → `setValue`, the rest → `setOptions`). A clock is just a
row of `<NixieTube>`s. The core's `bare` mode (transparent canvas for 3D compositing) is
core-only — use `createNixieTube` directly for that. See **@glowbox/nixie** for defaults +
the size-adaptive rendering.

## `<SevenSegment>`

```svelte
<script lang="ts">
	import { SevenSegment } from '@glowbox/svelte';
</script>

<div style="width: 76px; height: 130px">
	<SevenSegment value="7" displayStyle="vfd" age={0.4} />
</div>
```

A seven-segment digit over **[@glowbox/seven-segment](https://www.npmjs.com/package/@glowbox/seven-segment)** —
per-segment cross-fades, ageing, LED/VFD materials. `value` takes `0`–`9`, `-`, hex
`A b C d E F`, `:` (the clock separator — give it a narrow slot), or null for dark;
`displayStyle` (`'led'` \| `'vfd'`), `dp`, `color`, `background`, `glow`, `ghost`,
`age` (0..1 — dimming, then flicker, then a dead segment), `transition` (per-segment
fade ms), `pixelRatio`, `label` mirror the core options and update **live**; `oncreate`
hands you the imperative `SevenSegmentDisplay` handle. See **@glowbox/seven-segment**
for defaults, the ageing arc, and the geometry export.

---

Sibling packages with the same components: **[@glowbox/react](https://www.npmjs.com/package/@glowbox/react)** and
**[@glowbox/vue](https://www.npmjs.com/package/@glowbox/vue)**; content helpers in **[@glowbox/extras](https://www.npmjs.com/package/@glowbox/extras)**. Each
component fills its parent (`width/height: 100%`); give the parent a size.
Live demos: <https://eetu.github.io/glowbox/>.
