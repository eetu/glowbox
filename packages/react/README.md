# @glowbox/react

glowbox components for **React** — one per display core: `<LedGrid>` (the 3D WebGL LED
grid), `<NixieTube>`, `<SevenSegment>`, `<FlipDots>`, `<SplitFlap>`, `<NeonSign>`,
`<VfdPanel>` and `<LcdModule>`, each a thin live-updating wrapper over its sibling
core package.

**[⚡ Open in StackBlitz](https://stackblitz.com/github/eetu/glowbox/tree/main/examples/starters/react)** —
a running `<LedGrid>` + `<NixieTube>` playground in your browser, no install.

```sh
yarn add @glowbox/react
# peer: react ^18 || ^19   (the eight display cores come along as dependencies)
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
| `oncreate`            | `(d: LedDisplay \| null)=>void`     | called with the display on create, `null` on teardown — the ref flips silently; this is the signal                                           |
| `className` / `style` | —                                   | forwarded to the `<canvas>`                                                                                                                  |

Forward a `ref` to reach the imperative `LedDisplay` handle (`snapshot()`, `stats`,
`setCamera`, …), or take it from `oncreate`:

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
| `oncreate`            | `(t: NixieTube \| null)=>void`  | the tube on create, `null` on teardown                     |
| `className` / `style` | —                               | forwarded to the `<canvas>` (CSS)                          |

Props update **live**; forward a `ref` (or pass `oncreate`) for the imperative
`NixieTube` handle (`setValue`, `setOptions`, `resize`, `snapshot`). The core's `bare` mode (transparent canvas for 3D
compositing) is core-only — use `createNixieTube` directly for that. See **@glowbox/nixie**
for defaults + the size-adaptive rendering.

## `<SevenSegment>`

```tsx
import { SevenSegment } from '@glowbox/react';

<div style={{ width: 76, height: 130 }}>
	<SevenSegment value="7" displayStyle="vfd" age={0.4} />
</div>;
```

A seven-segment digit over **[@glowbox/seven-segment](https://www.npmjs.com/package/@glowbox/seven-segment)** —
per-segment cross-fades, ageing, LED/VFD materials. `value` takes `0`–`9`, `-`, hex
`A b C d E F`, `:` (the clock separator — give it a narrow slot), or null for dark;
`displayStyle` (`'led'` \| `'vfd'`), `dp`, `color`, `background`, `glow`, `ghost`,
`age` (0..1 — dimming, then flicker, then a dead segment), `transition` (per-segment
fade ms), `pixelRatio`, `label` mirror the core options and update **live**; forward a
`ref` (or pass `oncreate`) for the imperative `SevenSegmentDisplay` handle. See
**@glowbox/seven-segment** for defaults, the ageing arc, and the geometry export.

## `<FlipDots>`

```tsx
import { FlipDots } from '@glowbox/react';

<div style={{ width: 560, height: 280 }}>
	<FlipDots cols={28} rows={14} frame={(x, y) => (x + y) % 2} sound />
</div>;
```

An electromechanical flip-dot board over **[@glowbox/flip-dot](https://www.npmjs.com/package/@glowbox/flip-dot)** —
physical disc flips, scan-wave stagger, an optional solenoid click. `frame` takes
row-major 0/1 bits (`ditherFrame` output fits) or an `(x, y) => on` function — only dots
that actually change flip; `cols`, `rows`, `shape` (`'disc'` \| `'square'`), `onColor`,
`offColor`, `board`, `gap`, `shaded`, `flipMs`, `axis`, `stagger` (`'scan'` \|
`'random'` \| `'none'`), `scanMs`, `sound` (`true` = 0.5, or a 0..1 volume),
`pixelRatio`, `label` mirror the core options and update **live**; a `ref` or `oncreate`
reaches the imperative `FlipDotBoard` handle (`set`, `setFrame`, `dotAt`/`dotRect`
hit-testing). See **@glowbox/flip-dot** for defaults and `ditherFrame`.

## `<SplitFlap>`

```tsx
import { SplitFlap } from '@glowbox/react';

<div style={{ width: 640, height: 80 }}>
	<SplitFlap cols={12} text="DEPARTURES" sound />
</div>;
```

A Solari split-flap board over **[@glowbox/split-flap](https://www.npmjs.com/package/@glowbox/split-flap)** —
forward-only drum wraps, perspective card falls, a card-slap. `text` takes a string
(`'\n'` splits rows) or one string per row; `cols`, `rows`, `charset` (plus per-field
`drums` and per-flap `palette` — see `chromaDrum`), `card`, `ink`, `board`, `gap`,
`font`, `shaded`, `flipMs`, `sound`, `pixelRatio`, `label` mirror the core options and
update **live**; a `ref` or `oncreate` reaches the imperative `SplitFlapBoard` handle
(`setLine`/`setChar`, `cellAt`/`cellRect` hit-testing). See **@glowbox/split-flap** for
the drum model and the colour drums.

## `<NeonSign>`

```tsx
import { NeonSign } from '@glowbox/react';

<div style={{ width: 640, height: 240 }}>
	<NeonSign text="OPEN" gas="neon" program="flash" sound />
</div>;
```

A glass-tube neon sign over **[@glowbox/neon](https://www.npmjs.com/package/@glowbox/neon)** — single-stroke
tube letterforms, electrode strike sequences, visible unlit glass, transformer hum. A
`text` change re-glasses and strikes on; `font` (`'script'` \| `'sans'` \| a custom
`NeonFont`), `art` (sign artwork from SVG path data), `color`, `gas`, `wall`, `polarity`
(`'absorb'` inks a pale wall — the light-theme neon), `on`, `lineOn`, `glow`, `glass`,
`electrode`, `age`, `flicker`, `tired`, `program` (`'steady'` \| `'flash'` \| `'chase'`
\| `'reveal'`), `speed`, `tubes`, `align`, `lineSpacing`, `letterSpacing`, `tilt`,
`padding`, `strikeMs`, `sound`, `mains`, `pixelRatio`, `label` mirror the core options
and update **live**; a `ref` or `oncreate` reaches the imperative `NeonSign` handle
(`power`, `jolt`, `sectionAt`/`sectionRect` hit-testing). See **@glowbox/neon** for the
gases, the art pieces, and the wear arc.

## `<VfdPanel>`

```tsx
import { VfdPanel, type VfdElement } from '@glowbox/react';

const layout: VfdElement[] = [
	{ kind: 'digits', name: 'track', x: 8, y: 8, w: 120, h: 48, chars: 4 },
	{ kind: 'legend', name: 'play', x: 140, y: 8, w: 40, h: 16, text: 'PLAY' }
];

<div style={{ width: 640, height: 128 }}>
	<VfdPanel frame={[320, 64]} layout={layout} values={{ track: 'A-12', play: true }} />
</div>;
```

A vacuum-fluorescent panel over **[@glowbox/vfd](https://www.npmjs.com/package/@glowbox/vfd)** — declare the
hardware once (`frame` + `layout`: digits, legends, bars, icons, scales, dot grids,
rules) and drive content through `values`, by element name: a string/number drives a
`digits` field or a `scale` cursor, a boolean a `legend`/`icon`, a `number[]` a `bars`
element (only changed entries are pushed — the type is exported as `VfdValue`). The
envelope props (`phosphor`, `filter`, `zones`, `brightness`, `persistence`, `filament`,
`grid`, `age`, `glow`, `bezel`, `glass`, `on`, `selfTest`, `pixelRatio`, `label`) update
**live** and never re-compile; a `layout` change goes through `setLayout`, the one
expensive call. A `ref` or `oncreate` reaches the imperative `VfdPanel` handle —
animated content (`setDots`, a spectrum's `setBars`) wants it. See **@glowbox/vfd** for
the element kinds and the envelope physics.

## `<LcdModule>`

```tsx
import { LcdModule } from '@glowbox/react';

<div style={{ width: 480, height: 150 }}>
	<LcdModule text={'HELLO\nWORLD'} cursor="block" />
</div>;
```

A character LCD module (HD44780-class) over **[@glowbox/lcd](https://www.npmjs.com/package/@glowbox/lcd)** —
the family's first reflective display: liquid-crystal response smear, the contrast pot,
crosstalk streaks, the boot row of solid blocks. `text` takes a string (`'\n'` splits
rows) or one string per row — the shutters chase it at crystal speed; `cols`, `rows`,
`panel` (`'green'` \| `'blue'` \| `'white'`), `backlight`, `contrast`, `response`,
`ghost`, `cursor` (`'none'` \| `'line'` \| `'block'`), `age`, `on`, `boot`, `bezel`,
`pixelRatio`, `label` mirror the core options and update **live**; a `ref` or `oncreate`
reaches the imperative `LcdModule` handle (`setGlyph` for CGRAM custom characters,
`setCursor`, `power`, `cellAt`/`cellRect` hit-testing). See **@glowbox/lcd** for the
panels and the crystal physics.

## Using with `@glowbox/crt`

There is deliberately no `<Crt>` component: **[@glowbox/crt](https://www.npmjs.com/package/@glowbox/crt)**'s
element mode already composites every descendant canvas, so add it as its own dependency
and wrap the stage element imperatively:

```tsx
import { createCrtScreen } from '@glowbox/crt';
import { NixieTube } from '@glowbox/react';
import { useEffect, useRef } from 'react';

function CrtTube() {
	const stage = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const crt = stage.current ? createCrtScreen(stage.current) : null;
		return () => crt?.dispose();
	}, []);
	return (
		<div ref={stage} style={{ width: 80, height: 150 }}>
			<NixieTube value="7" />
		</div>
	);
}
```

---

Sibling packages with the same components: **[@glowbox/svelte](https://www.npmjs.com/package/@glowbox/svelte)** and
**[@glowbox/vue](https://www.npmjs.com/package/@glowbox/vue)**; content helpers in **[@glowbox/extras](https://www.npmjs.com/package/@glowbox/extras)**. Each
component fills its parent; give the parent a size. Live demos:
<https://eetu.github.io/glowbox/>.
