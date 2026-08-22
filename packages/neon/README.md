# @glowbox/neon

A **glass-tube neon sign component** — a sibling rendering core to
**[@glowbox/nixie](https://www.npmjs.com/package/@glowbox/nixie)**,
**[@glowbox/led-grid](https://www.npmjs.com/package/@glowbox/led-grid)**,
**[@glowbox/seven-segment](https://www.npmjs.com/package/@glowbox/seven-segment)**,
**[@glowbox/flip-dot](https://www.npmjs.com/package/@glowbox/flip-dot)** and
**[@glowbox/split-flap](https://www.npmjs.com/package/@glowbox/split-flap)**.
CSS `text-shadow` puts a glow on any font for free; this gives you the
**glass**: tubes bent from single-stroke letterforms that exist as objects —
visible unlit, struck alive through arcing electrodes, ageing until a section
dies — with an optional transformer hum. Zero runtime deps.

```sh
yarn add @glowbox/neon
```

```ts
import { createNeonSign } from '@glowbox/neon';

const sign = createNeonSign(canvas, { text: 'Cocktails', gas: 'rose', sound: true });
sign?.power(false); // dark glass on the wall
sign?.power(true); // …and the strike sequence
```

Give it a canvas; it owns the 2D render, the strike/flicker animation, resize,
and the render loop — which runs **only while something is in flight**; a
resting sign, lit or dark, costs nothing.

## What a text-shadow can't do

- **Real tube geometry.** Letterforms are **stroked centrelines** — the path
  the glass bender follows — from vendored Hershey single-stroke faces, corner-
  rounded into bends, one constant-width tube per section with an electrode
  stub at each free end. Categorically different from glowing filled Helvetica.
- **The unlit tube is drawn, always.** Powered off or dead, the glass still
  hangs on the wall: phosphor-coated fills show their paint, clear gases pale
  glass. A text-shadow at 0 opacity is nothing.
- **A strike is a sequence, not a fade-in.** The electrodes arc while the tube
  stays dark, ignition takes with a few partial pops, overshoots white-hot and
  settles; sections stagger like independently-warming tubes ('reveal' walks
  them in order). Turn-off is near-instant — the discharge just stops.
- **The wear arc.** `age` applies deterministic per-tube dimming; past ~0.7 the
  most-worn section starts flickering, from ~0.95 it is dead glass while the
  runner-up takes over — the MOT L sign, at tube granularity.
- **The transformer.** `sound: true` hums at twice the mains frequency (level
  tracking how much tube is lit — it dies with a dropout) with a crackle as
  ignition takes. `tired: true` is the failing transformer: hard whole-sign
  dropouts, staggered re-strikes.

## Letterforms

Two faces are vendored as packed single-stroke data (a few kB total):
**`'script'`** (Hershey Script — connected cursive, the classic window sign;
one tube runs a whole word) and **`'sans'`** (Hershey Simplex — block channel
letters, one tube per glyph). Coverage is **printable ASCII**; anything else is
skipped with one dev warning. Emoji/CJK are out of scope.

The `font` option also takes a custom **`NeonFont`** — a glyph table of
centreline polylines (y-down, baseline 0) with `capHeight`/`ascent`/`descent`.
A one-glyph face whose strokes are your logo works.

The Hershey Fonts were originally created by Dr. A. V. Hershey while working
at the U. S. National Bureau of Standards; the format of the font data was
originally created by James Hurt (Cognition, Inc.). The acknowledgement ships
inside the package as the `HERSHEY_LICENSE` export (referenced by the face
data, so bundlers keep it) and as `LICENSE-hershey`; full terms there.

## Artwork

Real signs put the martini glass beside the word, not in it. `art` composes
single-stroke pieces against the text block:

```ts
createNeonSign(canvas, {
	text: 'dice',
	gas: 'co2',
	art: [
		{ d: DIE_LEFT, place: 'left', rotate: -12, color: '#ff3355' },
		{ d: DIE_RIGHT, place: 'right', rotate: 9, color: '#7cd5ff' }
	]
});
```

`d` is SVG path data (a `d` string or several — author in any vector editor)
or centreline polylines. `place` anchors the piece `behind` the text or beside
it (`left`/`right`/`above`/`below`); `size` scales it against the text block's
height, `dx`/`dy` nudge, `rotate` tilts. Each piece is its own tube — its own
`gas`/`color`, its own strike, wear and death; `tubes: 'path'` splits it per
subpath, `steady: true` wires it past the flasher cam (the diner border that
stays lit around the blinking word), and `behind` pieces light first under
`'reveal'`.

Several pieces can be cut from **one drawing**: give them the same
`frame: [width, height]` (the drawing's design space) and identical placement,
and they keep their registration — the multi-colour portrait pattern, where
the hair, the face and the jacket are separate gases in one artwork.

Pieces can **overlap**: mark the front one `opaque: true` and its closed
subpaths become a solid face that cuts the tubes of everything behind it in
z-order, ending each rear run shy of the front edge — glass can't hide glass,
so the sign maker ends the run. Cut ends read as the tube diving behind (no
electrode stub); a fully covered tube disappears. That's the classic
overlapping dice pair: rear die first in the list, front die `opaque`.

Author **centrelines**: a filled icon's outline strokes as a double-walled
silhouette. Put the bends in the path itself — text corners are auto-rounded,
art is not. `pathToStrokes(d)` is exported on its own (pure, node-safe) for
custom-font glyphs and 3D consumers.

## Gas & colour

`gas` picks what's in the glass — it sets the lit colour, how white-hot the
core runs, and what the dead glass looks like: `'neon'` (the red-orange the
medium is named for), `'argon'` (pale blue), `'helium'`, `'co2'`, and the
phosphor-coated `'green'` / `'gold'` / `'rose'` (visibly painted even off).
`color` overrides the lit colour — a single colour or **one per text line**
(the NO / VACANCY pattern) — while the gas keeps shaping the core and the
unlit glass. Patch `color: null` to go back to the gas. Under
`polarity: 'absorb'` a gas discharges its own **ink** and a colour you name **is**
the pigment — see below.

## The light-theme answer: an element that shines dark

A bloom cannot read against white — which normally means neon signs only live
on dark walls. So the core ships one **invented** element:
`polarity: 'absorb'`. Its discharge runs _dark_: the same graduated ramp,
multiplied into the wall instead of added to it, so the tubes **ink** a pale
surface — halation, hot core, arcing electrodes and all, just inverted.

```ts
createNeonSign(canvas, { text: 'dice', polarity: 'absorb' }); // wall defaults pale
```

Colours still come from `gas` and `color`, under two rules. Each **gas** carries
its own ink — that is where the invention lives, and it is why a `co2` white tube
inverts into a literal black light. A **colour you name** is the pigment itself,
so its lightness means the same thing inking as it does lit: a pale tube lays down
a faint mark, a saturated one a deep one, and two tubes of different lightness stay
two tubes. That is what a gauge needs — a quiet track ring under a bright meter arc
reads as one instrument in both themes, with one set of colours.

The hot core is a **second coat** of the same pigment rather than a march to
neutral black, so a green tube inks green at its very centre; and ink bleeds
tighter than light blooms, because a pigment sits in the surface while light
scatters on its way through the air. An unnamed `wall` follows the polarity
(near-black when emitting, near-white when absorbing); `wall: null` under absorb
assumes a **pale backdrop**, since a multiply with nothing behind it treats the
missing surface as white. The
non-luminous parts key off the **wall** rather than the polarity, because glass
and metal are just objects on a surface and what they need is contrast with it:
`glass` (the unlit tube) and `electrode` (the metal end caps) default light on a
dark wall and dark on a pale one — near-black specks on white read as dirt, not
hardware — and both take your own colour when you want one. Pair it with your
app's theme and the sign belongs in both.

Polarity is settable **per art piece** too, which is usually what a mixed sign
wants: white dice can shine _black_ on a pale card while the gold lettering
beside them still shines gold — it's the element that runs dark, not the
circuit.

## Programs — the flasher cam

`program` is sign **hardware**, not content: `'steady'`, `'flash'` (the whole
sign), `'chase'` (a dark slot running the sections), `'reveal'` (sequential
strike on power-on/setText). `speed` multiplies the cam rate, but every
program is **hard-capped below ~3 events/s** — a photosensitivity guard the
speed knob cannot defeat — and `prefers-reduced-motion` degrades every program
to steady, snaps strikes, and disables flicker/tired.

## Options

| option          | default       | notes                                                                 |
| --------------- | ------------- | --------------------------------------------------------------------- |
| `text`          | `''`          | `'\n'` splits lines                                                   |
| `font`          | `'script'`    | `'script'` \| `'sans'` \| custom `NeonFont`                           |
| `art`           | —             | single-stroke pieces behind/beside the text (see Artwork)             |
| `gas`           | `'neon'`      | what's in the glass (colour, ink, hot core, dead-glass tint)          |
| `color`         | —             | override: one colour or one per line; the ink when absorbing          |
| `wall`          | per polarity  | behind the sign; `null` = transparent canvas                          |
| `polarity`      | `'emit'`      | `'absorb'` = the invented dark discharge; a named colour is the ink   |
| `on`            | `true`        | off is not blank — the unlit glass stays visible                      |
| `lineOn`        | all on        | per-line circuits (the motel sign's separately switched NO)           |
| `glow`          | `0.7`         | halation strength                                                     |
| `glass`         | vs the wall   | the unlit tube (the gas still tints it)                               |
| `electrode`     | vs the wall   | the metal end caps: near-black on a dark wall, mid-grey on a pale one |
| `age`           | `0`           | wear 0..1: dimming → flickering tube → dead glass                     |
| `flicker`       | `0`           | electrical instability: sparse scheduled dips                         |
| `tired`         | `false`       | failing transformer: whole-sign dropouts + re-strikes                 |
| `program`       | `'steady'`    | the flasher cam (rate-capped)                                         |
| `speed`         | `1`           | cam rate multiplier (the cap always wins)                             |
| `tubes`         | `'auto'`      | sectioning: script→word, sans→glyph; or `glyph`/`word`/`line`         |
| `align`         | `'center'`    | per-line alignment                                                    |
| `lineSpacing`   | `1.1`         | baseline advance × the face's ascent+descent                          |
| `letterSpacing` | `0`           | extra tracking (fraction of cap height); breaks script joins          |
| `tilt`          | `0`           | text block tilt, degrees (negative rises left-to-right)               |
| `padding`       | `0.08`        | canvas margin fraction                                                |
| `strikeMs`      | `900`         | one tube's strike (0 = instant; forced by reduced motion)             |
| `sound`         | off           | `true` (= 0.5) or `0..1` — the hum that follows the glass             |
| `mains`         | `50`          | 50/60 Hz — the hum's fundamental is twice this                        |
| `theme`         | `'dark'`      | `'light'` / `'auto'` bundle the colour defaults (see Themes)          |
| `pixelRatio`    | `2`           | cap on devicePixelRatio                                               |
| `label`         | `'neon sign'` | `aria-label`; the shown text is appended; `''` hides                  |

All options update live via `setOptions(patch)`. API: `setText(text)` (a
change **re-glasses and strikes on**), `power(on)` (the wall switch),
`jolt(section?)` + `sectionAt(clientX, clientY)` (see Tappable tubes),
`resize()`, `snapshot()` (PNG data URL), `dispose()` (hands the canvas back
clean). A sign is created lit — no boot animation; the strike show is opt-in
via `power()` cycling, `setText`, or `program: 'reveal'`.

## Tube sections

A **section** is the unit that strikes, flickers, ages and dies together — one
electrode pair. `'auto'` matches the faces' physical reality: script words are
one continuously-bent tube, sans letters are individual channel tubes.
`tubes: 'line'` gives one tube per text line (per-line colours pair well).
Grouping is behavioural, not geometric — script glyphs join approximately at
the baseline, the way real signs carry blockout breaks.

## The sound engine

The sign's voice is **its electricity**. The transformer hum's level follows
the lit glass, so a staggered strike flutters it in from silence as the tubes
pop through their ignition flickers, wear dips duck it, and a dropout kills it
dead — the only event sound is a subliminal solenoid tick as each tube's
starter engages and its ignition takes (flavour, not foley). The voice is
**`createHum({ volume, base })`**, exported on its own: a continuous synth
over the shared, refcounted AudioContext (the mains-doubled fundamental plus
detuned harmonics and a whisper of low-passed sizzle), driven by
`setLevel(0..1)`. Held at 0 it tears its sources down; hidden tabs mute it.
`createMechSound` (the mechanical cores' tick synth) rides along in the same
vendored engine. Sound starts on the first user gesture — nothing to wire up.

## Tappable tubes

The sign attaches **no** pointer handlers — it's a display. It answers the
geometry question instead, and owns what a disturbed tube does; you own when
that happens:

```ts
canvas.addEventListener('pointerdown', (e) => {
	const tube = sign.sectionAt(e.clientX, e.clientY); // null if the tap missed
	if (tube != null) sign.jolt(tube); // that tube stutters
});
```

`jolt(section?)` is a physical event on the model, not a canned effect: the
core supplies the dip, the eased recovery, the stutter back through the
ignition pops, the hum ducking with it, and the reduced-motion policy — the
same behaviour `flicker` schedules on its own. Omit the index for a whole-sign
shudder; dark and dead glass ignore it. _Effects_ stay yours: "flicker the die
that lost", "pulse twice on a six" is app logic composed from `jolt`,
`power` and `setText`.

Accessibility follows split-flap's split: the canvas is an **image**
(`role="img"`), never a widget. If tapping does something meaningful in your
app, the semantics are yours — put a real control over or beside the sign.

## For 3D consumers

The text→tube pipeline is pure and exported: `layoutTubes(text, font, opts)`
returns the corner-rounded centreline polylines + electrode ends per section
in sign units (y-down, baseline 0) — extrude them into real tube geometry on
your side, the way nixie's `nixieCathodes` tells the same story. Runs in bare
node.

## Performance

Path2D per section, built lazily and cached until the text/font changes;
passes are stroked with `shadowBlur` capped and an LOD that drops halation and
electrodes below ~28 px cap height. A sign is typically 5–30 sections — the
render loop stops the moment the last transient settles.

## Themes

`theme` bundles the two options that decide how a sign lives on a page: `'dark'` (the
default — lit tubes on a near-black wall), `'light'` (`polarity: 'absorb'` on a
near-white wall, because a bloom cannot read against white), or `'auto'` to follow the
page's `prefers-color-scheme`. Set `polarity` or `wall` yourself and that half is yours
from then on.

---

Framework wrappers ship `<NeonSign>` alongside the other cores:
**[@glowbox/svelte](https://www.npmjs.com/package/@glowbox/svelte)** ·
**[@glowbox/react](https://www.npmjs.com/package/@glowbox/react)** ·
**[@glowbox/vue](https://www.npmjs.com/package/@glowbox/vue)**. Pairs with
**[@glowbox/crt](https://www.npmjs.com/package/@glowbox/crt)**. Live demo:
<https://eetu.github.io/glowbox/neon> — turn the sound on, and let the
Cocktails show power-cycle once.
