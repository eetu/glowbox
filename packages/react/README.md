# @glowbox/react

glowbox components for **React**: `<LedGrid>` — the 3D WebGL LED-grid display (over
**[@glowbox/led-grid](https://www.npmjs.com/package/@glowbox/led-grid)**) — and `<NixieTube>` — a glowing nixie-tube numeral (over
**[@glowbox/nixie](https://www.npmjs.com/package/@glowbox/nixie)**).

**[⚡ Open in StackBlitz](https://stackblitz.com/github/eetu/glowbox/tree/main/examples/starters/react)** —
a running `<LedGrid>` + `<NixieTube>` playground in your browser, no install.

```sh
yarn add @glowbox/react
# peer: react ^18 || ^19   (@glowbox/led-grid + @glowbox/nixie come along as dependencies)
```

## `<LedGrid>`

```tsx
import { LedGrid, type LedDisplay } from '@glowbox/react';

const draw = (d: LedDisplay, dt: number) => {
	d.clear();
	d.sphere([4, 4, 4], 3, '#00aaff');
};

export default function App() {
	return (
		<div style={{ width: 480, height: 480 }}>
			<LedGrid
				size={[8, 8, 8]}
				draw={draw}
				led={{ glow: 3, offColor: '#0a0a12' }}
				camera={{ autoOrbit: true, projection: 'perspective' }}
				color={{ background: '#000', gain: 1.1 }}
				interaction={{ zoom: true }}
			/>
		</div>
	);
}
```

| prop                  | type                                | notes                                                                                                                                        |
| --------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `size`                | `[number, number, number]`          | grid dims `[nx, ny, nz]` (changing it resizes in place — no remount)                                                                         |
| `draw`                | `(d: LedDisplay, dt: number)=>void` | called every frame (dt in seconds); write voxels here                                                                                        |
| `led`                 | `LedOptions`                        | `style` `shape` `stagger` `rgb` `rgbLayout` `vivid` `outline` `outlineColor` `size` `offSize` `glow` `offColor`                              |
| `color`               | `ColorOptions`                      | `background` `gain` `tint`                                                                                                                   |
| `camera`              | `CameraOptions`                     | `yaw` `pitch` `distance` `fov` `projection` `autoOrbit` `orbitSpeed` `pitchLimits` (`autoOrbit` defaults off under `prefers-reduced-motion`) |
| `interaction`         | `InteractionOptions`                | `drag` `dragSpeed` `zoom` `zoomLimits`                                                                                                       |
| `quality`             | `QualityOptions`                    | `pixelRatio` `antialias` `paused` `fps` (frame-rate cap) `alpha` (transparent canvas; fixed at creation)                                     |
| `label`               | `string`                            | accessible name for the canvas (`aria-label`; default `'LED grid'`)                                                                          |
| `className` / `style` | —                                   | forwarded to the `<canvas>`                                                                                                                  |

Forward a `ref` to reach the imperative `LedDisplay` handle (`snapshot()`, `stats`,
`setCamera`, …):

```tsx
const grid = useRef<LedDisplay | null>(null);
<LedGrid ref={grid} size={[8, 8, 8]} />;
// grid.current?.snapshot()
```

The grouped props mirror `@glowbox/led-grid`'s options 1:1 and update **live** — even `size`
resizes the grid in place. `draw` is bound as one `onFrame` subscription — `onFrame`
callbacks **stack**, so subscribing more via the handle layers on top of `draw` rather than
replacing it. See **@glowbox/led-grid** for defaults, the voxel API, and colour semantics.

## `<NixieTube>`

```tsx
import { NixieTube } from '@glowbox/react';

<div style={{ width: 80, height: 150 }}>
	<NixieTube value="7" tubeStyle="classic" color="#ff6a12" />
</div>;
```

| prop                  | type                            | notes                                                      |
| --------------------- | ------------------------------- | ---------------------------------------------------------- |
| `value`               | `string \| number \| null`      | the lit symbol: `0`–`9`, `:`, `-`, or `null`/`''` for dark |
| `tubeStyle`           | `'classic' \| 'slim' \| 'tall'` | physical tube style (maps to the core `style` option)      |
| `color`               | `Color`                         | glow colour (default warm nixie orange)                    |
| `glow`                | `number`                        | glow strength 0..1                                         |
| `background`          | `Color`                         | tube glass colour                                          |
| `mesh`                | `boolean`                       | draw the honeycomb anode mesh (default `true`)             |
| `ghost`               | `boolean`                       | show the unlit cathode stack (default `true`)              |
| `pixelRatio`          | `number`                        | cap on `devicePixelRatio`                                  |
| `label`               | `string`                        | accessible name (`aria-label`); defaults to the lit symbol |
| `className` / `style` | —                               | forwarded to the `<canvas>` (CSS)                          |

Props update **live**; forward a `ref` for the imperative `NixieTube` handle (`setValue`,
`setOptions`, `resize`, `snapshot`). The core's `bare` mode (transparent canvas for 3D
compositing) is core-only — use `createNixieTube` directly for that. See **@glowbox/nixie**
for defaults + the size-adaptive rendering.

---

Sibling packages with the same components: **[@glowbox/svelte](https://www.npmjs.com/package/@glowbox/svelte)** and
**[@glowbox/vue](https://www.npmjs.com/package/@glowbox/vue)**; content helpers in **[@glowbox/extras](https://www.npmjs.com/package/@glowbox/extras)**. Each
component fills its parent; give the parent a size. Live demos:
<https://eetu.github.io/glowbox/>.
