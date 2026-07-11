# @glowbox/svelte

glowbox components for **Svelte 5**: `<LedGrid>` — the 3D WebGL LED-grid display
(over **[@glowbox/core](../core)**) — and `<NixieTube>` — a glowing nixie-tube numeral
(over **[@glowbox/nixie](../nixie)**).

```sh
yarn add @glowbox/svelte
# peer: svelte ^5   (@glowbox/core + @glowbox/nixie come along as dependencies)
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

| prop          | type                                | notes                                                                                  |
| ------------- | ----------------------------------- | -------------------------------------------------------------------------------------- |
| `size`        | `[number, number, number]`          | grid dims `[nx, ny, nz]` (changing it resizes in place — no remount)                   |
| `draw`        | `(d: LedDisplay, dt: number)=>void` | called every frame; write voxels here                                                  |
| `led`         | `LedOptions`                        | `style` `shape` `stagger` `rgb` `rgbLayout` `vivid` `outline` `size` `glow` `offColor` |
| `color`       | `ColorOptions`                      | `background` `gain` `tint`                                                             |
| `camera`      | `CameraOptions`                     | `yaw` `pitch` `distance` `fov` `projection` `autoOrbit` `orbitSpeed` `pitchLimits`     |
| `interaction` | `InteractionOptions`                | `drag` `dragSpeed` `zoom` `zoomLimits`                                                 |
| `quality`     | `QualityOptions`                    | `pixelRatio` `antialias` `paused` `fps` (frame-rate cap)                               |
| `oncreate`    | `(d: LedDisplay \| null)=>void`     | imperative handle — called with the display on create, `null` on teardown              |

The grouped props mirror `@glowbox/core`'s options 1:1 and update **live** — even `size`
resizes the grid in place (no remount / context loss). Colours accept a `Color` (`[r,g,b]`
0..1, `>1` blooms, or any CSS string). See **@glowbox/core** for every field's default,
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
| `oncreate`   | `(tube: NixieTube \| null)=>void` | imperative handle — the tube on create, `null` on teardown |

Props update **live** (`value` → `setValue`, the rest → `setOptions`). A clock is just a
row of `<NixieTube>`s. See **@glowbox/nixie** for defaults + the size-adaptive rendering.

---

Sibling packages with the same components: **[@glowbox/react](../react)** and
**[@glowbox/vue](../vue)**; content helpers in **[@glowbox/extras](../extras)**. Each
component fills its parent (`width/height: 100%`); give the parent a size.
Live demos: <https://eetu.github.io/glowbox/>.
