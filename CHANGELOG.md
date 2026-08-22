# Changelog

All notable changes to the glowbox packages are documented here. The format is based
on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the packages share a
version and are released together.

## [Unreleased]

**The absorbing sign inks in colour** — `polarity: 'absorb'` gets the model it needed to
carry a diagram, not just a word: each gas discharges its own ink, a colour you name is
the pigment itself, and the tubes stop fogging the wall between them.

### Added

- **`GasSpec.ink`** — the pigment each gas discharges under `polarity: 'absorb'`, a table
  value per preset rather than a formula over the lit colour. It is where the invention
  lives: `co2`'s near-white fill inverts into a literal black light, while `gold` inks
  warm and `green` inks green.

### Fixed

- **neon: an absorbing sign keeps the colour information a lit one has.** A colour you
  name is the ink it lays down, so its lightness means the same thing inking as it does
  lit — a pale tube leaves a faint mark, a saturated one a deep mark, and two tubes of
  different lightness stay two tubes. A gauge (a quiet track ring under a bright meter
  arc) now reads as one instrument in both themes with one set of colours.
- **neon: the hot core of an inking tube is a second coat of its own pigment**, not a
  march to neutral black, so a green tube inks green at its very centre instead of
  arriving at the same near-black as every other fill.
- **neon: absorbed ink bleeds tighter than emitted light blooms.** Ink density now falls
  with each pass's blur — a pigment sits in the surface while light scatters through the
  air — which clears the grey haze that used to fill the space between neighbouring
  tubes on a pale wall.
- **neon: unlit glass reads as an object on a pale wall**, at a contrast in the same
  league as the glass on a dark one, so an absorbing sign's off state is hardware rather
  than a suggestion.

## [1.11.0] — 2026-08-21

**Light mode, per core** — a `theme` option on all eight displays, where "light" is each
one's own honest answer rather than a filter: paint inverted on the flap and dot boards,
`polarity: 'absorb'` on neon, plastic and faceplates on the emissive panels, the comic
look on the LED grid. Plus the housing pass that made it possible — every bezel is a
strip hugging its hardware instead of a fill of the canvas — and the split-flap card
finally printed in register with its own seam.

### Added

- **A `theme` option on all eight display cores.** `'dark'` (the default — the look
  every core has always had), `'light'`, or `'auto'` to follow the page's `prefers-color-scheme` and repaint
  when it flips. It is a bundle of colour **defaults**, never a render path, and a colour
  you set yourself stops being the theme's for good: `{ theme: 'light', onColor: '#c00' }`
  is a light board with a red dot and stays one when the page goes dark. What "light"
  means is each core's own answer, and for half of them it is not an inversion:
  - **split-flap** prints a bone strip in near-black, in a pale frame; **flip-dot** runs
    the same board with the paint the other way round; **neon** switches to
    `polarity: 'absorb'` on a near-white wall (a bloom cannot read against white);
    **lcd** was light-native all along, so the theme moves the plastic and leaves `panel`
    alone — the glass is hardware, not a mood.
  - **nixie**, **seven-segment** and **vfd** are emissive: the glass stays dark in both
    themes, and the theme is the housing — a heavier drop shadow and a brighter rim on
    the first two, the brushed silver of a 70s receiver on the vfd's faceplate.
    **led-grid** switches the LOOK, since an additive glow has nothing to add to on a
    pale ground: `comic`'s opaque ink-outlined LEDs on a bone room.

  Mirrored into every component in all three wrappers, and each core now exports the
  `Theme` type. The resolution, the listener and the who-owns-this-colour bookkeeping
  live in `shared/theme.ts`, symlinked into all eight (guarded by `check-shared`).

- **svelte-gallery: the header theme button drives the displays too**, so a route is one
  theme all the way down — page chrome, stage and hardware. It is **dark or light, and it
  opens dark**: no `auto`, because these are glowing retro displays and most of them are
  at their best in the dark, so the gallery makes the choice rather than asking the OS.
  (The cores still take `theme: 'auto'` — an app that wants `prefers-color-scheme` just
  passes it.) Where a page has its own swatch for a colour the theme owns (split-flap's
  card/ink/board, flip-dot's discs, neon's polarity + wall, the lcd plastic, the vfd
  plate, led-grid's look), the button moves those controls, using the core's own palette
  — a named colour is not the theme's to move, and the demo shows that rather than
  hiding it. The vfd page repaints its own chassis and room to match, because a silver
  faceplate screwed into a black case reads as a mistake.
- **`@glowbox/lcd`: extension faces — a `glyphs` option and the `LATIN_5X7` table.**
  Inject glyphs over the vendored ASCII font as character → 5×7 ASCII art (the
  face's own authoring format); CGRAM code points 0–7 still win, and patching
  `glyphs: null` hands back the plain face (nixie's null-reset contract).
  `LATIN_5X7` is the ready Western-European/Nordic table (Å Ä Ö å ä ö Ø ø Æ æ Ü ü
  ß É é Ñ ñ Ç ç °) — the A02 ROM's territory, where the ubiquitous A00 ROM had
  katakana and accents were a CGRAM job. Opt-in by import and tree-shakeable, so
  the core costs nothing more; `repertoire5x7()` and `compile5x7` are exported for
  repertoire checks and custom tables. The `glyphs` prop mirrors into `<LcdModule>`
  in all three wrappers (svelte/react/vue) — the wrappers enumerate their props, so
  a new core option has to join each by hand.
- **svelte-gallery `/lcd`: a Type mode.** An
  attract/type toggle in the header; the bench is one input per module row where
  the input caret IS the module cursor (`selectionStart` → `setCursor`), and a tap
  on the glass parks the caret on that cell (`cellAt`, padding the row out to the
  tapped column — DDRAM addressing doesn't care that nothing was written on the way
  there). Presets include a CGRAM bar ramp — printable block characters in the
  bench, translated to code points 0–7 at the seam — plus a line/block cursor
  toggle. Also new on the page: a POWER chip (watch the ink drain
  at crystal speed and the boot row replay on demand), the catalogue module
  sizes (8×1 / 16×2 / 20×4) — the `cols`/`rows` regrid the gallery never exposed —
  and the page injects `LATIN_5X7` (an ÄÄKKÖSET preset types it) with a
  font-showcase attract scene that marches the whole repertoire page by page.
- **`@glowbox/lcd`: a `bezelWidth` option.** Frame thickness in dot pitches
  (default 3, max 16), so the plastic holds its proportions at any canvas size; 0 is
  the frameless module, same as `bezel: null`. Mirrored into `<LcdModule>` in all
  three wrappers.
- **svelte-gallery `/lcd`: bezel controls.** A width slider plus a plastic chip and
  colour swatch under _size_ — thickness, colour, or no frame at all, where the glass
  takes the whole canvas.
- **svelte-gallery: every housing is switchable, on every route.** A chip beside the
  colour swatch drops the housing and shows the page through it — _glass module_
  (nixie), _window module_ (7-seg), _panel_ (flip-dot), _frame_ (split-flap), _wall_
  (neon, emit only: an absorbing sign needs a wall to ink), _faceplate_ (vfd, which had
  no bezel control at all), _plastic_ (lcd). Turn the backdrop pale and a display
  composites onto it. All of them sit in the same place — the _scene_ group, next to
  the backdrop swatch — so the switch is where the last page left it.
- **svelte-gallery `/nixie`: a filament swatch.** The unlit cathode wires, driving the
  core's new `wire` in 2D and the three.js wire material in 3D.
- **`board: null` on `@glowbox/flip-dot` and `@glowbox/split-flap`.** No plastic at
  all: bare discs, or cards over your own scene.
- **`wire` on `@glowbox/nixie`.** The unlit cathode-wire colour — the filament stack
  behind the glass, which was the one part of the tube fixed at a dull nickel. Patch
  `null` to reset; mirrored into `<NixieTube>` in all three wrappers, and forwarded by
  `createNixieRow` along with `bare`, so a whole clock can composite onto your scene.
- **`bare` on `@glowbox/seven-segment`.** Segments alone on a transparent canvas — no
  window tint, vignette, rim or shadow — the same contract and name as nixie's `bare`,
  for a housing of your own. Mirrored into `<SevenSegment>` in all three wrappers.
  With it, every core's housing can be dropped: `bezel`/`wall`/`board` take `null`,
  nixie and seven-segment take `bare`, led-grid takes a transparent context.

### Fixed

- **`@glowbox/split-flap`: a no-op resize no longer throws the sprite cache away.** A
  ResizeObserver fires for observations that changed nothing, and `resize()` re-baked
  regardless — clearing every flap sprite and, by assigning `canvas.width`, the frame
  on screen. At startup that baked the whole drum twice; during a window drag it
  re-baked continuously. It now returns early when the box and the pixel ratio are
  unchanged, and the two throwaway canvases each face used to allocate (the card and
  its glyph layer) are one reused scratch apiece. Canvases allocated over a
  three-second run of the gallery board: 182 → 90. Frame rate is unchanged — it was
  never allocation-bound, it is fill-rate bound, which is what
  `node scripts/bench-split-flap.mjs` is now there to show. **`@glowbox/flip-dot` gets
  the same guard** — its bake is heavier still (the board layer, both face sprites and
  the whole squash atlas, up to 64 canvases on a dense board).
- **`@glowbox/split-flap`: the print is registered against the card's seam.** Two
  faults, one cause — the artwork sat where a shared baseline happened to put it. A
  colon's upper dot straddled the cut and came apart as the card fell, and every
  letter was cut a little above its middle, so the two halves never matched. The card
  is now registered on the cut: the drum's cap band is centred on it, measured from
  the font in use (so a `font` of your own registers too), and the sprite is an even
  number of device pixels so the two flaps are the same height. Glyphs whose ink
  leaves a gap at the cut — a colon, a hyphen — shift up to 5% of the card to put the
  cut in the middle of that gap; letterforms have no gap and are cut through the
  middle, which is the display's signature.
- **Every housing is a frame, not a letterbox — `@glowbox/lcd`, `@glowbox/vfd`,
  `@glowbox/flip-dot`.** A core whose content keeps its aspect used to fill the whole
  canvas with its plastic, so a module in a box of a different shape sat in bars of
  bezel — badly wrong for the family's one reflective, light-theme-native core, and
  not much better on the others. Each housing is now a strip hugging its content
  (lcd's `bezelWidth` of glass margins, vfd's fitted faceplate, flip-dot's panel
  margin of 0.35 cells), and canvas past it stays transparent — the model nixie and
  seven-segment already had, and where neon's `wall` and led-grid's `background` stay
  full-canvas because a wall genuinely is one. Flip-dot's panel is part of its fit, so
  a board in an exactly-fitting canvas draws its discs a little smaller than before.

## [1.10.0] — 2026-08-02

The eighth display core — a **character LCD module**, the family's first reflective
display — plus the **family-alignment pass** that swept all twelve existing public
API surfaces into one look. Now **thirteen** packages in lockstep.

### Added — the eighth display core

- **`@glowbox/lcd` — a character LCD module (HD44780-class), the family's first
  REFLECTIVE display**: dark ink on a lit pane, native to a light page the way every
  emissive sibling is native to a dark one. The core is the liquid crystal, not the
  character grid (a div grid + an LCD webfont does the layout for free):
  - **Slow shutters**: every dot chases its target over real tens of milliseconds
    (`response`; rise beats fall, so moving text drags a trailing ghost) — cutting the
    power drains the ink at crystal speed instead of blanking.
  - **The contrast pot** saturates through a sweet spot and then overdrives: past
    ~0.85 the resting dot lattice darkens and passive-matrix **crosstalk** streaks
    grow down heavily driven columns — emergent, not scripted.
  - **Panel presets**: `'green'` (STN, readable unlit — reflective means exactly
    that), `'blue'` (a NEGATIVE transmissive image: no backlight, no image),
    `'white'` (FSTN).
  - **Boot** shows the uninitialised top row of solid blocks — the 16×2 symptom.
  - **CGRAM**: 8 custom glyph slots (`setGlyph`), addressed from text by code points
    0–7, bit 4 = leftmost — the datasheet's own convention.
  - **`age`** runs the franchise wear arc at column-driver granularity: dim →
    flickering column → a dead blank stripe of bare lattice.
  - Family contract throughout: `setText`/`setLine`/`setCursor`/`power`,
    `cellAt`/`cellRect` (viewport), `setOptions`/`resize`/`snapshot`/`dispose`,
    `label` → `role="img"`, factory-returns-null, SSR-safe, zero deps. **No sound
    module** (an LED-backlit module is silent — vfd's precedent).
- **`<LcdModule>` in all three wrappers** (svelte/react/vue) with the family
  component contracts (`oncreate`, styling passthrough, `expose()`d `lcd` handle),
  and a `/lcd` gallery page: typing under a blinking cursor, a CGRAM bar meter, a
  scrolling line dragging its ghost, and a power cycle through the boot boxes — on a
  light stage, where reflective glass belongs.

### Fixed

- **`release.yaml` was missing `vfd` from BOTH of its package loops** (the lockstep
  version gate and the publish loop) — which is why `@glowbox/vfd@1.9.0` had to be
  published by hand. The lists now carry `vfd` and `lcd`, and a comment marks them as
  enumeration that every new package must join.

Also in this release, a **family-alignment pass**: a full audit of all twelve public API surfaces found the
shared bones solid but the wrapper passthrough and a few core seams drifted — the
packages shipped one at a time and were never swept as a set. Everything here is
additive or bugfix-level; no breaking changes. One rule the audit produced, now
documented: **hit-test rect helpers return viewport coordinates** (split-flap's
`cellRect` contract); vfd's `elementRect` shipped canvas-relative in 1.9.0 and stays —
the documented exception.

### Added — family alignment

- **`oncreate` on every React and Vue component** (all seven, both frameworks) — the
  same contract Svelte always had: called with the core handle after creation and with
  `null` on teardown. React's forwarded ref and Vue's `expose()`d keys are unchanged;
  this is the notification they couldn't give. Vue binds it as a prop
  (`:oncreate="fn"` — an `@create` listener would camelize past it).
- **Svelte styling passthrough**: every component now takes `class` and `style`,
  forwarded to its `<canvas>` (React always had `className`/`style`; Vue falls through).
- **Type exports**: `VfdValue` from `@glowbox/svelte` (was private to the component)
  and `Frame` from `@glowbox/vue` — both now gated by the publish smoke.
- **`@glowbox/neon` `sectionRect(section)`** — the rect partner `sectionAt` never had:
  a tube section's glass bounds in viewport coordinates, `{left, top, width, height}`,
  for parking a DOM overlay on a tapped tube.
- **`@glowbox/flip-dot` `dotAt(clientX, clientY)` / `dotRect(x, y)`** — the family
  hit-test pair (split-flap's `cellAt`/`cellRect`, at dot granularity). `dotAt` is
  cell-granular (a fingertip doesn't aim between discs); `dotRect` frames the disc.
- **`@glowbox/crt` joins the family contracts**: `background` now takes the shared
  `Color` (an `[r,g,b]` triple or any CSS string — strings still pass to `fillStyle`
  verbatim, alpha included), and the screen handle gained `snapshot()`.

### Fixed — family alignment

- **`@glowbox/nixie`: patching `color`/`background` with `null` now resets to the tube
  defaults** (seven-segment's contract) instead of being silently ignored — a themed
  tube can hand the colour back without knowing the default. `NixieRow` forwards the
  reset to every tube.
- **`@glowbox/vfd`: stale doc comments** naming `VfdPanel.bars`/`VfdPanel.blank`
  (pre-1.9.0 names) now say `setBars`/`clear`; `elementRect`'s coordinate space is
  spelled out.

### Changed — family alignment

- `@glowbox/extras`: the audio visualizers' declared return type is the exported
  `DrawFn` (same shape as before); the audio module, `makeFramePlayer` and the
  `PlayerControls` transport are now documented in the README.
- Wrapper READMEs document all seven components (four were missing everywhere), the
  instance-access contract per framework, and composing with `@glowbox/crt`; the three
  wrapper `package.json` descriptions/keywords now name every display.
- `@glowbox/vue` internals: one deep-options watch idiom across all components (two
  used an explicit prop array); `@glowbox/react` dropped two dead `?? null` coercions.

## [1.9.0] — 2026-08-01

The seventh display core: a **vacuum-fluorescent display panel** — the front of a
90s mini-system, and the first _heterogeneous_ core in the family. Every one before
it renders an array of identical modules or a block of text, where a stereo faceplate
is a zoo of unlike parts sharing one vacuum envelope. Laying those parts out is not
why it exists — a div grid does that. The envelope is: phosphor that keeps glowing
after the drive stops, one multiplex with a real dimmer, a power-on self-test that
lights the whole inventory, a tinted window that hides the undriven anodes, and two
ways to fail. Now **twelve** packages in lockstep.

### Added

- **`@glowbox/vfd` — the seventh display core: a VFD panel.** Declare the hardware
  once as a design `frame` plus a `layout` of elements, then drive it by name with
  `set`/`light`/`setBars`/`setDots`. The element kinds: **`digits`** character cells in `'7seg'`,
  `'14seg'`, `'16seg'` (starburst geometry from one hexagonal-bar primitive, so diagonals
  cost no extra code; numerals authored off the seven-segment strokes, so a frequency reads
  identically in every mode) or `'matrix'` 5×7; **`legend`** a screen-printed word —
  **one anode, one wire**, lit as a unit, because that is physically what DOLBY NR is —
  with `printed: true` for the silkscreen twin that is never wired; **`bars`** a
  spectrum/VU grid with `peakHold` caps that fall on their own (a cap is not extra
  hardware: it is the top block staying driven while the body drops away) and an optional
  `wedge` ramp; **`icon`** from plain SVG **fill** data — neon needed centrelines because a
  tube is a stroke, but a VFD anode is a printed patch, so editor output works as-is and
  holes fill correctly; **`scale`** a tuning dial of discrete cursor blocks, because nothing
  in a vacuum envelope slides; **`dots`** a raw dot grid (below); and **`rule`** silkscreen
  furniture.
- **The envelope, which is the point.** `persistence` gives every anode a brightness
  integrator with fast attack and slow release — the **smear** as an analyser bar falls,
  which no font, filter or CSS transition can reproduce. `brightness` is the **DIMMER**
  button off the front of a receiver: the whole face at once, non-linearly, with 0 as
  DISPLAY OFF (not blank — the undriven phosphor and the silkscreen are still behind the
  glass). `filament` draws the hot wires in front of **everything** and `grid` the control
  mesh **continuous across the panel** rather than per digit, because there is one envelope.
  `selfTest()` lights every anode for ~1 s then settles — it exists only because the panel
  knows its complete inventory. `filter` is the tinted window, applied as a single multiply
  pass so it is never folded into an anode fill twice; it crushes the undriven-anode ghosts,
  which is why the things were fitted (`filter: 'none'` shows a filterless panel). `zones`
  adds windows over **regions** of that glass — the amber band across a level meter, the red
  rectangle a RECORD block needs to be visible at all. A zone belongs to the **panel**, not
  to an element, because that is what it is: plastic over a rectangle, tinting whatever sits
  behind it. `age` runs the franchise wear arc at anode granularity (dim → sparse flicker →
  dead) **plus** the failure that belongs to vacuum fluorescence: past ~0.6 a multiplex grid
  weakens and a **vertical band** of the panel reads dimmer, cutting across whichever
  elements sit in it.
- **One flat anode inventory.** `compilePanel` is exported and pure — it compiles every
  element kind down to a single list of anodes (a fixed patch of phosphor with an integer
  address and a grid column), which is what lets persistence, the dimmer, the self-test,
  wear and the grid banding each be one uniform pass over one `Float32Array` instead of a
  renderer per kind. Also the seam for a 3D consumer: extrude the polygons, drive them with
  `driveElement`.
- **A `dots` element kind** — a raw `cols` × `rows` grid of individually addressable dots,
  driven with `panel.dots(name, bitmap)` (a row-major array or an `(x, y)` function; row 0
  is the top, because what you feed it is an image). This is the graphic half of a panel, and
  it exists because a character-addressed field structurally cannot do two things these
  displays really did: play an **animation**, and scroll text **smoothly by dot column**
  rather than jumping a whole character — which, under persistence, reads as two glyphs
  stacked rather than as motion. Values are 0..1 and fractional values are honest: a
  multiplexed anode dims by duty cycle, so greyscale maps straight on with no dithering.
  Every dot is an anode, so a 120 × 7 ticker is 840 of them.
- **`clear(name?)` — stop driving an element, or the whole panel.** Not the same as writing it zeros: a `bars`
  element with `peakHold` remembers its caps, and a cap resting on the floor row it never
  falls below is a lit line across the element for good. A panel whose window has more than
  one job — an analyser field that becomes a graphic display on the DISPLAY button, which is
  what these units did — needs the driver it switched away from to stop, memory and all.
  `fallPeaks` accordingly leaves a cap of -1 (a band with no cap) alone rather than resting
  it on row 0. A cleared `scale` shows no cursor rather than one parked at zero: a dial with
  nothing tuned in is an empty scale. With no argument it stops every drivable element, as
  flip-dot's and split-flap's `clear()` do; silkscreen is ink and stays.
- **The decimal point takes no cell.** In every segment mode `.` and `:` ride the cell
  before them instead of consuming one, the way a driver chip wired its point and colon
  anodes — which is why `'FM 98.50'` fits eight cells. A `'matrix'` cell draws its own `.`
  as a glyph, so there it takes a cell like anything else.
- **Geometry, not events.** `elementAt(clientX, clientY)` names the element under a point
  and `elementRect(name)` gives its extent in CSS pixels; the core attaches no listeners,
  matching split-flap's `cellAt` and neon's `sectionAt`. Elements made only of silkscreen
  are skipped, so a `rule` box around a zone never swallows the taps meant for what is
  inside it. Both answer from where the anodes actually ARE rather than from the declared
  box, which matters for `icon`s placed through a shared design `frame`: their path
  coordinates are frame coordinates, so they have no meaningful box of their own.
- **`<VfdPanel>`** in `@glowbox/svelte`, `@glowbox/react` and `@glowbox/vue` — declare
  `frame`/`layout`, then drive content either declaratively through `values` (keyed by
  element name; the value's own type picks `set`/`light`/`bars`) or imperatively through
  the handle, which is what an analyser at frame rate wants. Each wrapper syncs the
  hardware on its own effect/watcher, separate from the appearance patch, so a slider tick
  can never cost a re-compile.
- **A `/vfd` gallery route** — two pieces of glass in one chassis, sharing one set of
  envelope options so a single dimmer press or filter swap reaches both, and one scene
  clock so they cannot disagree about what the unit is doing:
  - the **faceplate**: segment character field, word annunciators, a tuning dial whose
    ticks and 88/98/108 are silkscreen while the cursor is the anode (how a receiver did
    it — a scale never changes, so nothing wired thirty anodes for one), the transport
    mechanisms, and a dot-matrix ticker that crawls by column;
  - the **analyser strip**, one window with three jobs picked by source: a 20-band spectrum
    with peak caps, a graphic EQ curve laid over its top with the active preset named
    alongside (morphing between FLAT/ROCK/JAZZ/POP/VOCAL), and a 4:3 **graphic display**
    playing a frame animation dot by dot. That swap is the DISPLAY button, and sharing a
    field is why it is a mode rather than a fourth window: a 4:3 grid centred in the strip
    spends no anodes on the dark bands a full-width one would letterbox with, so the
    picture gets more rows for fewer of them.

  It runs attract-mode across four sources: tuner sweeping presets with ST/MONO following
  the lock, CD counting tracks with the disc turning and the counter alternating elapsed
  against remaining (which is what REMAIN is for), a tape deck moving through PLAY, PAUSE
  and RECORD, and the graphic display. All four glyph repertoires are demonstrable — a
  control swaps the main field between 7-, 14-, 16-segment and 5×7 — and the chassis has a
  working three-position DIMMER, a power switch, and a tap readout wired through
  `elementAt`.

- **The transport animations are the honest ones.** A reel is not a rotating shape: it is a
  ring of separate dash anodes with the lit run crawling around it, which is how Technics
  drew it, and the tape is a dashed run between the hubs travelling the way it is being
  spooled — counterclockwise reels, because a wheel turning clockwise has its lowest point
  moving left. RECORD is a lit block with the letters knocked **out** of it, punched by
  winding rather than drawn as glyphs, under its own window in the glass: the green filter
  cannot pass red, so the panel carries an amber strip over that rectangle exactly as the
  real glass did. Pause **freezes** the mechanism rather than blanking it — the crawl runs
  on an accumulated phase, so it stops where it was instead of snapping to frame zero.
- **Frame animations fall out of `icon` for free.** Several icons in one box with exactly one
  driven is how the glass actually did rotation: it carried a few fixed alternate anodes and
  the driver lit them in turn.
- **The glow is not `shadowBlur`.** It is the most expensive thing a 2D canvas does, and one
  gaussian per lit anode does not scale — a dot-matrix strip took the demo faceplate to
  5 fps. Batching per element helps the call count but not the cost, because a gaussian
  prices roughly area × radius and the area is the same either way. So every lit anode is
  drawn flat into a small offscreen canvas and composited back **upscaled** — the sampler's
  own filtering is the blur, done once for the whole envelope in two taps instead of
  hundreds of gaussians. With per-element colour caching (which had been allocating an
  object and re-parsing a colour ~1500 times a frame), the benchmark's worst case went from
  17–26 fps to 40–63 depending on anode count, and the demo from 5 fps to vsync. Small dots
  read better for it too, since a per-anode bloom had been smearing neighbours together.
- **`scripts/bench-vfd.mjs`** — the house manual-benchmark pattern for this core: frame
  throughput on the built package, vsync uncapped, one scenario per cost being priced. It
  recorded one negative result worth keeping: caching the static ghost/silkscreen layers to
  an offscreen is _slower_ than re-filling them, because those fills are at alpha 0.014 and
  nearly free while a full-canvas blit is a million pixels every frame. They are
  deliberately inline.

### Changed

- **Vendored duplicates became one file each, shared by symlink.** ~2,200 lines that existed
  as hand-maintained copies — the colour parser in **seven** packages, the sound engine in
  three, the 5×7 face in two, the SVG path parser in two — now live once in `shared/` and are
  symlinked into each package's `src/`. **Nothing changes for consumers**: each bundler still
  inlines the file, so every package stays genuinely zero-dep and the dists are unchanged
  (the two that moved by a hair, neon and vfd at +20 B, are the path split's one extra
  module boundary).

  The copies were identical only by discipline, with nothing to catch a fix applied six times
  out of seven — and `path.ts` had already drifted into two files whose parsers were
  character-identical but whose intent was no longer legible. Symlinks make divergence
  impossible rather than merely detectable, which is why they beat a drift check.

  `shared/color.ts` is led-grid's superset (`Vec3`, `parseColor01`); the 2D cores don't import
  those and they tree-shake away, verified against the size budgets. `shared/path-parse.ts`
  is the tokeniser, command walker and adaptive flattener; what each core does with the
  result stays its own, because that is the one real difference — neon needs open
  centrelines (a tube is a stroke), vfd closed rings (an anode is a printed fill). The
  refactor was checked by capturing `pathToStrokes`/`pathToPolys` output over 40 cases before
  and after: byte-identical.

  **`node scripts/check-shared.mjs`** (in `validate`, CI and the release gate) asserts the
  links really are symlinks. That is the Windows guard: git there writes symlinks as text
  files containing the target path unless `core.symlinks=true` and Developer Mode is on, and
  without the check that surfaces as a baffling error about a module whose contents are
  `../../../shared/color.ts`.

  Deliberately NOT shared: the small per-file `rgba`/`mix`/`c255` helpers. `rgba` genuinely
  differs — flip-dot and split-flap don't clamp alpha, neon and vfd do — so unifying them
  would be a behaviour change to shipping render paths rather than a move.

### Fixed

- **The clock colon was stamped through the glyph.** Both beads sat at the cell's horizontal
  centre, on top of whatever character the cell was showing, so `12:34` rendered as two dots
  punched through the `2`. They now ride the trailing gutter beside the decimal point, which
  is where a driver chip wired them — and the only place they can go, since a `.` and a `:`
  both attach to the cell before them.
- **A NaN level killed a band for good.** `clamp01` passed NaN through, it landed in the
  peak cap, and every later comparison against a NaN cap is false — so the band went dark and
  stayed dark, with no way back. `clamp01` now coerces NaN to 0, and `fallPeaks` treats a
  non-finite cap as absent rather than propagating it.
- **A backwards clock inflated the peak caps.** `fallPeaks` subtracted `rate * dt` without
  checking the sign, so a negative `dt` added instead: four rows became forty-four. It only
  moves caps downwards now.
- **A frame with no area threw from inside the render loop.** `frame: [0, 0]` made the scale
  Infinity and every coordinate NaN, which surfaced as canvas throwing `InvalidStateError`
  once a frame, uncatchably. `compilePanel` now rejects a non-finite or non-positive frame
  with a readable error, so it fails at construction instead. `setLayout` compiles before it
  commits, so a bad frame throws and leaves the panel exactly as it was.
- **A throwing `dots` bitmap function threw forever.** It is sampled every frame, so an
  exception escaped the rAF callback on each one. The element is now blanked, the throw is
  reported once, and the panel carries on.
- **`layCells` raised a bare `RangeError`** on a negative `chars` (`out.length = -4`) where
  `compilePanel` clamps. It clamps too.

### Notes

- **Names are the wiring**, so a duplicate or empty one **throws** rather than leaving the
  second element quietly undriveable; driving an element through the wrong call (`bars()` on
  a `digits` field) **warns** rather than landing in a state field that element's driver
  never reads; `bars`/`dots` **copy** their input, so an array reused for the next frame
  cannot retroactively change the display (a function handed to `dots` is kept and sampled
  per frame — that is its purpose); and the hardware lives in **`setLayout(layout, frame?)`**
  rather than `setOptions`, because the one expensive call on the handle should not be
  reachable by re-sending an option bag.
- **V is asymmetric on the starburst modes.** It runs down the left rail, in along the
  lower-left diagonal and back up the upper-right one, so its vertex is the bottom-left
  corner rather than the middle of the baseline. Nothing on a 16-segment cell touches
  bottom-centre except the stem, and that spelling is Y. This is what the reference
  16-segment ASCII tables use.
- **`persistence` defaults low — 0.05, about 37 ms.** It is a stylized control, not a
  physical one: real ZnO:Zn decays in microseconds, so no receiver smeared much, and what
  everyone remembers is the multiplex refresh plus their own eye — a few tens of
  milliseconds. Turned up it is still the thing the core exists to be able to do at all;
  past ~0.45 a character field ghosts into its previous value.
- **No sound module.** The first core in the family without one, deliberately: a VFD
  has no voice, and the muting relay's clunk belongs to the receiver rather than to
  the display.
- **No invented element for the light theme.** Neon needed `polarity: 'absorb'`
  because a bloom cannot read against white; a VFD was always a dark rectangle
  screwed into a chassis, so `bezel` (the faceplate, or `null` for a transparent
  canvas) is the whole answer.
- `@glowbox/seven-segment`'s `style: 'vfd'` is untouched — a single digit in a VFD
  material is still a legitimate small thing, and the panel is a different object.

## [1.8.0] — 2026-07-30

The sixth display core: a **glass-tube neon sign** — the first core to arrive
after the planned five, and the first to clear the wow bar against a rival as
cheap as CSS `text-shadow`. It wins by refusing to be a glow filter: the
letterforms are single-stroke centrelines bent into tubes, the glass is visible
unlit, power-on is an electrode strike rather than a fade, tubes wear out and
die, and the sign's only sound is its own transformer following the lit glass.
Sign artwork composes beside and behind the words (SVG paths in, real overlap
where a front piece cuts the runs behind it), an invented element lets a sign
live on a pale wall, and the tubes answer taps. Now **eleven** packages in
lockstep.

### Added

- **`@glowbox/neon` — the sixth display core: a glass-tube neon sign.** Text bent
  into single-stroke tubes (two vendored Hershey faces: cursive `script`, block
  `sans`, printable ASCII; custom `NeonFont` for logos), rendered as constant-width
  glass with electrode stubs — and the glass exists as an object: **unlit tubes stay
  visible** (phosphor coats show their paint), power-on is a **strike sequence**
  (electrode arcs, partial-ignition pops, overshoot-settle; near-instant off), `age`
  runs the franchise wear arc at tube granularity (dim → flickering tube → dead
  glass), `flicker`/`tired` model unstable electrics, and `program` is the flasher
  cam (`flash`/`chase`/`reveal` — hard rate-capped below ~3 events/s for
  photosensitivity, degraded to steady under reduced motion). Gas presets pick the
  fill (`neon`, `argon`, `helium`, `co2`, phosphor `green`/`gold`/`rose`); `color`
  takes one colour per line. Optional `sound`: the sign's ONE sound is its
  electricity — **`createHum`**, a continuous transformer hum (mains-doubled
  fundamental, muted in hidden tabs) whose level follows the lit glass, so a
  staggered strike flutters it in from silence and a dropout kills it; the only
  event sound is a subliminal solenoid tick as each ignition takes (flavour,
  not foley). Added to the shared vendored sound engine and back-ported
  byte-identical to flip-dot/split-flap (it tree-shakes out of their dists;
  their size budgets guard that). The pure `layoutTubes` pipeline is exported for 3D
  consumers. Sign **artwork** rides along: `art` pieces — single-stroke SVG path
  data (`pathToStrokes` is exported: the full command vocabulary, arcs and compact
  flags included, flattened adaptively) or polylines — compose against the text
  block the way sign makers work (`behind`/`left`/`right`/`above`/`below`, sized
  to the text, tiltable), each its own tube with its own gas/colour that strikes,
  ages and dies like any section; `steady: true` wires a piece past the flasher
  cam (the diner border that stays lit around the blinking word), and
  `opaque: true` makes a piece's closed subpaths a solid face that CUTS the
  tubes behind it shy of its edge — glass can't hide glass, so overlap works
  the way a sign maker does it (the classic overlapping dice pair; fully
  covered tubes disappear, cut ends keep no electrode). **`polarity: 'absorb'`
  is the one invented element**: a discharge that runs DARK, multiplying the
  same ramp into a pale wall instead of adding it to a dark one — because a
  bloom cannot read against white, and a sign should belong in a light theme
  too (gas colours darken into ink, so a white tube inverts into a literal
  black light; an unnamed `wall` follows the polarity) — and it is settable
  **per art piece**, so white dice can shine black beside lettering that still
  shines gold: it's the element that runs dark, not the circuit.
  Absorbed light composites **once per frame on its own layer** rather than
  per pass — a blend mode on a blurred stroke is a slow path everywhere, and
  300 of them took a heavy sign to ~5 fps; the ink is now as cheap as the glow
  (measured 212 ms → 16.8 ms per frame). A crowded sign (past ~24 tubes) also
  steps down to the compact 4-pass ramp, which took the same sign's worst frame
  from 68 ms to 42 ms.
  **`sectionAt(clientX, clientY)` + `jolt(section?)`** make the tubes tappable
  on the split-flap contract — the library answers the geometry and owns what a
  disturbed tube does (dip, eased recovery, a stutter back through the ignition
  pops, reduced-motion policy); the consumer owns the listeners, and the sign
  attaches none. A shared `frame` pins
  several pieces cut from one drawing to the same design space — the
  multi-colour portrait pattern (the gallery's tribute singer: neon quiff,
  helium face, argon jacket, gold notes, white mic — never gonna give you up).
  `tilt` sets the whole
  text block on the rising diagonal of the classic window sign, and `lineOn`
  gives each text line its own switched circuit — the motel sign's NO cuts to
  unlit glass and strikes back in while VACANCY holds. Wrappers ship
  `<NeonSign>` in svelte/react/vue; the gallery grows `/neon` (Cocktails
  power-cycle, nib-authored dice flanking the word, the worn NO / VACANCY, Open
  in its steady border ring, flash/chase, a gas tour, the tired transformer,
  free text with the full tinker set). The Hershey acknowledgement ships inside
  the package (`HERSHEY_LICENSE`, referenced by the face data) and as
  `LICENSE-hershey`.
- **Gallery: two interactive split-flap shows** (demo only, no package changes).
  **Scroller** — a text scrolled by a scrollbar built from the panel itself: the
  right-hand column rides a five-flap rail drum (`' ▲▼░█'`), taps on the arrows turn
  a page and taps on the rail jump (`cellAt` hit-testing). No auto-scroll — the text
  is an
  easter egg (a small story about a boy and the split-flap board at the edge of the
  city that never got the LED upgrade), and reading pace belongs to the reader. **Poll** — tap a row to vote for a display core: three
  drum kinds on one board (letter names, five-colour chroma bars, `DRUM_DIGITS`
  tallies), and when a bar hits the edge every bar halves — renormalisation as a
  full-board cascade. Votes trickle in on their own between taps.

### Changed

- **`@glowbox/split-flap`: the slap joined the family voice.** The card slap now
  speaks the flip-dot's measured solenoid click stretched ~2× — the same kind of
  mechanism with a longer throw, a falling card against a flicking disc —
  replacing 1.6.0's papery low-mid recipe, so the mechanical cores sound like
  siblings the way they render like siblings.

## [1.7.1] — 2026-07-29

### Added

- **`@glowbox/split-flap`: `cellAt(clientX, clientY)` and `cellRect(x, y)`** — the
  pointer↔module mapping, owned by the library that owns the layout maths: `cellAt`
  turns a pointer event into a module coordinate, `cellRect` turns a module back into
  the viewport rectangle of its card window (gap and fallen stack excluded — the
  exact place to put a focusable DOM overlay). The README's clickable-modules recipe
  now uses them.

### Fixed

- **`@glowbox/split-flap`: non-finite coordinates threw in 1.7.0.**
  `setChar(NaN, 0, ch)` (also `setLine`/`getChar`) slipped past the bounds guards —
  NaN fails every comparison — and hit the new per-module drum lookup as
  `drum[NaN]`, a `TypeError` where 1.6.0's board-global drum made the same index
  harmless. The guards now reject non-finite coordinates explicitly.
- **Sound note (not a bug):** an "AudioContext opens without a gesture" report
  against 1.7.0 reproduced identically on 1.6.0 — and only under CDP-driven probes:
  a Playwright/Puppeteer `evaluate` runs with `userGesture: true`, permanently
  activating the page, after which booting audio is exactly what the autoplay
  policy permits. Measured passively, neither version opens a context without a
  real gesture. Documented at the gesture gate in both vendored sound engines.

## [1.7.0] — 2026-07-29

### Added

- **`@glowbox/split-flap`: drum zones** — `drums: [{ x, y, cols, rows, charset }]`
  puts different drums at different locations, the way the real boards were built:
  letter modules for the destination field, dedicated short digit drums for the
  time and track columns (short drum, short wraps, snappy rollovers). Later zones
  win overlaps; zones re-card live via `setOptions` and re-clip when the board is
  re-tiled. `<SplitFlap>` in svelte/react/vue passes `drums` through. The gallery's
  departures show now runs its time and track fields on dedicated drums — the red-X
  cancelled flap rides a 12-flap track drum instead of the full alphabet.

### Fixed

- **`@glowbox/crt`: the wrapped display stays accessible.** Element mode used to hide
  the composited source canvases with `visibility: hidden`, which strips them from the
  accessibility tree — and since the output canvas is `aria-hidden` (a visual
  duplicate), a wrapped display vanished from assistive tech entirely, voiding the
  display cores' `role="img"` + live-label contract. Sources are now hidden with
  `opacity: 0` (identical layout and visuals; the semantics stay readable), and the
  contract is documented in the README — including the same rule for canvas-mode
  placement.

## [1.6.0] — 2026-07-28

The fifth display core: an **electromechanical split-flap (Solari) display** — the
departure board. Where the flip-dot rattles, this one _cascades_. Now **ten**
packages in lockstep.

### Added

- **`@glowbox/split-flap`** — `createSplitFlap(canvas, opts)`, a 2D-canvas board of
  split-flap modules. Zero deps, SSR-import-safe, ~5.8 kB.
  - **Mechanism-honest model**: each module is a drum of flap cards hinged at the
    split line (a card carries the top half of one character on its front, the
    bottom half of the next on its back); a flip is a gravity **release** with a
    hard stop and a settle bounce, rendered with **true perspective** (projected
    strips — the free edge magnifies toward the viewer near edge-on). The drum is a
    **ratchet**: reaching an earlier character wraps the whole flap sequence, the
    cascade that made these boards famous.
  - **Drums as data**: `charset` order is drum order, one grapheme per flap
    (katakana and emoji ride as single cards; input is NFC-normalised). Presets
    `DRUM_NORDIC` (default, with ÅÄÖ), `DRUM_ALNUM`, `DRUM_DIGITS`.
  - **Chroma drums**: `palette` paints flaps solid and a wall of modules becomes a
    rough image display — `chromaDrum()` generates a full hue-ring drum (grey ramp
    plus hues × shades, serpentine so gradients are neighbouring flaps; `hues: 0`
    for monochrome), `paletteFrame()` maps RGB frames onto it (nearest-colour, or
    Floyd–Steinberg). **`FlapFace`** re-inks individual flaps
    (`{ glyph, ink, paint }`) for dedicated marks — a red X, a whole-word DELAYED
    card — without duplicating alphabets.
  - **Card-slap sound** over the vendored `createMechSound`, extended with noise
    shaping (`noiseLpHz`, `noiseDecay`): a papery band-limited thud, no pitched
    ping, tuned by ear. Budgeted clatter, gesture-deferred AudioContext, tab-restore
    safe.
  - **Flat matte by default**; `shaded: true` adds the mechanical anatomy matched
    against module close-ups — recessed wells, card gradients, hinge clips in front
    of the flaps, the ribbed pile of fallen cards, the edge-on glint.
  - API: `setText` / `setLine` / `setChar` / `getText`, live `setOptions`
    (charset/palette swaps re-card the modules in place), `aria-label` reads the
    shown text.
- **`<SplitFlap>`** in `@glowbox/svelte` / `react` / `vue` — `text` prop drives
  `setText`, options update live, imperative handle via `oncreate` / ref / expose.
- **Demo**: `/splitflap` in the gallery — departures with Finnish stations (late
  trains lose their platform to a dedicated red-X flap), a date-and-seconds flip
  clock, free text, a **chroma slideshow** of postcard frames with a
  mono/coarse/rich/ultra drum selector, matrix rain on a half-width-katakana drum,
  and self-playing snake and pong on three-flap drums; a resolution section
  (presets and free cols × rows) mirrors the LED page.

### Changed

- **`@glowbox/flip-dot`** shaded mode grew the disc's **stop posts**. Real
  mechanisms vary by manufacturer, but all of them stop the disc against one of
  two posts sitting at ±90° to the pivot axis; the rim hole wraps the post the
  current face rests against and mirrors to the other on flip. A matte **post
  head** now shows through the hole, the free post peeks past the rim, and the
  board is a **molded waffle** — square sockets with pyramid facets catching
  light in the corners between discs.
- **`createMechSound`** (flip-dot and split-flap, vendored copies kept identical):
  the tick gained noise shaping — `noiseLpHz` (band-limit the burst from above)
  and `noiseDecay` (burst length). Additive; existing recipes unchanged.
- Size budgets adjusted for real growth (svelte 6.5 kB, react 2 kB, flip-dot
  5.5 kB — the mechanism details above). The chroma slideshow ships as a purpose-built `chroma.gif` (six locally
  generated postcard frames, 8-second delays baked in).

## [1.5.1] — 2026-07-27

Version-number recovery, no code changes: the `v1.5.0` publish run stopped at
`@glowbox/flip-dot` — its `1.5.0` had been accidentally published (and unpublished)
during the manual first-publish dance, and npm permanently burns a version number
that ever existed. Three packages had already shipped `1.5.0`; `1.5.1` is the same
code for all nine, in lockstep.

## [1.5.0] — 2026-07-27

The fourth display core: an **electromechanical flip-dot board**. Where the LED grid
glows, the nixie burns and the seven-segment fades, this one _moves_ — and, if you let
it, clicks. Now **nine** packages in lockstep.

### Added

- **`@glowbox/flip-dot`** — `createFlipDots(canvas, opts)`, a 2D-canvas board of
  physically flipping dots. Zero deps, SSR-import-safe, ~4.6 kB.
  - **Physical flips**: each disc rotates about its pivot axis (diagonal by default,
    like the real pivot pins), foreshortening to an edge-on sliver mid-flip; frame
    changes sweep the board as a row-driver **scan wave** (stagger scan / random /
    none). A dot re-targeted mid-flip completes its previous flip first.
  - **Mechanism-honest detail** (researched against patents, photos and a 3D model of
    the mechanism): the drive-pole **notch** sits 90° off the pivot axis and mirrors
    between disc faces — the electromagnet's pole pair straddles the axis. The
    `shape: 'square'` style is the octagonal bus-sign vane: **one triangular flap
    folding across the diagonal hinge** over two painted base halves — blank hides
    the base's pole hole, open reveals it.
  - **Flat matte by default** (how the boards photograph); `shaded: true` opts into
    the lighting story — face gradients, socket wells, axle dimples, edge-on glint.
  - **`ditherFrame`** — threshold (default) / Bayer / Floyd–Steinberg, pure and
    node-tested, for driving the one-bit board from grayscale.
  - **`createMechSound`** — a mechanical-tick synth over ONE shared, refcounted
    AudioContext (a page of boards costs one context, not one each). The solenoid
    click is tuned against a recording of a real board (narrow 6.5–10.5 kHz ring,
    2–4 ms strike, wide level spread); a click budget keeps continuous shows a
    rattle, not a buzz; suspended/interrupted contexts self-resume on tab return;
    and the context is not even created until the page has seen a user gesture
    (`navigator.userActivation`) — zero audio footprint on a host page running
    its own audio (found in the `1.5.0-rc.1` shakedown against a real app).
    Exported as split-flap groundwork — a flap slap is just another recipe.
  - Perf: baked face sprites, a pre-squashed atlas on dense boards, `fillRect`
    board in flat mode — the demo board's worst case runs ~134 fps at dpr 2 on an
    Apple M1 (**`scripts/bench-flip-dot.mjs`**); idle costs zero by construction.
- **`<FlipDots>` in all three wrappers** (`@glowbox/svelte` / `react` / `vue`):
  frame + option props over the core, imperative board handle via
  `oncreate` / ref / `expose`.
- **Demo gallery `/flipdot`**: clock with a seconds sweep, the loop.gif dithered to
  one bit (turn the sound on), plasma, a live-editable text marquee, and a
  click-to-count tally counter — plus sound, CRT, shape/axis/stagger/dither knobs.
- **Gallery UI unified across all four cores**: the primary selectors (example/show
  plus style) live in the header only — no duplicated controls in the drawer;
  headers wrap on mobile instead of hiding things.

## [1.4.1] — 2026-07-26

### Fixed

- **`@glowbox/led-grid`: the display canvas can now be sampled reliably from outside
  its own render tick** — the WebGL context is created with
  `preserveDrawingBuffer: true`. Without it, Safari may clear the buffer after
  compositing, so an effects layer (`@glowbox/crt`) or any `drawImage`/`toDataURL`
  reading the canvas from its own rAF could see black. The cost is one buffer copy per
  composite — noise next to the bloom passes. Nixie and seven-segment need no change:
  2D contexts always preserve their buffer.

## [1.4.0] — 2026-07-26

The family's first **effects layer**: where the display cores render physically honest
objects, `@glowbox/crt` renders _watching one through a curved phosphor screen_ — and
it composes over **any** canvas, glowbox or not. Now **eight** packages in lockstep.

### Added

- **`@glowbox/crt`** — `createCrtScreen(source, opts)`, a per-frame WebGL pass with
  barrel curvature (real resampling), scanlines, an RGB phosphor mask, **phosphor
  persistence from real frame history** (moving content ghosts), convergence error
  that worsens toward the edges, vignette, mains flicker, a rolling refresh band, and
  static — all 0..1 knobs, live-updatable; `prefers-reduced-motion` freezes the
  temporal ones. Zero deps, SSR-import-safe.
  - **Element mode** — slap it over a whole element: `createCrtScreen(clockDiv)`
    mounts itself, composites every descendant canvas at its layout position (slots
    added/removed later are picked up), hides the originals (still laid out — their
    observers keep working), and **forwards pointer/wheel to the child canvas under
    the cursor**, so drag-orbit/zoom work straight through the tube. `dispose()`
    restores everything.
  - Canvas mode stays as the low-level API (you place the output canvas).
  - Perf: ~1 ms/frame at 1080p on an Apple M1; measured by the new
    **`scripts/bench-crt.mjs`**. Uniform locations cached, no CPU-side upload flip
    (shader-side V-flip), `texSubImage2D` streaming, and a single-fullsize-canvas
    fast path in element mode.
- **Demo gallery**: a **CRT** toggle on the LED gallery (with a nine-knob "crt" panel
  section) and on the `/seven` clock — the whole eight-canvas row on one tube.
- No framework wrappers, deliberately: element mode is one call from any framework.
- **Testing** (the layers the package suite can't reach): a SwiftShader-pinned
  **golden** of the tube look over a colour-bar test card; **webkit** joins the crt
  browser suite; a gallery e2e drives **real (trusted) mouse drag + wheel** through
  the overlay and verifies forwarding to the hidden source.

### Fixed (hardened through `1.4.0-rc.1…3` against a real app)

- **Creation-order races self-heal**: a screen created before its container lays out
  (or inside a closed panel) resolves once layout arrives — `frame()` checks the
  backing store against the live CSS box, beyond ResizeObserver; three orderings
  regression-tested.
- **The wrapped element keeps its CSS**: outside the curved face the output is
  transparent (backgrounds/borders/radius show around the tube), and the element-mode
  face floor defaults to the container's computed background colour (`background`
  overrides). Non-canvas children remain the documented compositor limit.
- **WebGL context lifecycle** (found on Safari, whose per-page context budget is
  small): `dispose()` deletes the GL objects and **releases the context slot** via
  `WEBGL_lose_context` (the output canvas is package-owned — led-grid deliberately
  keeps its consumer-owned context, guarded by its StrictMode test); the screen
  **recovers from context loss** (rebuilds everything on restore instead of staying
  black); dispose no longer double-loses an already-evicted context. Real
  lose/restore round-trip tested on chromium + webkit.
- **Cleanup audit across the family**: all three canvas cores now remove their
  `role`/`aria-label`/`aria-hidden` from the consumer's canvas on dispose (the row,
  the CRT, the wrappers, and the demo's three.js scene already restored everything).
- **Docs for real apps**: wrapping your own WebGL (the `preserveDrawingBuffer`
  gotcha, Safari-strict) and the context-budget rules, in the crt README; the
  shared-context multi-view architecture recorded as a trigger on the roadmap's
  WebGL2 2.0 entry.

## [1.3.1] — 2026-07-26

### Fixed

- **`@glowbox/seven-segment` + `@glowbox/nixie` threw on tiny canvases**
  (`IndexSizeError: arcTo … radius is negative`): with the window/glass pads floored
  at 2px/4px, a canvas under ~5px (seven-segment) / ~9px (nixie) wide or tall drove
  the inset box negative and fed `arcTo` a negative corner radius — crashing at
  creation. The box now clamps to a ≥1px sliver (and `roundRect` clamps the radius
  defensively); regression tests mount both cores at 1px. Thanks for the isolated
  report.

## [1.3.0] — 2026-07-25

The **seven-segment display** joins the family — the third rendering core, and the
first of the display-core franchise. The bar it had to clear: genuinely better than
"just use a 7-seg font" — so everything a font structurally can't do.

### Added

- **`@glowbox/seven-segment`** — a zero-dep 2D-canvas seven-segment digit
  (`createSevenSegment(canvas, opts)`), sibling core to nixie:
  - **Per-segment dynamics**: value changes cross-fade each segment individually with
    a small stagger (real multiplexing smear); rAF only while moving; instant under
    `prefers-reduced-motion`.
  - **Ageing** (`age: 0..1`): a deterministic per-instance wear fingerprint dims
    segments unevenly; past ~0.7 the most-worn segment flickers (sparse timeout-driven
    dips — idle cost ≈ 0); from ~0.95 it is **permanently dead** while the runner-up
    takes over the flickering.
  - **Materials**: `'led'` (red-orange emitter, smoked window, unlit segment ghosts) and
    `'vfd'` (phosphor cyan, whiter hot core, wider halo, anode-grid mesh).
  - `0–9`, `-`, hex `A b C d E F` (case-tolerant), the decimal point (`dp`), and `':'`
    as a first-class two-dot clock separator (height-fitted for slim slots).
  - **3D parity**: `segmentGeometry()` / `SEGMENT_VIEWBOX` / `SEGMENT_SLANT` /
    `litSegments()` export the named segment polygons + font, nixieCathodes-style.
- **`<SevenSegment>` in all three wrappers** (svelte/react/vue) alongside `<LedGrid>` +
  `<NixieTube>`, with the same live-update prop contract.
- **Demo**: a `/seven` clock route (HH:MM:SS with real colon modules) — style toggle,
  glow, the **age slider**, ghost toggle, sizes; a third "7-seg" tab in the core nav.
- The publish smoke packs/imports/type-checks/mounts all **seven** packages.

### Added (from right after 1.2.0)

- **StackBlitz starters** (`examples/starters/{svelte,react,vue}`): minimal Vite apps
  on the published packages — a pulsing sphere + torus on `<LedGrid>` and a ticking
  `<NixieTube>` — booted by new **"Open in StackBlitz"** links in the wrapper READMEs
  and the root README. Verified against the live 1.2.0 npm packages.

## [1.2.0] — 2026-07-25

"Clocks & music" — the two use-cases the library exists for.

### Added

- **`@glowbox/nixie`: `createNixieRow(container, opts)`** — the framework-free
  multi-tube row/clock helper: one tube per character (`'12:34:56'`, `'3.14'`),
  narrow separator slots, container-fitted sizing (`gap` / `digitAspect` /
  `separatorScale`), one `img` to assistive tech, live `setValue`/`setOptions`,
  in-place relighting for ticking clocks.
- **`@glowbox/nixie`: a decimal-point glyph** — `'.'` joins `0–9`, `:`, `-` (a single
  low dot, authentic to real tubes), height-fitted like the colon.
- **`@glowbox/extras`: audio-reactive helpers** — `makeAudioBands(analyser, opts)`
  distils any `AnalyserNode` into log-spaced, punchy-attack/gliding-release 0..1 bands
  plus `level`/`peak`; `makeBarsVisualizer` and `makeRadialVisualizer` draw them on any
  grid plane. Zero deps; node-testable.
- **`@glowbox/extras`: player transport controls** — the GIF/image players' draw fn
  now carries `pause()` / `play()` / `seek(s)` / `rate` (negative plays backwards) /
  `paused` / `ready` (non-breaking); plus **`makeFramePlayer(frames, opts)`** to play
  any procedural `{ src, delay }` sequence with the same controls.
- **`@glowbox/led-grid`: `quality.alpha`** — transparent-canvas mode (premultiplied
  compositing): the glow floats over whatever the page puts behind the canvas
  (parity with nixie's `bare`); `color.background` is ignored. Fixed at creation.
- **`@glowbox/extras`: the bitmap font learns `·`** (U+00B7) — the natural LED-ticker
  separator no longer renders as the missing-glyph box.
- **Demo gallery**: a **Music viz** example (simulated groove by default; a tiny
  generative WebAudio synth — kick/hats/bassline, zero assets — through the real
  analyser pipeline on the sound toggle); a **Sphere** example — an LED ball playing
  shows (a cursor-tracking blinking eye, plasma, the yellow-dude smiley, a glossy
  8-ball, a turning globe) with a show dropdown (default: auto-rotate); a
  **transparent** toggle behind the grid; **Rain v2** (floor splashes, wind gusts,
  leaning trails, heavy drops); and per-example **view-source links** in the panel.

### Changed

- The demo's `/nixie` 2D clock now runs on `createNixieRow` — one call replaces the
  hand-built row (slot sizing, separator widths, fit-scaling all moved into the
  library).

## [1.1.1] — 2026-07-25

### Changed

- **`@glowbox/nixie`: redrawn digit filaments** for `0`, `2`, `4`, `5`, `6`, `7`, `8`
  and `9` — rebalanced proportions on the shared centrelines: rounder bowls, a smoother
  `2` shoulder-to-diagonal transition, a wider `4` apex, and deliberately varied digit
  extents (a taller `0` and `8`, deeper `6`/`9` bowls) for the bent-wire-in-a-tube
  character of real nixie filaments. All tube styles pick the new shapes up
  automatically.

### Fixed

- **`@glowbox/led-grid` no longer throws where `ResizeObserver` is missing** (jsdom,
  older engines): the observer is optional now, matching nixie — auto-resize simply
  disables; `resize()` still works.
- **`@glowbox/extras`: `text(g, s, { font: 'system' })` under node/SSR** now throws the
  library's own clear error (`glowbox: 2D canvas unavailable`) instead of a raw
  `ReferenceError: document is not defined`.
- **`@glowbox/nixie` warns (once) when a multi-char `value` is truncated** to its first
  symbol, instead of silently dropping the rest.
- **npm listings**: cross-package README links now point at npmjs.com (relative links
  404 there); all six packages carry the `glowbox` keyword; extras' description +
  keywords now mention the 1.1.0 bitmap font and scroller.
- **Docs**: the wrapper READMEs now list `outlineColor`/`offSize`, note the
  `prefers-reduced-motion` `autoOrbit` default and `onFrame` stacking, and state that
  `bare` is core-only; the root README describes both cores (and the real publish
  order); led-grid's voxel-API intro includes `torus`/`cylinder`; nixie documents the
  single-symbol truncation.
- **Repo/CI** (nothing shipped): svelte typechecks against nixie source (no prior build
  needed); the publish smoke also exercises react/vue `NixieTube` types and fails
  clearly if the vendored yarn is missing; workflow SHA-pin comments corrected to their
  real versions, jobs gain timeouts + least-privilege `permissions`; dependabot's react
  group no longer swallows `vitest-browser-react` from the test group; the size-limit
  toolchain moves to v13 in lockstep and gets its own dependabot group (a solo major
  bump had split it across majors with an unmet peer); a lockstep
  `scripts/bump-version.mjs` (the roadmap already claimed it existed).

## [1.1.0] — 2026-07-13

"Text & confidence": the library gets its own typography, and the safety net any
future renderer work needs.

### Added

- **`@glowbox/extras`: a bundled 5×7 bitmap LED font** — hand-authored dot-matrix
  glyphs for printable ASCII (unknown chars render a hollow box). `text()` now defaults
  to it: deterministic on every OS, DOM-free (runs headlessly in node), **multi-line**
  via `\n`, integer `scale`. The system-font path remains as `font: 'system'`.
  `measureText(str, scale?)` returns the ink box; `FONT_5X7` / `glyph5x7(ch)` expose
  the raw font.
- **`@glowbox/extras`: `makeTextScroller(text, opts)`** — a seamless marquee draw
  callback (bitmap or system font; string or live getter; per-column colour function
  for gradients). The gallery's scroller now runs on it — with the bitmap font as its
  default look.
- **`@glowbox/led-grid`: `torus` + `cylinder`** voxel primitives (filled or ~1-voxel
  shell, orientable via an `axis` parameter), matching `sphere`/`box` conventions.
- **`onFrame` stacks subscribers**: each call adds a callback (run in subscription
  order); the returned `stop()` removes only its own. Previously a second subscription
  silently replaced the first.
- **Testing**: the core's browser suite now also runs on **WebKit** (the risk browser
  for the WebGL1 half-float HDR extensions); **golden screenshot tests** (hologram /
  comic / rgb / lattice) pinned to SwiftShader so one committed baseline serves every
  platform; pointer-interaction tests (drag / wheel / pinch / clamps); a React
  **StrictMode double-mount** test; `/nixie` route e2e covering the 2D clock **and**
  the three.js 3D scene.
- **`scripts/bench-led-grid.mjs`** — a manual benchmark against the built package;
  measured numbers (Apple M1: 60 fps through 64³ dense) now back the README's
  perf guidance.

### Changed

- **`autoOrbit` honours `prefers-reduced-motion`**: the default flips to off when the
  user asks for reduced motion; an explicit `autoOrbit` (either way) still wins.
- **`text()` renders the bitmap font by default** (was: system bold sans-serif — pass
  `font: 'system'` for the old look).
- led-grid's pointer capture no longer throws on synthetic/inactive pointer ids.

## [1.0.1] — 2026-07-13

### Fixed

- **`@glowbox/nixie` crashed Node/SSR at import** (`ReferenceError: Path2D is not
defined`): the colon glyph built its `Path2D` at module scope. Any SSR framework
  importing a wrapper (SvelteKit with SSR on, Next.js, Nuxt) crashed at import time even
  if the component never rendered. Glyph paths are now built lazily on first draw.
- **`@glowbox/nixie` is now genuinely zero-dep** — the colour parser is vendored (same
  `Color` contract), dropping the `@glowbox/led-grid` runtime dependency that made every
  nixie install pull the whole WebGL package.
- **led-grid**: the canvas gets `touch-action: none` while `drag`/`zoom` are enabled, so
  touch-orbit no longer fights page scroll on mobile; the per-frame orbit matrix rebuild
  no longer allocates.
- **extras**: `makeImagePlayer` no longer re-samples a static image every frame (the
  sample is cached per source until the target dims/fit change; repeated GIF frames
  benefit too).
- **demo**: hard refresh / deep links on `/nixie` no longer 404 on GitHub Pages (routes
  prerender as shell pages; the SPA fallback is `404.html`); the page ships a real
  `<title>` + description + social cards; the nixie 3D mode's inert width/height
  sliders are disabled with a hint.

### Added

- **`label`** option/prop across the family: `createLedDisplay` sets `role="img"` +
  `aria-label` on its canvas (default `'LED grid'`); `createNixieTube` names the canvas
  after the lit symbol (a blank, unlabelled tube is `aria-hidden`). All six wrapper
  components take a live-updatable `label` prop.
- **React**: the dist carries `'use client'`, so the components import cleanly under
  Next.js App Router / React Server Components.
- **CI/release**: a publish-integrity smoke test (`scripts/publish-smoke.mjs` — pack all
  six → npm-install the tarballs → bare-node import + `tsc` against shipped types +
  browser mount from dist) runs in CI and gates every release; the release workflow
  verifies the tag against **all six** package versions (previously only led-grid);
  `@glowbox/svelte` gains its missing size-limit budget.

## [1.0.0] — 2026-07-13

First stable release of the glowbox family — two glowing display rendering cores, thin
framework wrappers, and a content-helpers package. The feature-complete surface of the
`1.0.0-rc.*` series:

- **`@glowbox/led-grid`** — framework-agnostic 3D WebGL LED-grid voxel display (zero deps).
- **`@glowbox/nixie`** — 2D-canvas nixie-tube core, plus a 3D compositing API
  (`nixieCathodes` / `nixieStyle` / `nixieMesh` / `glyphPath` / `bare`) to build real 3D
  tubes without a 3D-engine dependency.
- **`@glowbox/svelte` / `@glowbox/react` / `@glowbox/vue`** — thin wrappers, each shipping
  `<LedGrid>` + `<NixieTube>`.
- **`@glowbox/extras`** — GIF / image / text content helpers over the draw API.

## [1.0.0-rc.3] — 2026-07-13

### Added

- **`@glowbox/nixie`** 3D / compositing API — the whole tube can be built in a 3D engine
  while nixie stays 2D (no 3D-engine dependency): `nixieCathodes()` (the full front→back
  digit stack — paths + depths — so every numeral is present and one is lit),
  `nixieStyle(style)` (squash + wire stroke width), `nixieMesh(w, h)` (honeycomb anode
  grille), `glyphPath(symbol)` / `GLYPH_VIEWBOX` (raw centreline + coordinate space), and
  `NIXIE_WIRE_COLOR`. Plus `{ bare: true }` — a tube's glowing contents on a transparent
  canvas (no 2D glass module; straight, un-premultiplied alpha) for texturing;
  `mesh` / `ghost` stay independent of `bare`.
- **`examples/svelte-gallery`** `/nixie` gains a **2D/3D toggle**: the 3D view builds real
  bent-wire cathodes (three.js `TubeGeometry` from `nixieCathodes`) glowing inside
  refractive glass tubes on a stand — the scene owns only the glass + bloom.

## 1.0.0-rc.2 — 2026-07-13

First public release candidate — a framework-agnostic 3D LED-grid display with
wrappers for the three major frameworks and a content-helpers package. (The LED-grid
core ships as **`@glowbox/led-grid`**, a peer of the `@glowbox/nixie` core — not a
generic `@glowbox/core`.)

### Added

- **`@glowbox/led-grid`** — plain-TS WebGL LED-grid display (zero deps): an nx×ny×nz
  lattice you draw voxels onto, orbitable (auto-spin + drag + zoom).
  - Two render styles: **`hologram`** (HDR bloom emitters, tone-mapped, reads on any
    background) and **`comic`** (flat cel-shaded discs/squares with an ink outline).
  - Grouped, live-updatable options: `led` / `color` / `camera` / `interaction` /
    `quality`; colours accept `[r,g,b]` (0..1, `>1` blooms) or any CSS string.
  - **`led.stagger`** — brick lattice (every other row offset half a cell), which also
    reduces view-dependent moiré.
  - **`resize(size?)`** — recompute the drawing buffer, or change the grid dimensions
    in place on the same canvas (no context loss), preserving camera + options.
  - **WebGL context-loss recovery** — the display rebuilds its renderer on restore and
    repaints existing content.
  - **`quality.fps`** — optional frame-rate cap for the render loop (power/cadence knob:
    ambient displays, or matching a hardware LED-cube's refresh rate).
  - Culling: only lit voxels are packed/drawn each frame, so cost scales with LEDs
    that are _on_, not grid volume; live `display.stats` (fps / frame / draw / render).
  - Voxel API: `plot` `add` `get` `clear` `fill` `line` `box` `sphere`, usable
    headlessly via `createVoxelGrid`.
- **`@glowbox/svelte`**, **`@glowbox/react`**, **`@glowbox/vue`** — glowbox components
  for each framework: **`<LedGrid>`** (identical prop contract — `size`, `draw`, the
  grouped option props — with an imperative display handle; size changes resize in place)
  and **`<NixieTube>`** (a single tube: `value` + appearance props over `@glowbox/nixie`,
  updating live via `setValue`/`setOptions`).
- **`@glowbox/extras`** — content helpers on the core's draw API: a **GIF/image
  animation player** (`makeGifPlayer` / `makeImagePlayer`, plane/depth/fit options,
  GIF decode + disposal compositing via `gifuct-js`) and a **`text`** helper. Building
  blocks `sampleImageToGrid`, `framesFromBuffer`, `paintImage` are exported too.
- **`@glowbox/nixie`** — a _sibling rendering core_: a single glowing nixie-tube
  numeral on a 2D canvas. Each digit is a thin geometric **filament** (a single-stroke
  wire) that glows warm-orange with a hot core, over the full stack of unlit dull-metal
  cathode wires nested behind the glass — with a honeycomb anode mesh and glass vignette.
  `createNixieTube(canvas, { value, style, color, glow, … })` with
  `setValue` / `setOptions` / `resize` / `snapshot`; three tube styles
  (`classic` / `slim` / `tall`). Renders **size-adaptively** — the full filament + mesh +
  cathode stack when large, degrading to a bold legible glyph at small sizes — and on any
  page/glass colour (`color` + `background` retint glow and glass together). Compose a
  row of tubes into a clock or counter.

[1.4.0]: https://github.com/eetu/glowbox/releases/tag/v1.4.0
[1.3.1]: https://github.com/eetu/glowbox/releases/tag/v1.3.1
[1.3.0]: https://github.com/eetu/glowbox/releases/tag/v1.3.0
[1.2.0]: https://github.com/eetu/glowbox/releases/tag/v1.2.0
[1.1.1]: https://github.com/eetu/glowbox/releases/tag/v1.1.1
[1.1.0]: https://github.com/eetu/glowbox/releases/tag/v1.1.0
[1.0.1]: https://github.com/eetu/glowbox/releases/tag/v1.0.1
[1.0.0]: https://github.com/eetu/glowbox/releases/tag/v1.0.0
[1.0.0-rc.3]: https://github.com/eetu/glowbox/releases/tag/v1.0.0-rc.3
