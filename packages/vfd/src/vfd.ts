// @glowbox/vfd — a vacuum-fluorescent display *panel* component, sibling to the nixie
// tube and the rest of the family. The other cores are homogeneous: an array of
// identical modules, or a block of text. A stereo faceplate is the opposite — a zoo of
// unlike parts (a starburst character field, screen-printed word legends, a spectrum
// grid, transport icons, a tuning dial, a silkscreen layer) — and the bar for existing
// at all is NOT that it can lay them out. A div grid lays them out. The bar is the
// ENVELOPE they all share:
//   • PERSISTENCE. Phosphor keeps glowing after the drive stops, so a spectrum bar
//     falling away leaves a tail and a scrolling field smears. One brightness
//     integrator per anode, fast attack and slow release — the thing no font, filter or
//     CSS animation can fake, and the first detail anyone recognises.
//   • ONE MULTIPLEX. The filament wires cross the glass over EVERYTHING, the control
//     grid mesh is continuous across the whole panel rather than per digit, and the
//     DIMMER (that 2- or 3-position button every receiver had) pulls the entire face
//     down together, non-linearly.
//   • THE SELF-TEST. Power on and every anode lights for about a second before
//     settling to what's actually playing. It only exists because the panel knows its
//     own complete anode inventory.
//   • FAILURE, two ways. The franchise wear arc at anode granularity (dim → sparse
//     flicker → dead), plus the one that belongs to vacuum fluorescence alone: a grid
//     goes weak and a VERTICAL BAND of the panel reads dimmer than the rest, cutting
//     across whichever elements happen to sit in it.
//   • THE FILTER. The tinted window in front of the tube, which pushes the light to its
//     own hue and — the reason it was fitted — crushes the undriven phosphor ghosts so
//     the dark parts read black instead of grey.
// This core has no sound: a VFD has no voice. The muting relay's clunk belongs to the
// receiver, not to the display, and the family's line is that a display core ships what
// the display does.
// Give it a canvas, a frame and a layout; drive it with set/light/bars. Import-safe
// under node/SSR (no browser globals at module scope; Path2D built lazily).
import { type Color, parseColor, type RGB } from './color';
import {
	compilePanel,
	driveElement,
	type ElementState,
	fallPeaks,
	GRID_COLS,
	type VfdBars,
	type VfdElement,
	type VfdPanelLayout
} from './panel';
import { type FilterName, FILTERS, type PhosphorName, PHOSPHORS } from './phosphor';

export interface VfdPanelOptions {
	/** The panel design frame, `[width, height]` — the units every element's box is in
	 *  (default `[320, 64]`, roughly a real faceplate's proportions). The frame is
	 *  fitted into the canvas preserving its aspect, so the layout never distorts. */
	frame?: [number, number];
	/** The elements printed on the plate. Fixed hardware: changing it re-compiles the
	 *  envelope (and re-runs the self-test), so declare the panel once and drive it. */
	layout?: VfdElement[];
	/** Anode phosphor (default 'zn-o' — the cyan-green stereo classic). */
	phosphor?: PhosphorName;
	/** The tinted window in front of the whole envelope (default 'green'). */
	filter?: FilterName | Color;
	/** Extra windows over REGIONS of the glass — the amber band across a level meter on an
	 *  otherwise green panel, or the red rectangle behind a RECORD indicator (green plastic
	 *  physically cannot pass red, so a red anode needs its own window to be seen at all).
	 *
	 *  A zone belongs to the PANEL, not to an element, because that is what it is: a piece
	 *  of plastic laid over a rectangle of glass, tinting every anode whose centre falls
	 *  inside it and crushing their undriven ghosts to its own density. It therefore tints
	 *  anything drawn behind it too, which is the real behaviour and the reason this is not
	 *  an element property. Later zones win where they overlap. */
	zones?: { x: number; y: number; w: number; h: number; filter: FilterName | Color }[];
	/** THE DIMMER, 0..1 (default 1). Applied non-linearly to the whole panel at once,
	 *  the way the duty-cycle button did it: 1 / 0.55 / 0.25 are the three positions
	 *  those buttons actually had, and 0 is DISPLAY OFF — which is not blank, because
	 *  the undriven anodes and the silkscreen are still sitting there behind the glass. */
	brightness?: number;
	/** Phosphor persistence 0..1 (default 0.05) — how long an anode keeps glowing after its
	 *  drive stops, as a time constant of 20 ms + `persistence` × 340 ms (scaled by the
	 *  phosphor's own lag).
	 *
	 *  It is a STYLIZED control, and the default is LOW on purpose: real ZnO:Zn decays in
	 *  microseconds, so nothing on a receiver smeared the way a high setting does. What you
	 *  remember came from the multiplex refresh and from your own eye — a few tens of
	 *  milliseconds, which is what 0.05 (37 ms, two frames) reads as. Turn it up to see the
	 *  effect the core exists to be able to do at all; past ~0.45 a character field ghosts
	 *  into its previous value and a scrolling message gets hard to read. */
	persistence?: number;
	/** The filament wires across the glass (default true). Fine horizontal lines over
	 *  everything, lit anodes included — the give-away that this is a vacuum tube. */
	filament?: boolean;
	/** The control-grid mesh (default true) — continuous across the panel, not per
	 *  digit, because there is one envelope. */
	grid?: boolean;
	/** Wear 0..1 (default 0): deterministic per-anode dimming; past ~0.6 a multiplex
	 *  grid weakens and its whole column dims; past ~0.7 the most-worn anode flickers;
	 *  from ~0.95 it is dead for good. */
	age?: number;
	/** Glow strength 0..1 (default 0.7). */
	glow?: number;
	/** The faceplate around the glass (default a dark grey). `null` leaves the canvas
	 *  transparent outside the glass, to compose the panel over your own hardware. A
	 *  VFD is a physical object with a bezel, which is why this core needs no invented
	 *  light-theme element: a dark panel on a pale page is a dark panel, correctly. */
	bezel?: Color | null;
	/** The unlit glass itself (default from the filter — near-black under a tint). */
	glass?: Color;
	/** Power (default true). Off is not blank: the undriven anodes and the silkscreen
	 *  stay visible behind the glass, exactly as they do on a switched-off stereo. */
	on?: boolean;
	/** Light every anode for ~1 s on power-on before settling (default true). */
	selfTest?: boolean;
	/** Cap on devicePixelRatio (default 2). */
	pixelRatio?: number;
	/** Accessible name (default 'display panel'; '' hides it from the a11y tree). The
	 *  character fields' contents are appended, so the panel reads as what it shows. */
	label?: string;
}

export interface VfdPanel {
	/** Drive a character field with a value, or a `scale` element with a 0..1 cursor
	 *  position (snapped to the nearest of its discrete blocks — nothing in a vacuum
	 *  envelope slides). Unknown names warn once. */
	set(name: string, value: string | number): void;
	/** Switch a `legend` or `icon` anode. */
	light(name: string, on: boolean): void;
	/** Feed a `bars` element one 0..1 level per band. Peak caps, if the element holds
	 *  them, are the panel's job from here — they fall on their own. The values are COPIED,
	 *  so reusing or mutating your array afterwards cannot change what the panel shows. */
	bars(name: string, levels: ArrayLike<number>): void;
	/** Feed a `dots` element a bitmap: 0..1 per dot, row-major from the top-left, or a
	 *  function of (x, y). This is the graphic path — an animation frame, a histogram, or
	 *  text scrolled smoothly by dot column. Fractional values are fine: a multiplexed
	 *  anode dims by duty cycle, so greyscale needs no dithering. */
	dots(name: string, bitmap: ArrayLike<number> | ((x: number, y: number) => number)): void;
	/** Stop driving an element: its anodes go dark and it forgets what it was showing. Not the
	 *  same as writing zeros — a `bars` element with `peakHold` remembers its caps, and a cap
	 *  resting on the floor row it never falls below is a lit line across the element for good.
	 *  This is what a panel needs when one window has more than one job (an analyser field that
	 *  becomes a graphic display on the DISPLAY button): the driver you switched away from
	 *  stops, memory and all. The anodes keep their phosphor tails on the way down. */
	blank(name: string): void;
	/** Re-declare the hardware. Separate from `setOptions` because it is the one expensive
	 *  call on this handle: it re-compiles the whole anode inventory, so a layout built inline
	 *  in a render function would pay for several thousand anodes per render. Drive state
	 *  survives by element NAME, so a panel mid-programme keeps showing what it was showing. */
	setLayout(layout: VfdElement[], frame?: [number, number]): void;
	/** Light every anode, then settle back to what's actually being shown. What a
	 *  receiver does when you switch it on. Instant under reduced motion. */
	selfTest(): void;
	/** The power switch. Off leaves the glass and its ghosts visible; on re-runs the
	 *  self-test if the panel was built with one. */
	power(on: boolean): void;
	/** Which element sits under a viewport point — pass `e.clientX`/`e.clientY` straight
	 *  from a pointer event; null if the point missed, or hit only silkscreen. The core
	 *  answers geometry and attaches no listeners: consumers own the events. */
	elementAt(clientX: number, clientY: number): string | null;
	/** An element's box in CSS pixels relative to the canvas — for parking a tooltip or
	 *  an overlay control on top of a zone. */
	elementRect(name: string): { x: number; y: number; width: number; height: number } | null;
	/** Patch the envelope: phosphor, windows, dimmer, persistence, wear, power and the rest.
	 *  Cheap — call it as often as you like. The hardware (`frame`/`layout`) is not here on
	 *  purpose; see `setLayout`. */
	setOptions(patch: Partial<Omit<VfdPanelOptions, 'frame' | 'layout'>>): void;
	resize(): void;
	snapshot(): string;
	dispose(): void;
}

const c255 = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
const rgba = (c: RGB, a: number) =>
	`rgba(${c255(c[0])},${c255(c[1])},${c255(c[2])},${Math.max(0, Math.min(1, a))})`;
const mix = (a: RGB, b: RGB, t: number): RGB => [
	a[0] + (b[0] - a[0]) * t,
	a[1] + (b[1] - a[1]) * t,
	a[2] + (b[2] - a[2]) * t
];
const clamp01 = (v: number) => (v > 1 ? 1 : v < 0 ? 0 : v);
const WHITE: RGB = [1, 1, 1];

// The wear arc thresholds — the franchise's, at anode granularity.
const GRID_FAIL_AT = 0.6;
const FLICKER_AT = 0.7;
const DIE_AT = 0.95;
// Persistence, as time constants in seconds. Attack is about one frame — phosphor lights
// fast; the whole character of the thing is in the asymmetry with the release.
const ATTACK_TAU = 0.012;
const DECAY_MIN = 0.02;
const DECAY_SPAN = 0.34;
const SELF_TEST_MS = 1000;
// The bloom is rendered at 1/Nth of the glass and composited back upscaled — the upscale
// is the blur. 3 is the sweet spot: soft enough to read as phosphor halation, sharp enough
// that a lit segment still looks like a segment.
const BLOOM_DIV = 3;
// Below this on-screen size (CSS px) an anode has no middle worth brightening.
const CORE_MIN_PX = 6;

let warnedName = false;

/** Create a VFD panel on a 2D canvas. Returns null if 2D is unavailable. */
export function createVfdPanel(
	canvas: HTMLCanvasElement,
	opts: VfdPanelOptions = {}
): VfdPanel | null {
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;

	let frame: [number, number] = opts.frame ?? [320, 64];
	let phosphor: PhosphorName = opts.phosphor ?? 'zn-o';
	let filterOpt: FilterName | Color = opts.filter ?? 'green';
	let zoneList = opts.zones ?? [];
	let brightness = clamp01(opts.brightness ?? 1);
	let persistence = clamp01(opts.persistence ?? 0.05);
	let filament = opts.filament ?? true;
	let gridMesh = opts.grid ?? true;
	let age = clamp01(opts.age ?? 0);
	let glow = clamp01(opts.glow ?? 0.7);
	let bezel = opts.bezel === null ? null : parseColor(opts.bezel ?? '#15171a');
	let glassOverride = opts.glass != null ? parseColor(opts.glass) : null;
	let on = opts.on ?? true;
	let selfTestOnPower = opts.selfTest ?? true;
	let pixelRatio = opts.pixelRatio ?? 2;
	let label = opts.label ?? 'display panel';

	let w = 0;
	let h = 0;
	let dpr = 1;
	// The frame→canvas transform, shared by the renderer and the hit test.
	let scale = 1;
	let offX = 0;
	let offY = 0;

	const reduced =
		typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	// --- the envelope ----------------------------------------------------------------
	let currentLayout: VfdElement[] = opts.layout ?? [];
	// Assigned by the `rebuild` below, before anything can read it.
	let panel!: VfdPanelLayout;
	let states: ElementState[] = [];
	let peaks: number[][] = [];
	let target = new Float32Array(0);
	let level = new Float32Array(0);
	let wear = new Float32Array(0);
	// What actually reaches the glass this frame, computed once per draw and read by both
	// the bloom and the body pass.
	let shown = new Float32Array(0);
	// The offscreen the bloom is accumulated into (browser-only, built on first draw).
	let bloom: HTMLCanvasElement | null = null;
	let bloomCtx: CanvasRenderingContext2D | null = null;
	// Which window each anode sits under: an index into `zones`, or -1 for the panel's own.
	// Per ANODE rather than per element on purpose — a piece of plastic covers a REGION, so
	// what matters is where the anode is, not which element it belongs to.
	let anodeZone: Int8Array = new Int8Array(0);
	// Buffers the driver OWNS, one per drivable element, so `bars`/`dots` can copy what they
	// are handed — the values are re-read every frame, so holding the caller's array would
	// let a later mutation change the display with no call.
	let levelBufs: (Float32Array | null)[] = [];
	let bitmapBufs: (Float32Array | null)[] = [];
	// Per-element lit colour and hot-core whiteness, resolved once rather than per anode per
	// frame (which allocates an object and re-parses a colour string ~1500 times a frame).
	// Rebuilt whenever the phosphor, a colour override or the layout changes.
	//
	// NB: every `let` that `rebuild()` assigns has to be declared ABOVE its first call
	// further down, or construction dies in the temporal dead zone.
	let litCache: RGB[] = [];
	let coreCache: number[] = [];
	let paths: Path2D[] | null = null;
	// Per-instance wear fingerprint: every real panel ages its own way. Deterministic
	// per instance (stable across redraws), different between instances.
	const seed = Math.random() * 1000;
	let dying = 0;
	let second = 0;
	let failCol = 0;
	let failCol2 = 0;
	let flickerDim = 1;
	let flickTarget = 0;
	let selfTestEnd = 0;
	let raf = 0;
	let lastT = 0;
	let flickerTimer: ReturnType<typeof setTimeout> | null = null;

	function rebuild(keepState: boolean) {
		const prev = keepState ? states : null;
		const prevNames = keepState ? panel.elements.map((e) => e.name) : [];
		panel = compilePanel(frame, currentLayout);
		const n = panel.anodes.length;
		target = new Float32Array(n);
		level = new Float32Array(n);
		wear = new Float32Array(n);
		shown = new Float32Array(n);
		for (let i = 0; i < n; i++) {
			// A cheap deterministic hash per anode — no PRNG state to thread around.
			wear[i] = 0.5 + 0.5 * Math.sin(seed + i * 12.9898);
		}
		// The two anodes on the wear arc, and the two grids that give out.
		let worst = -1;
		let runner = -1;
		for (let i = 0; i < n; i++) {
			if (panel.anodes[i].printed) continue;
			if (worst < 0 || wear[i] > wear[worst]) {
				runner = worst;
				worst = i;
			} else if (runner < 0 || wear[i] > wear[runner]) runner = i;
		}
		dying = worst < 0 ? 0 : worst;
		second = runner < 0 ? dying : runner;
		flickTarget = dying;
		failCol = Math.floor((0.5 + 0.5 * Math.sin(seed * 3.1)) * GRID_COLS) % GRID_COLS;
		failCol2 = (failCol + 5 + (Math.floor(seed) % 7)) % GRID_COLS;
		// Carry drive state across a re-compile by NAME, so swapping a layout doesn't
		// blank a panel that's mid-programme.
		states = panel.elements.map((el) => {
			const at = prevNames.indexOf(el.name);
			const carried = prev && at >= 0 ? prev[at] : undefined;
			const src = el.src;
			return (
				carried ?? {
					text: src.kind === 'digits' ? (src.value ?? '') : undefined,
					on: src.kind === 'legend' || src.kind === 'icon' ? (src.on ?? false) : undefined,
					levels: src.kind === 'bars' ? [] : undefined,
					peaks: src.kind === 'bars' ? [] : undefined,
					pos: src.kind === 'scale' ? (src.value ?? 0) : undefined
				}
			);
		});
		peaks = panel.elements.map((el) =>
			el.kind === 'bars' ? Array.from({ length: el.cells }, () => -1) : []
		);
		for (let e = 0; e < panel.elements.length; e++) states[e].peaks = peaks[e];
		paths = null;
		levelBufs = panel.elements.map((el) =>
			el.kind === 'bars' ? new Float32Array(el.cells) : null
		);
		bitmapBufs = panel.elements.map((el) =>
			el.kind === 'dots' ? new Float32Array(el.cells * el.stride) : null
		);
		cacheColors();
		mapZones();
		writeTargets();
		// First paint lands at the targets — no boot fade, unless a self-test is due.
		level.set(target);
	}

	rebuild(false);

	function writeTargets() {
		if (!on) {
			// Powered down drives nothing at all. Not the same as blank: the undriven
			// phosphor and the silkscreen are still there behind the glass.
			target.fill(0);
			return;
		}
		for (let e = 0; e < panel.elements.length; e++) {
			driveElement(panel.elements[e], states[e], target);
		}
		// The self-test overrides every drive: the whole inventory, all at once.
		if (selfTestEnd > 0) {
			for (let i = 0; i < panel.anodes.length; i++) if (!panel.anodes[i].printed) target[i] = 1;
		}
	}

	const anodePaths = (): Path2D[] => {
		if (paths) return paths;
		paths = panel.anodes.map((a) => {
			const p = new Path2D();
			for (const poly of a.polys) {
				p.moveTo(poly[0], poly[1]);
				for (let i = 2; i < poly.length; i += 2) p.lineTo(poly[i], poly[i + 1]);
				p.closePath();
			}
			return p;
		});
		return paths;
	};

	/** Resolve a filter option to a spec. A bare colour is read as a window of that hue at
	 *  the green preset's density — the useful reading of `filter: '#ffb347'`. */
	const specOf = (f: FilterName | Color) => {
		if (typeof f === 'string' && f in FILTERS) return FILTERS[f as FilterName];
		return { ...FILTERS.green, tint: parseColor(f as Color) };
	};
	const filterSpec = () => specOf(filterOpt);

	function mapZones() {
		anodeZone = new Int8Array(panel.anodes.length).fill(-1);
		if (!zoneList.length) return;
		for (let i = 0; i < panel.anodes.length; i++) {
			// Centroid, so an anode straddling an edge picks one side rather than flickering.
			const polys = panel.anodes[i].polys;
			let sx = 0;
			let sy = 0;
			let n = 0;
			for (const p of polys)
				for (let j = 0; j < p.length; j += 2) {
					sx += p[j];
					sy += p[j + 1];
					n++;
				}
			if (!n) continue;
			const cx = sx / n;
			const cy = sy / n;
			// Later zones win, matching the draw order.
			for (let z = zoneList.length - 1; z >= 0; z--) {
				const b = zoneList[z];
				if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) {
					anodeZone[i] = z;
					break;
				}
			}
		}
	}
	/** The window over one anode — its zone's, or the panel's. */
	const zoneSpecOf = (i: number) => {
		const z = anodeZone[i] ?? -1;
		return z < 0 ? filterSpec() : specOf(zoneList[z].filter);
	};

	function cacheColors() {
		litCache = panel.elements.map((e) => {
			const spec = PHOSPHORS[e.src.phosphor ?? phosphor] ?? PHOSPHORS['zn-o'];
			return e.src.color != null ? parseColor(e.src.color) : spec.color;
		});
		coreCache = panel.elements.map(
			(e) => (PHOSPHORS[e.src.phosphor ?? phosphor] ?? PHOSPHORS['zn-o']).core
		);
	}
	const litColorOf = (el: number): RGB => litCache[el] ?? PHOSPHORS['zn-o'].color;
	const coreOf = (el: number): number => coreCache[el] ?? PHOSPHORS['zn-o'].core;

	/** How much of an anode's stored glow actually reaches the glass: wear, the failing
	 *  grid column, the flicker dip, and the dimmer — all of it uniform over the one
	 *  array, which is the whole reason the inventory is flat. */
	function reaching(i: number): number {
		const a = panel.anodes[i];
		let v = level[i];
		if (v <= 0) return 0;
		if (age > 0) {
			if (i === dying && age >= DIE_AT) return 0;
			v *= 1 - wear[i] * age * 0.5;
			// A weak grid drags its whole column down, across every element in it.
			if (age >= GRID_FAIL_AT && a.col === failCol) v *= 0.42;
			if (age >= 0.85 && a.col === failCol2) v *= 0.6;
			if (i === flickTarget && age > FLICKER_AT) v *= flickerDim;
		}
		return v * dimmer();
	}

	// The dimmer button cut duty cycle, so the drop is steeper than the number suggests.
	const dimmer = () => Math.pow(brightness, 1.5);

	// --- render ----------------------------------------------------------------------
	function draw() {
		if (!w || !h) return;
		const g = ctx!;
		const flt = filterSpec();
		// The glass base is NEUTRAL dark; the filter pass at the end is what tints it.
		// Same rule as the anodes below — the window is one physical layer, applied once.
		const glass = glassOverride ?? ([flt.floor, flt.floor, flt.floor] as RGB);
		g.setTransform(1, 0, 0, 1, 0, 0);
		g.clearRect(0, 0, canvas.width, canvas.height);
		g.scale(dpr, dpr);

		// Fit the frame into the canvas, preserving aspect. The bezel is whatever's left.
		const pad = Math.max(2, Math.min(w, h) * 0.03);
		const availW = Math.max(1, w - pad * 2);
		const availH = Math.max(1, h - pad * 2);
		scale = Math.min(availW / frame[0], availH / frame[1]);
		const gw = frame[0] * scale;
		const gh = frame[1] * scale;
		offX = (w - gw) / 2;
		offY = (h - gh) / 2;
		// Below this the halo and mesh passes cost more than they show.
		const micro = Math.min(gw, gh) < 34;

		if (bezel) {
			g.fillStyle = rgba(bezel, 1);
			g.fillRect(0, 0, w, h);
		}

		g.save();
		g.beginPath();
		g.rect(offX, offY, gw, gh);
		g.clip();

		// The glass itself.
		g.fillStyle = rgba(glass, 1);
		g.fillRect(offX, offY, gw, gh);

		g.translate(offX, offY);
		g.scale(scale, scale);
		const ps = anodePaths();

		// 1. The undriven phosphor paint: faint shapes floating behind the glass. How much of
		//    it survives is the filter's job — bare glass shows every unlit anode in outline,
		//    which is precisely why the tinted window was fitted.
		//    These two passes are static — undriven paint is paint, ink is ink, neither dims —
		//    so caching them to an offscreen and blitting looks like an obvious win. It isn't:
		//    measured, it costs 4-7 fps MORE than just re-filling them. These fills are at
		//    alpha 0.014 and near no-ops for the rasterizer, while the blit is a million
		//    pixels of copy-and-blend every frame. Left inline deliberately.
		if (!micro) {
			for (let i = 0; i < panel.anodes.length; i++) {
				if (panel.anodes[i].printed) continue;
				const el = panel.anodes[i].el;
				const spec = PHOSPHORS[panel.elements[el].src.phosphor ?? phosphor] ?? PHOSPHORS['zn-o'];
				// Whatever window this anode sits under decides how much of its ghost survives.
				const a = zoneSpecOf(i).ghost * 0.4 * 0.16;
				if (a < 0.002) continue;
				g.fillStyle = rgba(spec.anode, a);
				g.fill(ps[i]);
			}
		}

		// 2. The silkscreen: printed ink on the glass, never driven, unaffected by the dimmer.
		for (let i = 0; i < panel.anodes.length; i++) {
			if (!panel.anodes[i].printed) continue;
			g.fillStyle = 'rgba(196,204,208,0.2)';
			g.fill(ps[i]);
		}

		// 3. The lit anodes, additively. Colours are left UNTINTED here: the filter is a
		//    single multiply pass at the end of the frame, and folding it in would square it.
		// Work out what reaches the glass, once, for every pass below to read.
		for (let i = 0; i < panel.anodes.length; i++) {
			const a = panel.anodes[i];
			shown[i] = a.printed ? 0 : reaching(i);
		}

		// 3a. THE BLOOM. Not `shadowBlur`: a canvas gaussian costs roughly area × radius, so
		//     per-anode shadows price a whole panel's worth of blur every frame and batching
		//     them only cuts the call count, not the area (measured: 21 fps with shadows, 90
		//     with glow off — the blur WAS the frame). Instead every lit anode is drawn flat
		//     into a small offscreen canvas at a fraction of the resolution, and that is
		//     composited back additively, upscaled — the upscale IS the blur, done once for
		//     the whole envelope by the sampler for nothing. Two taps give the falloff a
		//     tight core and a wide skirt, which is what phosphor bloom looks like anyway.
		if (glow > 0 && !micro) {
			const bw = Math.max(1, Math.round(gw / BLOOM_DIV));
			const bh = Math.max(1, Math.round(gh / BLOOM_DIV));
			if (!bloom) bloom = document.createElement('canvas');
			if (bloom.width !== bw || bloom.height !== bh) {
				bloom.width = bw;
				bloom.height = bh;
				bloomCtx = bloom.getContext('2d');
			}
			const bg = (bloomCtx ??= bloom.getContext('2d'));
			if (bg) {
				bg.setTransform(1, 0, 0, 1, 0, 0);
				bg.clearRect(0, 0, bw, bh);
				bg.globalCompositeOperation = 'lighter';
				// Frame units → the bloom canvas, which covers exactly the glass rect.
				const bs = scale / BLOOM_DIV;
				bg.setTransform(bs, 0, 0, bs, 0, 0);
				for (let i = 0; i < panel.anodes.length; i++) {
					const v = shown[i];
					if (v < 0.015) continue;
					bg.fillStyle = rgba(litColorOf(panel.anodes[i].el), v);
					bg.fill(ps[i]);
				}
				g.globalCompositeOperation = 'lighter';
				g.imageSmoothingEnabled = true;
				g.imageSmoothingQuality = 'low';
				// The destination is in FRAME units: this runs inside the glass transform, so
				// the bloom covers exactly (0,0)-(frame) — passing CSS pixels here would scale
				// and offset it a second time.
				const [fx, fy] = frame;
				// Tight tap, then a wider one for the skirt.
				g.globalAlpha = 0.85 * glow;
				g.drawImage(bloom, 0, 0, fx, fy);
				const spread = Math.min(fx, fy) * 0.04 * glow;
				g.globalAlpha = 0.45 * glow;
				g.drawImage(bloom, -spread, -spread, fx + spread * 2, fy + spread * 2);
				g.globalAlpha = 1;
			}
		}

		// 3b. Bodies and hot cores — crisp, per anode, no blur.
		g.globalCompositeOperation = 'lighter';
		for (let i = 0; i < panel.anodes.length; i++) {
			const a = panel.anodes[i];
			const v = shown[i];
			if (v < 0.015) continue;
			const color = litColorOf(a.el);
			g.fillStyle = rgba(color, v * 0.95);
			g.fill(ps[i]);
			// The hot core: phosphor reads whiter in the middle of a driven patch. Faked by
			// over-filling toward white rather than shrinking the shape — an anode is a flat
			// patch, and shrinking a 5-unit segment about its centre just thins it. Skipped on
			// anodes too small to have a middle.
			if (v > 0.35 && a.size * scale >= CORE_MIN_PX) {
				g.fillStyle = rgba(mix(color, WHITE, coreOf(a.el)), (v - 0.35) * 0.5);
				g.fill(ps[i]);
			}
		}
		g.globalCompositeOperation = 'source-over';

		g.setTransform(1, 0, 0, 1, 0, 0);
		g.scale(dpr, dpr);

		// 4. The control grid: one continuous mesh over the whole panel, not per digit.
		//    Dark on dark where nothing is lit, visible over the phosphor — which is
		//    exactly where you see it on the real thing.
		if (gridMesh && !micro) {
			g.strokeStyle = 'rgba(0,0,0,0.3)';
			g.lineWidth = Math.max(0.5, gh * 0.006);
			const step = Math.max(2.5, gh * 0.035);
			g.beginPath();
			for (let y = offY; y < offY + gh; y += step) {
				g.moveTo(offX, y);
				g.lineTo(offX + gw, y);
			}
			for (let x = offX; x < offX + gw; x += step * 1.5) {
				g.moveTo(x, offY);
				g.lineTo(x, offY + gh);
			}
			g.stroke();
		}

		// 5. The filament: fine hot wires stretched across the envelope, in FRONT of
		//    every anode. Barely there, and the detail that says vacuum tube.
		if (filament && !micro) {
			const wires = Math.max(2, Math.round(frame[1] / 22));
			g.lineWidth = Math.max(0.4, gh * 0.0035);
			for (let i = 0; i < wires; i++) {
				const y = offY + ((i + 0.5) / wires) * gh;
				// A wire sags a little between its supports, and glows dull where hot.
				const sag = gh * 0.006;
				g.strokeStyle = `rgba(255,236,205,${0.05 + 0.03 * dimmer()})`;
				g.beginPath();
				g.moveTo(offX, y);
				g.quadraticCurveTo(offX + gw / 2, y + sag, offX + gw, y);
				g.stroke();
			}
		}

		// 6. The filter glass, multiplied over the whole envelope — it sits in front of the
		//    anodes, the mesh and the filament alike, so it must not be folded into any of
		//    their fills. Each region is multiplied exactly ONCE: the panel tint covers
		//    everything except the zones carrying their own strip (punched out even-odd),
		//    then each strip lays down its own hue over its box.
		g.globalCompositeOperation = 'multiply';
		g.fillStyle = rgba(flt.tint, 1);
		if (!zoneList.length) {
			g.fillRect(offX, offY, gw, gh);
		} else {
			g.beginPath();
			g.rect(offX, offY, gw, gh);
			for (const z of zoneList)
				g.rect(offX + z.x * scale, offY + z.y * scale, z.w * scale, z.h * scale);
			g.fill('evenodd');
			for (const z of zoneList) {
				g.fillStyle = rgba(specOf(z.filter).tint, 1);
				g.fillRect(offX + z.x * scale, offY + z.y * scale, z.w * scale, z.h * scale);
			}
		}
		g.globalCompositeOperation = 'source-over';

		// 7. Glass vignette — the window is recessed behind a bezel.
		if (!micro) {
			const vign = g.createRadialGradient(
				offX + gw / 2,
				offY + gh / 2,
				0,
				offX + gw / 2,
				offY + gh / 2,
				Math.max(gw, gh) * 0.72
			);
			vign.addColorStop(0, 'rgba(0,0,0,0)');
			vign.addColorStop(1, 'rgba(0,0,0,0.4)');
			g.fillStyle = vign;
			g.fillRect(offX, offY, gw, gh);
		}
		g.restore();

		// 8. The bezel's inner edge, so the glass reads as set into hardware.
		if (!micro) {
			g.strokeStyle = 'rgba(0,0,0,0.55)';
			g.lineWidth = 1;
			g.strokeRect(offX - 0.5, offY - 0.5, gw + 1, gh + 1);
			g.strokeStyle = 'rgba(255,255,255,0.05)';
			g.strokeRect(offX - 1.5, offY - 1.5, gw + 3, gh + 3);
		}
	}

	// --- the physics loop -------------------------------------------------------------
	// One pass over one array: attack fast toward the drive, release slowly at the
	// phosphor's own rate. Runs only while something is actually moving.
	function step(now: number) {
		raf = 0;
		const dt = Math.min(0.1, (now - lastT) / 1000);
		lastT = now;

		let moving = false;

		// Peak caps sag on their own, so the drive targets change without any new input.
		for (let e = 0; e < panel.elements.length; e++) {
			const el = panel.elements[e];
			if (el.kind !== 'bars') continue;
			const src = el.src as VfdBars;
			if (!src.peakHold) continue;
			// A cap still above its band's live level is still on its way down.
			fallPeaks(peaks[e], states[e].levels ?? [], el.stride, src.peakFall ?? 4, dt);
			for (let b = 0; b < peaks[e].length; b++) {
				if (peaks[e][b] > clamp01(states[e].levels?.[b] ?? 0) * el.stride) {
					moving = true;
					break;
				}
			}
		}

		if (selfTestEnd > 0 && now >= selfTestEnd) selfTestEnd = 0;
		if (selfTestEnd > 0) moving = true;
		writeTargets();

		const lag = PHOSPHORS[phosphor]?.lag ?? 1;
		const decayTau = reduced ? 0 : DECAY_MIN + persistence * lag * DECAY_SPAN;
		const attack = reduced ? 1 : 1 - Math.exp(-dt / ATTACK_TAU);
		const decay = decayTau <= 0 ? 1 : 1 - Math.exp(-dt / decayTau);
		for (let i = 0; i < level.length; i++) {
			const t = target[i];
			if (level[i] === t) continue;
			const k = t > level[i] ? attack : decay;
			const next = level[i] + (t - level[i]) * k;
			// Snap when the remainder stops being visible, so the loop can actually stop.
			level[i] = Math.abs(t - next) < 0.002 ? t : next;
			if (level[i] !== t) moving = true;
		}

		if (flickerDim < 1) {
			flickerDim = Math.min(1, flickerDim + dt * 6);
			moving = true;
		}

		draw();
		if (moving) raf = requestAnimationFrame(step);
	}

	function animate() {
		if (raf) return;
		lastT = typeof performance !== 'undefined' ? performance.now() : 0;
		raf = requestAnimationFrame(step);
	}

	/** Settle instantly — reduced motion, and the paths that must read back at once. */
	function settle() {
		writeTargets();
		level.set(target);
		draw();
	}

	// Sparse flicker: a dip every 0.4–2.4 s once the panel is worn enough, scheduled on
	// timeouts rather than a render loop, so an idle panel costs nothing.
	function scheduleFlicker() {
		if (flickerTimer) return;
		const tick = () => {
			flickerTimer = null;
			if (age <= FLICKER_AT || reduced) return;
			flickTarget = age >= DIE_AT || (age >= 0.9 && Math.random() < 0.35) ? second : dying;
			if (level[flickTarget] > 0.5) {
				flickerDim = 0.05 + Math.random() * 0.3;
				animate();
			}
			flickerTimer = setTimeout(tick, 400 + Math.random() * 2000);
		};
		flickerTimer = setTimeout(tick, 400 + Math.random() * 2000);
	}
	function syncFlicker() {
		if (age > FLICKER_AT && !reduced) scheduleFlicker();
		else if (flickerTimer) {
			clearTimeout(flickerTimer);
			flickerTimer = null;
			flickerDim = 1;
		}
	}

	// --- plumbing ---------------------------------------------------------------------
	// Which drive call each kind answers to. Calling the wrong one is otherwise a silent
	// no-op: the value lands in a state field the element's driver never reads.
	const DRIVEN_BY: Record<string, string> = {
		digits: 'set',
		scale: 'set',
		legend: 'light',
		icon: 'light',
		bars: 'bars',
		dots: 'dots',
		rule: '(nothing — a rule is ink)'
	};
	const warnedKind = new Set<string>();
	function warnOnce(key: string, message: string): void {
		if (warnedKind.has(key)) return;
		warnedKind.add(key);
		console.warn(message);
	}
	/** True if `name` answers to `method`; warns once per pairing if it does not. */
	function expectKind(e: number, name: string, method: string): boolean {
		const kind = panel.elements[e].kind;
		if (DRIVEN_BY[kind] === method) return true;
		warnOnce(
			`${name}:${method}`,
			`glowbox: "${name}" is a ${kind} element, which is driven with ${DRIVEN_BY[kind]}(), not ${method}(). The call did nothing.`
		);
		return false;
	}

	function elementIndex(name: string): number | null {
		const i = panel.byName.get(name);
		if (i === undefined) {
			if (!warnedName) {
				warnedName = true;
				console.warn(
					`glowbox: no panel element named "${name}" — the names in \`layout\` are the wiring. Known: ${[...panel.byName.keys()].join(', ') || '(none)'}`
				);
			}
			return null;
		}
		return i;
	}

	function applyAria() {
		canvas.setAttribute('role', 'img');
		if (!label) {
			canvas.setAttribute('aria-hidden', 'true');
			canvas.removeAttribute('aria-label');
			return;
		}
		// Read out what the panel says: the character fields, plus the lit legends.
		const parts: string[] = [];
		for (let e = 0; e < panel.elements.length; e++) {
			const el = panel.elements[e];
			if (el.kind === 'digits' && states[e].text) parts.push(states[e].text!.trim());
			else if (el.kind === 'legend' && states[e].on && !(el.src as { printed?: boolean }).printed)
				parts.push((el.src as { text: string }).text);
		}
		const said = on ? parts.filter(Boolean).join(' ') : '';
		canvas.setAttribute('aria-label', said ? `${label}: ${said}` : label);
		canvas.removeAttribute('aria-hidden');
	}

	function resize() {
		const cap = pixelRatio > 0 ? pixelRatio : 1;
		dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, cap);
		const r = canvas.getBoundingClientRect();
		w = Math.max(1, r.width || canvas.clientWidth || 1);
		h = Math.max(1, r.height || canvas.clientHeight || 1);
		if (Math.abs(w - canvas.width) < 1 && Math.abs(h - canvas.height) < 1) {
			canvas.style.width = `${w}px`;
			canvas.style.height = `${h}px`;
		}
		canvas.width = Math.max(1, Math.round(w * dpr));
		canvas.height = Math.max(1, Math.round(h * dpr));
		draw();
	}

	function runSelfTest() {
		if (reduced || !panel.driven) {
			settle();
			return;
		}
		selfTestEnd = (typeof performance !== 'undefined' ? performance.now() : 0) + SELF_TEST_MS;
		writeTargets();
		animate();
	}

	applyAria();
	const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
	ro?.observe(canvas);
	resize();
	syncFlicker();
	if (on && selfTestOnPower) runSelfTest();

	return {
		set(name, value) {
			const e = elementIndex(name);
			if (e == null || !expectKind(e, name, 'set')) return;
			if (panel.elements[e].kind === 'scale') states[e].pos = clamp01(Number(value));
			else states[e].text = String(value);
			applyAria();
			if (reduced || persistence <= 0) settle();
			else animate();
		},
		light(name, lit) {
			const e = elementIndex(name);
			if (e == null || !expectKind(e, name, 'light')) return;
			states[e].on = lit;
			applyAria();
			if (reduced || persistence <= 0) settle();
			else animate();
		},
		bars(name, levels) {
			const e = elementIndex(name);
			if (e == null || !expectKind(e, name, 'bars')) return;
			const el = panel.elements[e];
			// Copy into the driver's own buffer: the values are read again every frame, so
			// holding the caller's array would let a later mutation change the display.
			const buf = levelBufs[e]!;
			for (let b = 0; b < buf.length; b++) buf[b] = clamp01(levels[b] ?? 0);
			states[e].levels = buf;
			// A band louder than its sagging cap lifts it at once — the cap only falls.
			if ((el.src as VfdBars).peakHold) {
				for (let b = 0; b < peaks[e].length; b++)
					peaks[e][b] = Math.max(peaks[e][b], buf[b] * el.stride);
			}
			if (reduced || persistence <= 0) settle();
			else animate();
		},
		dots(name, bitmap) {
			const e = elementIndex(name);
			if (e == null || !expectKind(e, name, 'dots')) return;
			if (typeof bitmap === 'function') {
				// A function is kept as-is and SAMPLED every frame — that is the point of it,
				// and there is nothing to copy.
				states[e].bitmap = bitmap;
			} else {
				const buf = bitmapBufs[e]!;
				for (let i = 0; i < buf.length; i++) buf[i] = clamp01(bitmap[i] ?? 0);
				states[e].bitmap = buf;
			}
			if (reduced || persistence <= 0) settle();
			else animate();
		},
		blank(name) {
			const e = elementIndex(name);
			if (e == null) return;
			const el = panel.elements[e];
			if (el.kind === 'rule') {
				warnOnce(`${name}:blank`, `glowbox: "${name}" is a rule — silkscreen is never driven.`);
				return;
			}
			const st = states[e];
			st.text = '';
			st.on = false;
			st.bitmap = undefined;
			// No cursor, rather than a cursor at zero.
			st.pos = undefined;
			if (el.kind === 'bars') {
				levelBufs[e]!.fill(0);
				st.levels = levelBufs[e]!;
				// A held cap is the DRIVER's memory of a loud band, so a stopped driver has none.
				// Sagging them to the floor would leave a lit row across the element for good.
				peaks[e].fill(-1);
			}
			applyAria();
			if (reduced || persistence <= 0) settle();
			else animate();
		},
		setLayout(next, nextFrame) {
			let changed = false;
			if (nextFrame && (nextFrame[0] !== frame[0] || nextFrame[1] !== frame[1])) {
				frame = nextFrame;
				changed = true;
			}
			if (next !== currentLayout) {
				currentLayout = next;
				changed = true;
			}
			if (!changed) return;
			rebuild(true);
			applyAria();
			if (reduced || persistence <= 0) settle();
			else animate();
		},
		selfTest: runSelfTest,
		power(next) {
			if (next === on) return;
			on = next;
			applyAria();
			if (on && selfTestOnPower) runSelfTest();
			else if (reduced || persistence <= 0) settle();
			else animate();
		},
		elementAt(clientX, clientY) {
			const r = canvas.getBoundingClientRect();
			if (!r.width || !r.height || !scale) return null;
			// Back through the same transform the renderer used, into frame units.
			const fx = ((clientX - r.left) * (w / r.width) - offX) / scale;
			const fy = ((clientY - r.top) * (h / r.height) - offY) / scale;
			// Topmost first, since later elements print over earlier ones. Anything with
			// no driven anodes is silkscreen furniture and gets skipped: a `rule` box
			// drawn around a zone must not swallow the taps meant for what's inside it.
			for (let e = panel.elements.length - 1; e >= 0; e--) {
				const el = panel.elements[e];
				if (!el.index.size) continue;
				// `bounds`, not `box`: an icon in a shared design frame has no box of its own.
				const b = el.bounds;
				if (fx >= b.x && fx <= b.x + b.w && fy >= b.y && fy <= b.y + b.h) return el.name;
			}
			return null;
		},
		elementRect(name) {
			const e = elementIndex(name);
			if (e == null) return null;
			const b = panel.elements[e].bounds;
			return {
				x: offX + b.x * scale,
				y: offY + b.y * scale,
				width: b.w * scale,
				height: b.h * scale
			};
		},
		setOptions(patch) {
			// Nothing here re-compiles — the hardware is `setLayout`'s job — so a wrapper can
			// re-send this whole bag on every slider tick (all three of ours do) for free.
			if (patch.zones != null) {
				zoneList = patch.zones;
				mapZones();
			}
			if (patch.phosphor != null) {
				phosphor = patch.phosphor;
				cacheColors();
			}
			if (patch.filter != null) filterOpt = patch.filter;
			if (patch.brightness != null) brightness = clamp01(patch.brightness);
			if (patch.persistence != null) persistence = clamp01(patch.persistence);
			if (patch.filament != null) filament = patch.filament;
			if (patch.grid != null) gridMesh = patch.grid;
			if (patch.age != null) age = clamp01(patch.age);
			if (patch.glow != null) glow = clamp01(patch.glow);
			if (patch.bezel !== undefined) bezel = patch.bezel === null ? null : parseColor(patch.bezel);
			if (patch.glass !== undefined)
				glassOverride = patch.glass != null ? parseColor(patch.glass) : null;
			if (patch.selfTest != null) selfTestOnPower = patch.selfTest;
			if (patch.label !== undefined) label = patch.label;
			if (patch.on != null && patch.on !== on) {
				on = patch.on;
				if (on && selfTestOnPower) runSelfTest();
			}
			applyAria();
			syncFlicker();
			if (patch.pixelRatio != null) {
				pixelRatio = patch.pixelRatio;
				resize();
			}
			if (reduced || persistence <= 0) settle();
			else animate();
		},
		resize,
		snapshot() {
			draw();
			return canvas.toDataURL('image/png');
		},
		dispose() {
			ro?.disconnect();
			if (raf) cancelAnimationFrame(raf);
			if (flickerTimer) clearTimeout(flickerTimer);
			// Hand the consumer's canvas back without our ARIA (it may be reused).
			canvas.removeAttribute('role');
			canvas.removeAttribute('aria-label');
			canvas.removeAttribute('aria-hidden');
		}
	};
}
