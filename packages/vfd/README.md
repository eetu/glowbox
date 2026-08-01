# @glowbox/vfd

A **vacuum-fluorescent display panel component** — a sibling rendering core to
**[@glowbox/nixie](https://www.npmjs.com/package/@glowbox/nixie)**,
**[@glowbox/led-grid](https://www.npmjs.com/package/@glowbox/led-grid)**,
**[@glowbox/seven-segment](https://www.npmjs.com/package/@glowbox/seven-segment)**,
**[@glowbox/flip-dot](https://www.npmjs.com/package/@glowbox/flip-dot)**,
**[@glowbox/split-flap](https://www.npmjs.com/package/@glowbox/split-flap)** and
**[@glowbox/neon](https://www.npmjs.com/package/@glowbox/neon)**.

This is the front of a 90s mini-system: a 14-segment character field, screen-printed
word annunciators (DOLBY NR · ST · MONO · REC), a spectrum analyser with peak-hold caps,
transport icons, a tuning dial, and the silkscreen labels that were never wired to
anything — **all in one vacuum envelope, sharing its physics.** Zero runtime deps.

```sh
yarn add @glowbox/vfd
```

```ts
import { createVfdPanel } from '@glowbox/vfd';

const panel = createVfdPanel(canvas, {
	frame: [320, 64], // the design frame every element box is placed in
	layout: [
		{ kind: 'digits', name: 'main', chars: 8, glyphs: '14seg', x: 8, y: 8, w: 150, h: 30 },
		{ kind: 'legend', name: 'st', text: 'ST', x: 170, y: 6, w: 12, h: 8 },
		{ kind: 'bars', name: 'spec', bands: 12, rows: 8, peakHold: true, x: 196, y: 8, w: 116, h: 40 }
	]
});

panel?.set('main', 'FM 98.50');
panel?.light('st', true);
panel?.setBars('spec', levels); // 0..1 per band; the caps fall on their own
```

Give it a canvas; it owns the 2D render, the physics, resize, and the render loop — which
runs **only while something is in flight**. A settled panel costs nothing.

## What a div grid and a green webfont can't do

Laying these parts out is the easy half, and it isn't why this package exists. The
envelope is:

- **Phosphor persistence.** An anode keeps glowing after its drive stops, so a falling
  spectrum bar leaves a **tail**. `persistence` sets the release; the attack stays fast, and
  that asymmetry is the character of the thing. It needs a per-anode brightness integrator
  across frames — no font, filter or CSS transition reproduces it. It is a **stylized**
  control and **defaults low** (0.05 ≈ 37 ms, two frames): real ZnO:Zn decays in
  microseconds, so no receiver smeared much — what you remember is the multiplex refresh
  plus your own eye. Past ~0.45 a character field ghosts into its previous value.
- **One shared multiplex.** The filament wires cross the glass in front of
  **everything**, the control-grid mesh is continuous across the whole panel rather than
  per digit, and `brightness` is the **DIMMER** — that 2- or 3-position button on the
  front of the receiver — pulling the entire face down at once, non-linearly.
- **The power-on self-test.** `selfTest()` lights every anode for about a second, then
  settles. It exists only because the panel knows its own complete anode inventory.
- **Failure, two ways.** `age` runs the franchise wear arc at anode granularity (dim →
  sparse flicker → dead), **plus** the one that belongs to vacuum fluorescence: past ~0.6
  a multiplex grid goes weak and a **vertical band** of the panel reads dimmer than the
  rest, cutting across whichever elements sit in it.
- **The filter glass.** `filter` is the tinted window in front of the tube: it pushes the
  light toward its own hue and crushes the undriven phosphor ghosts, which is why the things
  were fitted (`filter: 'none'` shows a filterless panel — every unlit anode floating there
  in outline). `zones` adds extra windows over **regions** of it: the amber band across a
  level meter, or the red rectangle a RECORD block needs to be visible at all, since green
  plastic cannot pass red. A zone belongs to the panel, not to an element, because that is
  what it is — plastic over a rectangle, tinting whatever sits behind it.

## Elements

Every element is placed at `x, y, w, h` in the panel's `frame` units and addressed by
`name`. Names are the wiring, so they are **required and unique**; a duplicate throws.

| kind     | drives with             | what it is                                                         |
| -------- | ----------------------- | ------------------------------------------------------------------ |
| `digits` | `set(name, str)`        | character cells: `'7seg'`, `'14seg'`, `'16seg'` or `'matrix'` 5×7  |
| `legend` | `light(name, on)`       | a screen-printed word — one anode, one wire, lights as a unit      |
| `bars`   | `setBars(name, levels)` | `bands` × `rows` blocks, optional `peakHold` caps and `wedge` ramp |
| `icon`   | `light(name, on)`       | arbitrary SVG **fill** data                                        |
| `scale`  | `set(name, 0..1)`       | a tuning dial: printed ticks plus discrete cursor blocks           |
| `dots`   | `setDots(name, bitmap)` | a raw `cols` × `rows` dot grid — the graphic half of a panel       |
| `rule`   | — (ink)                 | silkscreen hairlines and boxes that group the face into zones      |

Anything drivable also answers `clear(name)`, which is not the same as writing zeros — see
below.

**Icons are fills, not centrelines.** A VFD anode is a patch of phosphor screen-printed onto
the plate, so path data straight out of any vector editor works as-is, and a shape with a
hole (a cassette's reels, a disc's ring) fills correctly as one anode. Wind glyph outlines
the other way inside a rectangle and you have a knocked-out `REC`.

**An `icon` can share a design `frame`** with its neighbours instead of being fitted to a
box: give several the same `frame` and their path coordinates are read as frame coordinates,
so a mechanism cut into thirty anodes stays in register. A framed icon needs no `x/y/w/h` at
all. Every other kind does need a box; omitting one throws.

**`printed: true`** turns a `legend` into silkscreen — ink on the glass, never wired, never
lit, unaffected by the dimmer. The dB scale numbers and the source names under the
annunciators were these on the real thing.

**`dots` is the graphic half**, and why it is not a `digits` field in disguise: it is
addressed by DOT, so it can do the two things a character-addressed field structurally
cannot — play an animation, and scroll text smoothly by column instead of jumping a whole
character (which, under persistence, reads as two glyphs stacked rather than as motion).
Feed it a row-major array or an `(x, y)` function; row 0 is the top, because what you hand
it is an image. Values are 0..1 and **fractional values are honest** — a multiplexed anode
dims by duty cycle, so greyscale needs no dithering. Every dot is an anode, so a 120 × 7
ticker is 840 of them.

## Hardware is declared, driving is cheap

`setLayout(layout, frame?)` re-declares the hardware and re-compiles the whole anode
inventory — the one expensive call on the handle. Drive state survives it, carried by
element **name**. `setOptions(patch)` patches the envelope (phosphor, windows, dimmer,
persistence, wear, power) and cannot re-compile, so a wrapper is free to re-send the whole
bag on every slider tick; all three of ours do.

`setBars` and `setDots` **copy** what you hand them, so an array you reuse next frame cannot
retroactively change the display. A function passed to `setDots` is the exception: it is kept
and sampled each frame, which is the point of it.

**`clear(name)` stops driving an element** — or the whole panel, with no argument, the way
flip-dot's and split-flap's `clear()` do. Writing zeros is not equivalent: a `bars` element
with `peakHold` remembers its caps, and a cap resting on the floor row it never falls below
is a lit line across the element for good. That matters as soon as one window has more than
one job — an analyser field that becomes a graphic display on the DISPLAY button, as these
panels really did: the driver you switched away from has to stop, memory and all. A cleared
`scale` shows no cursor rather than one parked at zero, because a dial with nothing tuned in
is an empty scale. Silkscreen is ink and stays. The anodes keep their phosphor tails on the
way down.

Driving an element through the wrong call warns rather than silently doing nothing.

## The decimal point takes no cell

In every segment mode, `.` and `:` ride the cell **before** them instead of consuming one
of their own — what a real driver chip does with its point and colon anodes, and the
reason `'FM 98.50'` fits eight cells. A `'matrix'` cell draws its own `.` as a glyph, so
there the point takes a cell like any other character.

## Nothing in a vacuum envelope moves

Anodes are **discrete and fixed**. That sounds like a restriction until you notice it is
how the hardware worked: a tuning cursor is not a sliding block, it is a row of ~24 fixed
blocks with one of them driven — so `set('tune', 0.42)` lights the nearest.

## Geometry, not events

The panel attaches **no listeners**. It answers geometry and leaves the events to you —
the same contract as split-flap's `cellAt` and neon's `sectionAt`. Both answer from where
the element's anodes actually are, not from the box you declared, which is what keeps an
`icon` placed through a shared design `frame` from claiming the whole panel:

```ts
stage.addEventListener('click', (e) => {
	const name = panel.elementAt(e.clientX, e.clientY); // element name | null
	if (name) console.log('tapped', name, panel.elementRect(name));
});
```

Elements made only of silkscreen are skipped, so a `rule` box drawn around a zone never
swallows the taps meant for what's inside it.

## No sound

The first core in the family without a sound module, deliberately. A VFD has no voice —
the muting relay's clunk belongs to the receiver, not to the display.

## Light theme

A VFD is a physical object with a bezel, so a dark panel on a pale page is a dark panel,
correctly — `bezel` sets the faceplate around the glass (or `null` for a transparent
canvas to compose over your own hardware). Unlike neon, this core needs no invented
element to live in the light: it was always a dark rectangle screwed into a chassis.

## Cost

Dot areas are where the anode budget goes: a `dots` grid or a `matrix` field is one anode
per dot, so a 120 × 7 ticker is 840 and a full faceplate lands around 1200.

The renderer is built around the one thing that actually costs: **`shadowBlur`**. Its price
scales with area × radius, so one gaussian per lit anode does not scale and batching them
per element does not help — the blurred area is the same. Instead every lit anode is drawn
flat into a small offscreen canvas and composited back **upscaled**, letting the sampler's
own filtering be the blur: one pass for the whole envelope. Small dots read better for it
too, since a per-anode bloom smeared neighbours together.

`node scripts/bench-vfd.mjs` for numbers (built package, vsync uncapped, dpr 2, every
element re-driven every frame — a harder case than any real panel). Two things worth knowing
if you push it further: the loop runs **only while something is in flight**, so a settled
panel is free; and caching the static ghost/silkscreen layers to an offscreen measures
_slower_ than re-filling them, which is why they aren't cached.

## The layout is pure

`compilePanel(frame, layout)` is exported and runs headless — no canvas, no DOM. It
compiles every element kind down to one flat list of anodes (each a fixed patch with an
integer address), which is what lets the physics be a handful of uniform passes over a
single `Float32Array` instead of six per-element special cases. It is also the seam for a
3D consumer: extrude the anode polygons into plates and drive them with `driveElement`.

## Accessibility

The canvas gets `role="img"` and an `aria-label` built from `label` plus what the panel is
actually showing (the character fields and the lit legends), so a screen reader reads the
display rather than "canvas". `label: ''` hides it from the a11y tree. Under
`prefers-reduced-motion` the persistence smear and the self-test animation settle
instantly.

## Framework wrappers

`<VfdPanel>` ships in [@glowbox/svelte](https://www.npmjs.com/package/@glowbox/svelte),
[@glowbox/react](https://www.npmjs.com/package/@glowbox/react) and
[@glowbox/vue](https://www.npmjs.com/package/@glowbox/vue). Declare the hardware once
with `frame`/`layout`, then drive content either declaratively through `values` (keyed by
element name; the value's own type picks the wire) or imperatively through the handle —
which is what an analyser running at frame rate wants. Each wrapper syncs the hardware on
its own effect/watcher, separate from the appearance patch, so hand `layout` a stable array
rather than rebuilding it inline every render.

## Licence

MIT.
