# @glowbox/svelte

glowbox components for **Svelte 5** — one per display core: `<LedGrid>` (the 3D WebGL
LED grid), `<NixieTube>`, `<SevenSegment>`, `<FlipDots>`, `<SplitFlap>`, `<NeonSign>`
and `<VfdPanel>`, each a thin live-updating wrapper over its sibling core package.

**[⚡ Open in StackBlitz](https://stackblitz.com/github/eetu/glowbox/tree/main/examples/starters/svelte)** —
a running `<LedGrid>` + `<NixieTube>` playground in your browser, no install.

```sh
yarn add @glowbox/svelte
# peer: svelte ^5   (the seven display cores come along as dependencies)
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

| prop              | type                                | notes                                                                                                                                        |
| ----------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `size`            | `[number, number, number]`          | grid dims `[nx, ny, nz]` (changing it resizes in place — no remount)                                                                         |
| `draw`            | `(d: LedDisplay, dt: number)=>void` | called every frame (dt in seconds); write voxels here                                                                                        |
| `led`             | `LedOptions`                        | `style` `shape` `stagger` `rgb` `rgbLayout` `vivid` `outline` `outlineColor` `size` `offSize` `glow` `offColor`                              |
| `color`           | `ColorOptions`                      | `background` `gain` `tint`                                                                                                                   |
| `camera`          | `CameraOptions`                     | `yaw` `pitch` `distance` `fov` `projection` `autoOrbit` `orbitSpeed` `pitchLimits` (`autoOrbit` defaults off under `prefers-reduced-motion`) |
| `interaction`     | `InteractionOptions`                | `drag` `dragSpeed` `zoom` `zoomLimits`                                                                                                       |
| `quality`         | `QualityOptions`                    | `pixelRatio` `antialias` `paused` `fps` (frame-rate cap) `alpha` (transparent canvas; fixed at creation)                                     |
| `label`           | `string`                            | accessible name for the canvas (`aria-label`; default `'LED grid'`)                                                                          |
| `oncreate`        | `(d: LedDisplay \| null)=>void`     | imperative handle — called with the display on create, `null` on teardown                                                                    |
| `class` / `style` | `string`                            | forwarded to the `<canvas>` (inline `style` wins over the built-in block/fill sizing)                                                        |

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

| prop              | type                              | notes                                                      |
| ----------------- | --------------------------------- | ---------------------------------------------------------- |
| `value`           | `string \| number \| null`        | the lit symbol: `0`–`9`, `:`, `-`, or `null`/`''` for dark |
| `tubeStyle`       | `'classic' \| 'slim' \| 'tall'`   | physical tube style (maps to the core `style` option)      |
| `color`           | `Color`                           | glow colour (default warm nixie orange)                    |
| `glow`            | `number`                          | glow strength 0..1                                         |
| `background`      | `Color`                           | tube glass colour                                          |
| `mesh`            | `boolean`                         | draw the honeycomb anode mesh (default `true`)             |
| `ghost`           | `boolean`                         | show the unlit cathode stack (default `true`)              |
| `pixelRatio`      | `number`                          | cap on `devicePixelRatio`                                  |
| `label`           | `string`                          | accessible name (`aria-label`); defaults to the lit symbol |
| `oncreate`        | `(tube: NixieTube \| null)=>void` | imperative handle — the tube on create, `null` on teardown |
| `class` / `style` | `string`                          | forwarded to the `<canvas>`                                |

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

## `<FlipDots>`

```svelte
<script lang="ts">
	import { FlipDots } from '@glowbox/svelte';
</script>

<div style="width: 560px; height: 280px">
	<FlipDots cols={28} rows={14} frame={(x, y) => (x + y) % 2} sound />
</div>
```

An electromechanical flip-dot board over **[@glowbox/flip-dot](https://www.npmjs.com/package/@glowbox/flip-dot)** —
physical disc flips, scan-wave stagger, an optional solenoid click. `frame` takes
row-major 0/1 bits (`ditherFrame` output fits) or an `(x, y) => on` function — only dots
that actually change flip; `cols`, `rows`, `shape` (`'disc'` \| `'square'`), `onColor`,
`offColor`, `board`, `gap`, `shaded`, `flipMs`, `axis`, `stagger` (`'scan'` \|
`'random'` \| `'none'`), `scanMs`, `sound` (`true` = 0.5, or a 0..1 volume),
`pixelRatio`, `label` mirror the core options and update **live**; `oncreate` hands you
the imperative `FlipDotBoard` handle (`set`, `setFrame`, `dotAt`/`dotRect` hit-testing).
See **@glowbox/flip-dot** for defaults and `ditherFrame`.

## `<SplitFlap>`

```svelte
<script lang="ts">
	import { SplitFlap } from '@glowbox/svelte';
</script>

<div style="width: 640px; height: 80px">
	<SplitFlap cols={12} text="DEPARTURES" sound />
</div>
```

A Solari split-flap board over **[@glowbox/split-flap](https://www.npmjs.com/package/@glowbox/split-flap)** —
forward-only drum wraps, perspective card falls, a card-slap. `text` takes a string
(`'\n'` splits rows) or one string per row; `cols`, `rows`, `charset` (plus per-field
`drums` and per-flap `palette` — see `chromaDrum`), `card`, `ink`, `board`, `gap`,
`font`, `shaded`, `flipMs`, `sound`, `pixelRatio`, `label` mirror the core options and
update **live**; `oncreate` hands you the imperative `SplitFlapBoard` handle
(`setLine`/`setChar`, `cellAt`/`cellRect` hit-testing). See **@glowbox/split-flap** for
the drum model and the colour drums.

## `<NeonSign>`

```svelte
<script lang="ts">
	import { NeonSign } from '@glowbox/svelte';
</script>

<div style="width: 640px; height: 240px">
	<NeonSign text="OPEN" gas="neon" program="flash" sound />
</div>
```

A glass-tube neon sign over **[@glowbox/neon](https://www.npmjs.com/package/@glowbox/neon)** — single-stroke
tube letterforms, electrode strike sequences, visible unlit glass, transformer hum. A
`text` change re-glasses and strikes on; `font` (`'script'` \| `'sans'` \| a custom
`NeonFont`), `art` (sign artwork from SVG path data), `color`, `gas`, `wall`, `polarity`
(`'absorb'` inks a pale wall — the light-theme neon), `on`, `lineOn`, `glow`, `glass`,
`electrode`, `age`, `flicker`, `tired`, `program` (`'steady'` \| `'flash'` \| `'chase'`
\| `'reveal'`), `speed`, `tubes`, `align`, `lineSpacing`, `letterSpacing`, `tilt`,
`padding`, `strikeMs`, `sound`, `mains`, `pixelRatio`, `label` mirror the core options
and update **live**; `oncreate` hands you the imperative `NeonSign` handle (`power`,
`jolt`, `sectionAt`/`sectionRect` hit-testing). See **@glowbox/neon** for the gases, the
art pieces, and the wear arc.

## `<VfdPanel>`

```svelte
<script lang="ts">
	import { VfdPanel, type VfdElement } from '@glowbox/svelte';

	const layout: VfdElement[] = [
		{ kind: 'digits', name: 'track', x: 8, y: 8, w: 120, h: 48, chars: 4 },
		{ kind: 'legend', name: 'play', x: 140, y: 8, w: 40, h: 16, text: 'PLAY' }
	];
</script>

<div style="width: 640px; height: 128px">
	<VfdPanel frame={[320, 64]} {layout} values={{ track: 'A-12', play: true }} />
</div>
```

A vacuum-fluorescent panel over **[@glowbox/vfd](https://www.npmjs.com/package/@glowbox/vfd)** — declare the
hardware once (`frame` + `layout`: digits, legends, bars, icons, scales, dot grids,
rules) and drive content through `values`, by element name: a string/number drives a
`digits` field or a `scale` cursor, a boolean a `legend`/`icon`, a `number[]` a `bars`
element (only changed entries are pushed — the type is exported as `VfdValue`). The
envelope props (`phosphor`, `filter`, `zones`, `brightness`, `persistence`, `filament`,
`grid`, `age`, `glow`, `bezel`, `glass`, `on`, `selfTest`, `pixelRatio`, `label`) update
**live** and never re-compile; a `layout` change goes through `setLayout`, the one
expensive call. `oncreate` hands you the imperative `VfdPanel` handle — animated content
(`setDots`, a spectrum's `setBars`) wants it. See **@glowbox/vfd** for the element kinds
and the envelope physics.

## Using with `@glowbox/crt`

There is deliberately no `<Crt>` component: **[@glowbox/crt](https://www.npmjs.com/package/@glowbox/crt)**'s
element mode already composites every descendant canvas, so add it as its own dependency
and wrap the stage element imperatively:

```svelte
<script lang="ts">
	import { createCrtScreen } from '@glowbox/crt';
	import { NixieTube } from '@glowbox/svelte';

	let stage = $state<HTMLDivElement | null>(null);
	$effect(() => {
		if (!stage) return;
		const crt = createCrtScreen(stage);
		return () => crt?.dispose();
	});
</script>

<div bind:this={stage} style="width: 80px; height: 150px">
	<NixieTube value="7" />
</div>
```

---

Sibling packages with the same components: **[@glowbox/react](https://www.npmjs.com/package/@glowbox/react)** and
**[@glowbox/vue](https://www.npmjs.com/package/@glowbox/vue)**; content helpers in **[@glowbox/extras](https://www.npmjs.com/package/@glowbox/extras)**. Each
component fills its parent (`width/height: 100%`); give the parent a size.
Live demos: <https://eetu.github.io/glowbox/>.
