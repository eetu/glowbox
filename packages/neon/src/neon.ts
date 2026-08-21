// @glowbox/neon — a glass-tube neon sign *component*, a sibling rendering core to
// the nixie tube. The bar for existing at all (CSS text-shadow puts a glow on any
// font for free) is the glass: tubes that exist as objects — visible unlit, struck
// alive through arcing electrodes, ageing until a section dies — not a glow filter
// over a filled font:
//   • Letterforms are STROKED CENTRELINES — vendored Hershey single-stroke faces
//     (cursive 'script', block 'sans'), corner-rounded into bends — one constant-
//     width tube per section with an electrode stub at each free end, never a
//     filled glyph.
//   • The unlit tube is drawn, always: powered off or dead, the glass still hangs
//     on the wall (phosphor-coated gases show their paint; clear gases pale glass).
//   • `polarity: 'absorb'` is the one INVENTED part: an element whose discharge
//     runs dark, inking a pale wall instead of lighting a dark one — the same
//     ramp multiplied in rather than added, so neon can live in a light theme.
//   • A strike is a SEQUENCE, not a fade-in: the electrodes arc while the tube
//     stays dark, ignition takes with a few partial pops, overshoots white-hot and
//     settles. Turn-off is near-instant — the discharge just stops.
//   • `age` runs the franchise wear arc at tube granularity: deterministic
//     per-tube dimming, the most-worn section flickering past ~0.7 and dead glass
//     from ~0.95 — the MOT L sign.
//   • Programs are the FLASHER CAM, not content: 'flash', 'chase', 'reveal' are
//     sign hardware, rate-capped below 3 events/s (photosensitivity) and degraded
//     to steady under prefers-reduced-motion.
//   • Optional `sound`: the sign's voice is its transformer hum — the level
//     follows the lit glass, so strikes flutter it in from silence and dropouts
//     kill it — plus a subliminal solenoid tick as each ignition takes
//     (flavour, not foley; silent in hidden tabs).
// Give it a canvas + text; drive it with setText/power/setOptions. Import-safe
// under node/SSR (no browser globals at module scope; Path2D built lazily).
import { type Color, parseColor, type RGB } from './color';
import { type NeonFont } from './font';
import { GASES, type GasName, type GasSpec } from './gas';
import {
	layoutTubes,
	type NeonArt,
	type NeonLayout,
	type TubeGrouping,
	type TubeSection
} from './layout';
import { createHum, createMechSound, type HumVoice, type MechSound } from './sound';
import { resolveTheme, type Theme, themeOwner, watchTheme } from './theme';

/** The flasher cam: 'steady' holds, 'flash' toggles the whole sign, 'chase' runs a
 *  dark slot around the sections, 'reveal' strikes them one after another on each
 *  power-on / setText. Cam rates are hard-capped below 3 events/s regardless of
 *  `speed` (photosensitivity); reduced motion degrades every program to steady. */
export type NeonProgram = 'steady' | 'flash' | 'chase' | 'reveal';

export interface NeonSignOptions {
	/** The sign's text; '\n' splits lines (default ''). The vendored faces cover
	 *  printable ASCII — anything else is skipped with one dev warning. */
	text?: string;
	/** Letterform: 'script' (connected cursive — the classic window sign, one tube
	 *  per word), 'sans' (block channel letters, one tube per glyph), or a custom
	 *  `NeonFont` (default 'script'). */
	font?: 'script' | 'sans' | NeonFont;
	/** Sign artwork: single-stroke pieces (SVG path data or polylines) composed
	 *  against the text block — 'behind' it or beside it, the way real signs put
	 *  the martini glass next to the word. Each piece is its own tube (own
	 *  gas/colour, strikes/ages/dies like any section); 'behind' pieces light
	 *  first under 'reveal'. See `NeonArt`. */
	art?: NeonArt[];
	/** Tube colour, or one per text line. Overrides the `gas` preset's colour;
	 *  the preset still shapes the hot core and dead glass. Patch `null` to clear
	 *  back to the gas colour. */
	color?: Color | Color[] | null;
	/** What's in the glass (default 'neon' — the red-orange): picks the lit
	 *  colour, the hot-core whiteness and the unlit tint. */
	gas?: GasName;
	/** Colour bundle: `'dark'` (default — lit tubes on a near-black wall),
	 *  `'light'` (`polarity: 'absorb'` on a near-white wall: the tubes ink a pale
	 *  surface, since a bloom cannot read against white) or `'auto'` to follow the
	 *  page's `prefers-color-scheme`. Either half is still yours to name. */
	theme?: Theme;
	/** The wall behind the sign (default near-black under `polarity: 'emit'`,
	 *  near-white under 'absorb'; null = transparent canvas — compose the sign
	 *  over your own backdrop). */
	wall?: Color | null;
	/** Which way the discharge runs (default 'emit' — light, like every real
	 *  tube). **'absorb' is invented**: an element whose discharge runs DARK, so
	 *  the tubes ink the wall instead of lighting it — halation, hot core and all,
	 *  multiplied into the surface rather than added to it. No such gas exists;
	 *  that's the joke, and it's the honest way to put a neon sign on a pale wall
	 *  (a bloom cannot read against white — the light-theme answer). Colours still
	 *  come from `gas`/`color`, darkened into ink: a white tube inverts into a
	 *  literal black light. */
	polarity?: 'emit' | 'absorb';
	/** Power (default true). Off is not blank: the unlit glass stays visible. */
	on?: boolean;
	/** Per-text-line circuits (default: all on) — the motel sign's separately
	 *  switched NO. An off line stays as unlit glass; switching it back on
	 *  strikes. Missing entries mean on; art pieces ride the main switch. */
	lineOn?: boolean[];
	/** Glow strength 0..1 (default 0.7). */
	glow?: number;
	/** The unlit tube itself — the glass you see with the power off. Defaults to a
	 *  neutral grey picked to contrast with the `wall` (light glass on a dark wall,
	 *  darker glass on a pale one); the gas still tints it on top. */
	glass?: Color;
	/** The electrode caps at each tube end — metal, not light. Also defaults
	 *  against the `wall`: near-black on a dark wall, mid-grey on a pale one,
	 *  where near-black specks read as dirt rather than hardware. */
	electrode?: Color;
	/** Wear 0..1 (default 0): deterministic per-tube dimming; past ~0.7 the
	 *  most-worn tube starts flickering, from ~0.95 it is dead glass while the
	 *  runner-up takes over the flickering. */
	age?: number;
	/** Electrical instability 0..1 (default 0): sparse random dips and re-strike
	 *  blips, scheduled — an idle sign still costs nothing. */
	flicker?: number;
	/** A failing transformer: every few seconds the whole sign drops out hard
	 *  (the hum dies with it) and re-strikes with a stagger (default false). */
	tired?: boolean;
	/** The flasher cam (default 'steady'). */
	program?: NeonProgram;
	/** Cam rate multiplier (default 1; the sub-3-events/s cap always wins). */
	speed?: number;
	/** Tube sectioning: 'auto' (script→word, sans→glyph) | 'glyph' | 'word' |
	 *  'line' (default 'auto'). A section strikes, flickers and dies as one tube. */
	tubes?: TubeGrouping;
	/** Per-line alignment (default 'center'). */
	align?: 'left' | 'center' | 'right';
	/** Baseline-to-baseline advance as a multiple of the face's ascent+descent
	 *  (default 1.1). */
	lineSpacing?: number;
	/** Extra tracking between glyphs as a fraction of cap height (default 0 —
	 *  tracking the script face apart breaks its joins). */
	letterSpacing?: number;
	/** The whole text block's tilt, degrees clockwise about its centre — the
	 *  rising script of the classic sign (default 0; negative rises left-to-
	 *  right). Art pieces keep their own `rotate`. */
	tilt?: number;
	/** Margin around the sign as a fraction of the canvas box, 0..0.4 (default 0.08). */
	padding?: number;
	/** One tube's strike sequence, ms (default 900; 0 = instant — also forced
	 *  under prefers-reduced-motion). Turn-off is always near-instant. */
	strikeMs?: number;
	/** The sign's voice — its transformer hum, whose level follows the lit
	 *  glass (strikes flutter it in, dropouts kill it), plus a subliminal
	 *  solenoid tick as each ignition takes: true (= 0.5) or a 0..1 volume.
	 *  Default off. Starts on the first user gesture (autoplay policy); muted
	 *  while the tab is hidden. */
	sound?: boolean | number;
	/** Mains frequency the transformer sings at, 50 or 60 Hz (default 50). */
	mains?: 50 | 60;
	/** Cap on devicePixelRatio (default 2). */
	pixelRatio?: number;
	/** Accessible name (default 'neon sign'; '' hides from the a11y tree). The
	 *  shown text is appended so the sign reads as what it says. */
	label?: string;
}

export interface NeonSign {
	/** Re-glass the sign: new tubes land dark and strike on (instant under
	 *  reduced motion / `strikeMs: 0`). */
	setText(text: string): void;
	/** The wall switch: off leaves the unlit glass visible; on re-strikes every
	 *  section ('reveal' strikes them in order). */
	power(on: boolean): void;
	/** Rap the glass: a lit tube stutters — a hard dip and, half the time, a
	 *  re-strike blip through its ignition pops, exactly what `flicker`
	 *  schedules on its own. Pass a section index (from `sectionAt`) or nothing
	 *  for a whole-sign shudder; dark and dead glass ignore it. Reduced motion
	 *  gets the dip without the stutter. */
	jolt(section?: number): void;
	/** Which tube sits under a viewport point — pass `e.clientX`/`e.clientY`
	 *  straight from a pointer event; null if the tap missed the glass. The
	 *  library owns the tube maths; consumers own the listeners (the sign
	 *  attaches none — it's a display). */
	sectionAt(clientX: number, clientY: number): number | null;
	/** A tube section's glass bounds in viewport coordinates — position a DOM
	 *  overlay (a focusable control, a tooltip) over the tube a tap named. Null
	 *  out of range or before the first layout. */
	sectionRect(section: number): { left: number; top: number; width: number; height: number } | null;
	setOptions(patch: Partial<NeonSignOptions>): void;
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
const WHITE: RGB = [1, 1, 1];
const BLACK: RGB = [0, 0, 0];
// Squared distance from a point to a segment — the hit-test's inner loop.
const segDist2 = (px: number, py: number, a: [number, number], b: [number, number]): number => {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const len = dx * dx + dy * dy;
	const t = len > 0 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len)) : 0;
	const ex = a[0] + t * dx - px;
	const ey = a[1] + t * dy - py;
	return ex * ex + ey * ey;
};
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const fract = (x: number) => x - Math.floor(x);

// Tube thickness in font units (cap height 21) — the constant-width glass.
const T = 1.9;
// The wear arc thresholds — seven-segment's, at tube granularity.
const DIE_AT = 0.95;
// Cam floors, ms: no program state may flip faster than ~2.5 events/s full-field
// (flash half-cycle) — the photosensitivity cap `speed` cannot defeat.
const FLASH_MIN = 200;
const CHASE_MIN = 120;

// Brightness over one strike: dark while the electrodes arc (t<0.15), partial-
// ignition pops (to 0.55), full ignition overshooting to ~1.15, then settling.
// Deterministic per tube (`j` = its jit) — a looping demo strikes the same twice.
function strikeBri(t: number, j: number): number {
	if (t < 0.15) return 0;
	if (t < 0.55) {
		const windows = 4 + Math.round(j * 3);
		const win = Math.floor(((t - 0.15) / 0.4) * windows);
		if (win % 2 === 0) return 0.02;
		return 0.18 + 0.4 * fract(Math.sin(win * 12.9898 + j * 78.233) * 43758.5453);
	}
	if (t < 0.75) return 1.15 * ((t - 0.55) / 0.2);
	return 1.15 - 0.15 * ((t - 0.75) / 0.25);
}

/** Create a neon sign on a 2D canvas. Returns null if 2D is unavailable. */
export function createNeonSign(
	canvas: HTMLCanvasElement,
	opts: NeonSignOptions = {}
): NeonSign | null {
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;

	let text = opts.text ?? '';
	let font = opts.font ?? 'script';
	let art = opts.art;
	let colorOpt = opts.color ?? undefined;
	let gas: GasName = opts.gas ?? 'neon';
	// The theme picks the whole trick: light means the tubes INK a pale wall
	// (`polarity: 'absorb'`), which is the only honest way a neon sign lives on a
	// bright page. Either half is still yours to name.
	const themed = themeOwner(['polarity', 'wall'] as const);
	themed.mark(opts);
	let theme = opts.theme ?? 'dark';
	let scheme = resolveTheme(theme);
	let polarity: 'emit' | 'absorb' = opts.polarity ?? (scheme === 'light' ? 'absorb' : 'emit');
	// A wall the consumer never named follows the polarity (dark for emitted
	// light, pale for absorbed); an explicit one is theirs and never moves.
	const defaultWall = () => (polarity === 'emit' ? '#0b0b0e' : '#f3f2ef');
	let wall = opts.wall === null ? null : parseColor(opts.wall ?? defaultWall());
	/** Move polarity and wall to the resolved scheme, minus whatever is named. */
	function applyTheme() {
		if (themed.owns('polarity')) polarity = scheme === 'light' ? 'absorb' : 'emit';
		if (themed.owns('wall') && wall) wall = parseColor(defaultWall());
	}
	let on = opts.on ?? true;
	let lineOn = opts.lineOn;
	let glow = clamp01(opts.glow ?? 0.7);
	let glassCol = opts.glass != null ? parseColor(opts.glass) : null;
	let elecCol = opts.electrode != null ? parseColor(opts.electrode) : null;
	let age = clamp01(opts.age ?? 0);
	let flicker = clamp01(opts.flicker ?? 0);
	let tired = opts.tired ?? false;
	let program: NeonProgram = opts.program ?? 'steady';
	let speed = Math.max(0.1, Math.min(8, opts.speed ?? 1));
	let tubes: TubeGrouping = opts.tubes ?? 'auto';
	let align = opts.align ?? 'center';
	let lineSpacing = opts.lineSpacing;
	let letterSpacing = opts.letterSpacing;
	let tilt = opts.tilt;
	let padding = Math.max(0, Math.min(0.4, opts.padding ?? 0.08));
	let strikeMs = opts.strikeMs ?? 900;
	let volume = opts.sound === true ? 0.5 : clamp01(Number(opts.sound) || 0);
	let mains: 50 | 60 = opts.mains ?? 50;
	let pixelRatio = opts.pixelRatio ?? 2;
	let label = opts.label ?? 'neon sign';
	let w = 0;
	let h = 0;
	let dpr = 1;

	const reduced =
		typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	const artKey = (a?: NeonArt[]) => (a?.length ? JSON.stringify(a) : '');

	// Per-instance wear fingerprint (deterministic per instance — the dying letter
	// is stable across a demo loop) and per-tube mechanical character.
	const seed = Math.random() * 1000;

	// --- layout + per-section state ------------------------------------------------
	let lay: NeonLayout;
	let n = 0;
	let lit = new Float32Array(0); // current brightness (overshoots to ~1.15 mid-strike)
	let strikeT = new Float32Array(0); // strike progress 0..1, -1 = none
	let wait = new Float32Array(0); // stagger before a pending strike, seconds
	let dip = new Float32Array(0); // flicker dip multiplier, eases back to 1
	let jit = new Float32Array(0);
	let wear = new Float32Array(0);
	let camOn: Uint8Array = new Uint8Array(0); // the cam's per-section switch state
	let paths: (Path2D | null)[] = [];
	let dying = -1;
	let second = -1;
	let dropRemain = 0; // a tired-transformer dropout in progress, seconds left

	function relayout() {
		lay = layoutTubes(text, font, { tubes, align, lineSpacing, letterSpacing, tilt, art });
		n = lay.sections.length;
		lit = new Float32Array(n);
		strikeT = new Float32Array(n).fill(-1);
		wait = new Float32Array(n);
		dip = new Float32Array(n).fill(1);
		jit = new Float32Array(n);
		wear = new Float32Array(n);
		camOn = new Uint8Array(n).fill(1);
		paths = new Array<Path2D | null>(n).fill(null);
		for (let i = 0; i < n; i++) {
			jit[i] = Math.random();
			wear[i] = 0.5 + 0.5 * Math.sin(seed + i * 12.9898);
		}
		dying = second = -1;
		for (let i = 0; i < n; i++) if (dying < 0 || wear[i] > wear[dying]) dying = i;
		for (let i = 0; i < n; i++)
			if (i !== dying && (second < 0 || wear[i] > wear[second])) second = i;
		dropRemain = 0;
	}
	relayout();

	const worn = (i: number) => 1 - wear[i] * age * 0.5;
	const isDead = (i: number) => age >= DIE_AT && i === dying;
	// A text line whose own circuit is switched off (art rides the main switch).
	const lineCut = (i: number) =>
		lay.sections[i].art == null && lineOn?.[lay.sections[i].line] === false;
	// What the tube should sit at once nothing is in flight.
	const targetOf = (i: number) =>
		on && !isDead(i) && camOn[i] && !lineCut(i) && dropRemain <= 0 ? 1 : 0;

	// --- sound -----------------------------------------------------------------------
	// The sign has ONE sound: its electricity. The hum's level follows the lit
	// glass, so every audible change is the model itself: a staggered strike
	// FLUTTERS the hum in from silence as the tubes pop through their ignition
	// flickers, wear dips duck it, a dropout kills it dead. (A long trail of
	// added strike sounds — glass taps, ringing plinks, thermal tick scatters,
	// digital glints, static sputters — was tried and deleted: anything doing
	// impressions read as faux. The honest voice was here all along.) The one
	// survivor, for flavour not foley: a subliminal solenoid tick as a tube's
	// starter engages and its ignition takes — the family's mechanical accent,
	// at a level that reads as texture on the hum, never as an effect.
	let snd: MechSound | null = null;
	// The family click: the flip-dot's measured solenoid recipe — the same voice
	// the split-flap speaks stretched to its longer throw — here at subliminal
	// gain, so all three cores are audibly siblings.
	const tick = (gain: number) => {
		if (volume <= 0) return;
		const j = Math.random();
		(snd ??= createMechSound({ volume })).tick({
			freq: 6300 + j * 4200,
			decay: 0.004 + j * 0.012,
			noise: 0.9,
			noiseHz: 5200,
			gain: gain * (0.5 + 0.5 * j)
		});
	};
	let hum: HumVoice | null = null;
	const humVoice = (): HumVoice | null => {
		if (volume > 0 && !hum) hum = createHum({ volume, base: mains * 2 });
		return volume > 0 ? hum : null;
	};
	let lastHum = -1;
	function pushHum() {
		const v = humVoice();
		if (!v) return;
		let sum = 0;
		for (let i = 0; i < n; i++) sum += Math.min(1, lit[i]) * worn(i) * dip[i];
		// A hidden tab keeps its audio running — a continuous hum must not.
		const hidden = typeof document !== 'undefined' && document.hidden;
		const level = hidden || n === 0 ? 0 : sum / n;
		if (Math.abs(level - lastHum) > 0.015 || (level === 0) !== (lastHum === 0)) {
			lastHum = level;
			v.setLevel(level);
		}
	}
	const onVis = () => pushHum();

	// --- rendering -------------------------------------------------------------------
	// The last frame's fit transform (sign units → canvas CSS px), kept so a tap
	// can be mapped back onto the glass.
	let fitS = 0;
	let fitTx = 0;
	let fitTy = 0;
	const pathFor = (i: number): Path2D => {
		let p = paths[i];
		if (!p) {
			p = new Path2D();
			for (const s of lay.sections[i].strokes) {
				p.moveTo(s[0][0], s[0][1]);
				for (let k = 1; k < s.length; k++) p.lineTo(s[k][0], s[k][1]);
			}
			paths[i] = p;
		}
		return p;
	};

	// A section's tube spec: gas preset colours, or a `color` override riding the
	// preset's core/coating character. Art carries its own gas/colour; without one
	// it follows the sign's gas or single-colour override — never a per-line array.
	const overrideSpec = (c: RGB, base: GasSpec): GasSpec => ({
		color: c,
		core: base.core,
		unlit: mix(c, [0.5, 0.5, 0.55], 0.55),
		coated: base.coated
	});
	// A bare [r,g,b] triple is one colour; any other array is one-per-line.
	const singleColor = (v: typeof colorOpt): Color | null =>
		v == null ? null : !Array.isArray(v) || typeof v[0] === 'number' ? (v as Color) : null;
	function specFor(sec: TubeSection): GasSpec {
		const a = sec.art != null ? art?.[sec.art] : undefined;
		if (a) {
			const base = GASES[a.gas ?? gas];
			const own = a.color ?? singleColor(colorOpt);
			return own != null ? overrideSpec(parseColor(own), base) : base;
		}
		const base = GASES[gas];
		if (colorOpt == null) return base;
		const single = singleColor(colorOpt);
		const c =
			single != null
				? parseColor(single)
				: parseColor((colorOpt as Color[])[sec.line % (colorOpt as Color[]).length]);
		return overrideSpec(c, base);
	}

	// Absorbing tubes are composited ONCE per frame, not once per pass. A blend
	// mode on a blurred stroke is a slow path in every browser — 300+ of them per
	// frame took a heavy sign to ~5 fps — so the ink accumulates on this layer with
	// plain source-over and lands as a single `multiply`. Allocated only when a
	// sign actually has an absorbing section.
	let ink: HTMLCanvasElement | null = null;
	function inkCanvas(): CanvasRenderingContext2D | null {
		if (!ink) ink = document.createElement('canvas');
		if (ink.width !== canvas.width || ink.height !== canvas.height) {
			ink.width = canvas.width;
			ink.height = canvas.height;
		}
		const ig = ink.getContext('2d');
		if (!ig) return null;
		ig.setTransform(1, 0, 0, 1, 0, 0);
		ig.clearRect(0, 0, ink.width, ink.height);
		ig.lineJoin = 'round';
		ig.lineCap = 'round';
		return ig;
	}

	function draw() {
		if (!w || !h) return;
		const g = ctx!;
		g.setTransform(1, 0, 0, 1, 0, 0);
		if (wall) {
			g.fillStyle = rgba(wall, 1);
			g.fillRect(0, 0, canvas.width, canvas.height);
		} else {
			// Transparent mode: straight (un-premultiplied) alpha over a cleared
			// canvas — reads on any backdrop (the nixie `bare` contract).
			g.clearRect(0, 0, canvas.width, canvas.height);
		}
		if (n === 0) return;
		g.scale(dpr, dpr);

		// Fit the sign units into the padded canvas box.
		const availW = Math.max(1, w * (1 - 2 * padding));
		const availH = Math.max(1, h * (1 - 2 * padding));
		const s = Math.min(availW / Math.max(1e-6, lay.width), availH / Math.max(1e-6, lay.height));
		const tx = (w - lay.width * s) / 2 - lay.left * s;
		const ty = (h - lay.height * s) / 2 - lay.top * s;
		// Remember the fit — `sectionAt` inverts exactly this to hit-test taps.
		fitS = s;
		fitTx = tx;
		fitTy = ty;
		g.translate(tx, ty);
		g.scale(s, s);
		g.lineJoin = 'round';
		g.lineCap = 'round';

		// The non-luminous parts read against the WALL, not against the polarity:
		// glass and metal are just objects on a surface, so what they need is
		// contrast with it. (The light itself still inverts per element.) With a
		// transparent canvas there's no wall to measure — fall back to the polarity.
		const paleWall = wall
			? 0.2126 * wall[0] + 0.7152 * wall[1] + 0.0722 * wall[2] > 0.5
			: polarity !== 'emit';

		// Level of detail from the rendered cap height (css px): tiny signs drop the
		// halation stack and hardware the way nixie's micro tubes do. A CROWDED sign
		// steps down too — the full ramp is 7 blurred strokes per tube, so past a
		// couple of dozen tubes the frame budget matters more than the last two
		// passes nobody can see.
		const capPx = 21 * s;
		const micro = capPx < 13;
		const compact = capPx < 28 || n > 24;
		const blur = (f: number) => Math.min(capPx * f * glow, 160);

		// Set up the ink layer only if something on this sign absorbs.
		let anyAbsorb = false;
		for (const sec of lay.sections)
			if (((sec.art != null ? art?.[sec.art]?.polarity : undefined) ?? polarity) === 'absorb') {
				anyAbsorb = true;
				break;
			}
		const ig = anyAbsorb ? inkCanvas() : null;
		if (ig) {
			ig.scale(dpr, dpr);
			ig.translate(tx, ty);
			ig.scale(s, s);
		}

		for (let i = 0; i < n; i++) {
			const sec = lay.sections[i];
			const spec = specFor(sec);
			const p = pathFor(i);
			const lvl = Math.min(1.15, lit[i]) * worn(i) * dip[i];
			// Emitted light ADDS to the wall; absorbed light MULTIPLIES into it — the
			// same ramp run backwards. Per SECTION, not per sign: the element runs
			// dark, not the circuit, so white dice can shine black beside lettering
			// that still shines gold.
			const emit =
				((sec.art != null ? art?.[sec.art]?.polarity : undefined) ?? polarity) === 'emit';
			const core = emit ? WHITE : BLACK;
			// The ink an absorbing tube discharges: the gas colour taken down toward
			// black, so a white tube really does shine black.
			const gasCol = emit ? spec.color : mix(spec.color, BLACK, 0.5);

			// The glass itself — always there, lit or not. Coated tubes show their
			// paint; clear ones pale glass with a hint of the gas. On a pale wall the
			// neutral pass has to darken instead of lighten to read at all.
			if (!(micro && lvl > 0.5)) {
				g.shadowBlur = 0;
				g.strokeStyle = rgba(
					glassCol ?? (paleWall ? [0.29, 0.3, 0.33] : [0.62, 0.64, 0.69]),
					paleWall ? 0.13 : 0.1
				);
				g.lineWidth = T * 1.25;
				g.stroke(p);
				g.strokeStyle = rgba(
					emit ? spec.unlit : mix(spec.unlit, BLACK, 0.35),
					spec.coated ? 0.22 : 0.11
				);
				g.lineWidth = T * 0.95;
				g.stroke(p);
			}

			// Electrode stubs: the metal cap + its ferrule dot at each free end. On a
			// pale wall these are the darkest marks on the sign, so absorbing tubes
			// default to mid-grey hardware — near-black specks read as dirt.
			if (!compact) {
				g.shadowBlur = 0;
				const metal = elecCol ?? (paleWall ? [0.55, 0.56, 0.59] : [0.18, 0.18, 0.21]);
				// The ferrule catches the light: brighter on a dark wall, shadowed on a
				// pale one — either way it separates from the cap.
				const ferrule = mix(metal, paleWall ? BLACK : WHITE, 0.35);
				for (const e of lay.sections[i].ends) {
					const ex = e.x + e.dx * T * 1.1;
					const ey = e.y + e.dy * T * 1.1;
					g.strokeStyle = rgba(metal, 0.9);
					g.lineWidth = T * 0.8;
					g.beginPath();
					g.moveTo(e.x, e.y);
					g.lineTo(ex, ey);
					g.stroke();
					g.fillStyle = rgba(ferrule, 0.8);
					g.beginPath();
					g.arc(ex + e.dx * T * 0.3, ey + e.dy * T * 0.3, T * 0.32, 0, Math.PI * 2);
					g.fill();
				}
			}

			if (lvl > 0.02) {
				// The glow stack: a graduated ramp of translucent strokes — wide
				// halation down through the gas to the white-hot core — so the tube's
				// cross-section reads as a smooth luminous cylinder. No single pass is
				// near-opaque: a hard-edged body under a soft shadow is exactly the
				// crisp-vector-plus-drop-shadow look of a CSS text-shadow, the thing
				// this core exists to beat. [shadowBlur, alpha, width×T, white-mix]
				// per pass; hot passes (white-mix ≥ 0.6) scale by lvl² so the core
				// only shows on a fully lit tube. All source-over + shadowBlur — no
				// 'lighter', which artifacts over a transparent canvas.
				const layers: [number, number, number, number][] = micro
					? [
							[0.3, 0.6, 1.3, 0],
							[0.05, 0.7, 0.6, 1]
						]
					: compact
						? [
								[0.42, 0.35, 1.6, 0],
								[0.14, 0.5, 1.1, 0],
								[0.08, 0.5, 0.7, 0.3],
								[0.05, 0.6, 0.4, 1]
							]
						: [
								[0.7, 0.22, 2.6, 0],
								[0.3, 0.4, 1.6, 0],
								[0.12, 0.42, 1.25, 0],
								[0.08, 0.45, 1, 0.12],
								[0.05, 0.5, 0.75, 0.3],
								[0.04, 0.5, 0.5, 0.65],
								[0.03, 0.55, 0.3, 1]
							];
				// Emitted light goes straight on the wall; absorbed light accumulates
				// on the ink layer and is multiplied in once, after the loop.
				const t = emit || !ig ? g : ig;
				// Accumulating on a layer and multiplying once is lighter than
				// multiplying every pass in turn, so the ink gets a nudge back to the
				// density the per-pass version had.
				const density = emit ? 1 : 1.35;
				t.shadowColor = rgba(gasCol, 1);
				for (const [blurF, alpha, lwF, wm] of layers) {
					const a = (wm >= 0.6 ? alpha * lvl * lvl : alpha * lvl) * density;
					t.shadowBlur = blur(blurF) * Math.min(1, lvl);
					t.strokeStyle = rgba(wm ? mix(gasCol, core, spec.core * wm) : gasCol, a);
					t.lineWidth = T * lwF;
					t.stroke(p);
				}
				t.shadowBlur = 0;
			}

			// The electrode arc while the tube is still dark: bright sparks at both
			// ends, jittering frame to frame the way a starting arc does.
			if (strikeT[i] >= 0 && strikeT[i] < 0.2 && !micro) {
				const t = emit || !ig ? g : ig;
				t.shadowColor = rgba(gasCol, 1);
				t.shadowBlur = blur(0.2);
				for (const e of lay.sections[i].ends) {
					t.fillStyle = rgba(mix(gasCol, core, 0.85), 0.5 + Math.random() * 0.5);
					t.beginPath();
					t.arc(
						e.x + (Math.random() - 0.5) * T * 0.5,
						e.y + (Math.random() - 0.5) * T * 0.5,
						T * (0.3 + Math.random() * 0.25),
						0,
						Math.PI * 2
					);
					t.fill();
				}
				t.shadowBlur = 0;
			}
		}

		// The ink lands in one blend: all absorbed light at once.
		if (ig && ink) {
			g.setTransform(1, 0, 0, 1, 0, 0);
			g.globalCompositeOperation = 'multiply';
			g.drawImage(ink, 0, 0);
			g.globalCompositeOperation = 'source-over';
		}
	}

	// --- animation ---------------------------------------------------------------
	// rAF runs only while something is in flight (strikes, fades, dip recoveries,
	// dropouts); a resting sign — lit or dark — costs nothing.
	let raf = 0;
	let lastT = 0;

	function snapAll() {
		for (let i = 0; i < n; i++) {
			lit[i] = targetOf(i);
			strikeT[i] = -1;
			wait[i] = 0;
			dip[i] = 1;
		}
		draw();
		pushHum();
	}

	function animate() {
		if (reduced || strikeMs <= 0) {
			// Snap everything except dip recoveries (dips don't happen under reduced
			// motion; strikeMs 0 keeps flicker, so let the loop run those out).
			let dipping = false;
			for (let i = 0; i < n; i++) if (dip[i] < 1) dipping = true;
			if (!dipping) {
				snapAll();
				return;
			}
		}
		if (raf) return;
		lastT = performance.now();
		const step = () => {
			raf = 0;
			const now = performance.now();
			const dt = Math.min(0.1, (now - lastT) / 1000);
			lastT = now;
			let moving = false;

			if (dropRemain > 0) {
				dropRemain -= dt;
				moving = true;
				if (dropRemain <= 0) {
					dropRemain = 0;
					// The transformer catches again: a quick staggered re-strike, past
					// the arc phase (the tubes are warm).
					for (let i = 0; i < n; i++)
						if (targetOf(i) === 1) {
							strikeT[i] = 0.45;
							wait[i] = jit[i] * 0.15;
						}
				}
			}

			for (let i = 0; i < n; i++) {
				if (wait[i] > 0) {
					wait[i] -= dt;
					moving = true;
					continue;
				}
				if (strikeT[i] >= 0) {
					const prev = strikeT[i];
					strikeT[i] += (dt * 1000) / Math.max(1, strikeMs * (0.85 + 0.3 * jit[i]));
					if (prev < 0.15 && strikeT[i] >= 0.15)
						tick(0.06); // the starter engages
					else if (prev < 0.55 && strikeT[i] >= 0.55) tick(0.1); // ignition takes
					if (strikeT[i] >= 1) {
						strikeT[i] = -1;
						lit[i] = targetOf(i); // lands lit — unless the cam moved on mid-strike
					} else {
						lit[i] = strikeBri(strikeT[i], jit[i]);
					}
					moving = true;
					continue;
				}
				const target = targetOf(i);
				if (lit[i] < target) {
					// A cam/dropout re-light without a full strike: the tube is warm.
					lit[i] = Math.min(target, lit[i] + dt / 0.05);
					moving = true;
				} else if (lit[i] > target) {
					// The discharge just stops — near-instant decay.
					lit[i] = Math.max(target, lit[i] - dt / 0.06);
					moving = true;
				}
				if (dip[i] < 1) {
					dip[i] = Math.min(1, dip[i] + dt * 6);
					moving = true;
				}
			}
			draw();
			pushHum();
			if (moving) raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
	}

	// Begin a full strike-on: 'reveal' walks the sections in order, anything else
	// scatters them the way independently-warming tubes do.
	function beginStrikes() {
		if (reduced || strikeMs <= 0) {
			snapAll();
			return;
		}
		for (let i = 0; i < n; i++) {
			if (targetOf(i) !== 1) continue;
			lit[i] = 0;
			strikeT[i] = 0;
			wait[i] = program === 'reveal' ? i * Math.max(0.24, (strikeMs / 1000) * 0.4) : jit[i] * 0.14;
		}
		animate();
	}

	// --- schedulers (timeouts, not a render loop — idle cost ≈ 0) -------------------
	let dipTimer: ReturnType<typeof setTimeout> | null = null;
	let tiredTimer: ReturnType<typeof setTimeout> | null = null;
	let camTimer: ReturnType<typeof setTimeout> | null = null;
	let camStep = 0;

	// One scheduler covers both failure modes: the wear arc's dying tube past
	// age 0.7 (seven-segment's cadence) and `flicker`'s random instability.
	function syncDips() {
		const want = on && !reduced && n > 0 && (age > 0.7 || flicker > 0);
		if (!want) {
			if (dipTimer) {
				clearTimeout(dipTimer);
				dipTimer = null;
			}
			return;
		}
		if (dipTimer) return;
		const tick = () => {
			dipTimer = null;
			if (!on || reduced || (age <= 0.7 && flicker <= 0)) return;
			let target = -1;
			if (age > 0.7 && (flicker <= 0 || Math.random() < 0.6)) {
				target = age >= DIE_AT || (age >= 0.9 && Math.random() < 0.35) ? second : dying;
			} else if (n > 0) {
				target = Math.floor(Math.random() * n);
			}
			if (target >= 0 && lit[target] > 0.5) {
				dip[target] = 0.05 + Math.random() * 0.35;
				animate();
			}
			dipTimer = setTimeout(tick, (400 + Math.random() * 2000) / (1 + flicker * 2.5));
		};
		dipTimer = setTimeout(tick, (400 + Math.random() * 2000) / (1 + flicker * 2.5));
	}

	function syncTired() {
		const want = on && tired && !reduced && n > 0;
		if (!want) {
			if (tiredTimer) {
				clearTimeout(tiredTimer);
				tiredTimer = null;
			}
			if (dropRemain > 0) {
				dropRemain = 0;
				animate();
			}
			return;
		}
		if (tiredTimer) return;
		const tick = () => {
			tiredTimer = null;
			if (!on || !tired || reduced) return;
			dropRemain = 0.3 + Math.random() * 0.9;
			animate();
			tiredTimer = setTimeout(tick, 3000 + Math.random() * 6000);
		};
		tiredTimer = setTimeout(tick, 3000 + Math.random() * 6000);
	}

	function syncCam() {
		const want = on && !reduced && n > 0 && (program === 'flash' || program === 'chase');
		if (!want) {
			if (camTimer) {
				clearTimeout(camTimer);
				camTimer = null;
			}
			if (camOn.length && camOn.includes(0)) {
				camOn.fill(1);
				animate();
			}
			return;
		}
		if (camTimer) return;
		const tick = () => {
			camTimer = null;
			if (!on || reduced || (program !== 'flash' && program !== 'chase')) return;
			camStep++;
			// A `steady` art piece is wired past the cam — the diner border that
			// stays lit around the blinking word.
			const past = (i: number) => {
				const ai = lay.sections[i].art;
				return ai != null && art?.[ai]?.steady === true;
			};
			if (program === 'flash') {
				const v = camStep % 2 ? 0 : 1;
				for (let i = 0; i < n; i++) camOn[i] = past(i) ? 1 : v;
			} else {
				// The chase: one dark slot in four running along the sections.
				for (let i = 0; i < n; i++) camOn[i] = past(i) || (i + camStep) % 4 !== 0 ? 1 : 0;
			}
			animate();
			camTimer = setTimeout(
				tick,
				Math.max(
					program === 'flash' ? FLASH_MIN : CHASE_MIN,
					(program === 'flash' ? 800 : 320) / speed
				)
			);
		};
		camTimer = setTimeout(tick, 60);
	}

	function syncAll() {
		syncDips();
		syncTired();
		syncCam();
	}

	// --- aria / resize ---------------------------------------------------------------
	function applyAria() {
		canvas.setAttribute('role', 'img');
		if (label) {
			const shown = text
				.split(/\r?\n/)
				.map((l) => l.trim())
				.filter(Boolean)
				.join(' / ');
			canvas.setAttribute('aria-label', shown ? `${label}: ${shown}` : label);
			canvas.removeAttribute('aria-hidden');
		} else {
			canvas.setAttribute('aria-hidden', 'true');
			canvas.removeAttribute('aria-label');
		}
	}

	function resize() {
		const cap = pixelRatio > 0 ? pixelRatio : 1;
		dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, cap);
		const r = canvas.getBoundingClientRect();
		w = Math.max(1, r.width || canvas.clientWidth || 1);
		h = Math.max(1, r.height || canvas.clientHeight || 1);
		// Pin the CSS box if the attributes drive layout — a HiDPI backing-store
		// write must not feed back into the ResizeObserver (nixie's retina loop).
		if (Math.abs(w - canvas.width) < 1 && Math.abs(h - canvas.height) < 1) {
			canvas.style.width = `${w}px`;
			canvas.style.height = `${h}px`;
		}
		canvas.width = Math.max(1, Math.round(w * dpr));
		canvas.height = Math.max(1, Math.round(h * dpr));
		draw();
	}

	applyAria();
	const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
	// `theme: 'auto'` follows the page: the sign flips polarity when the scheme does.
	const repaintTheme = (next: 'dark' | 'light') => {
		scheme = next;
		applyTheme();
		draw();
	};
	let stopTheme = watchTheme(theme, repaintTheme);
	ro?.observe(canvas);
	if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);
	// First paint lands at its targets — no boot animation (sibling convention);
	// the strike show is opt-in via power()/setText/'reveal'.
	for (let i = 0; i < n; i++) lit[i] = targetOf(i);
	resize();
	pushHum();
	syncAll();

	return {
		setText(t) {
			const next = String(t ?? '');
			if (next === text) return;
			text = next;
			relayout();
			applyAria();
			if (on) beginStrikes();
			else snapAll();
			syncAll();
		},
		jolt(section) {
			// A disturbance applied to the model, not a canned effect: the core owns
			// what an unstable tube looks like (dip depth, eased recovery, the
			// re-strike through its ignition pops, the hum ducking with it) exactly
			// as the `flicker` scheduler does — the consumer owns when it happens.
			if (n === 0) return;
			const hit = section == null ? -1 : Math.floor(section);
			const targets = hit >= 0 && hit < n ? [hit] : Array.from({ length: n }, (_, i) => i);
			let struck = false;
			for (const i of targets) {
				if (lit[i] <= 0.5 || isDead(i)) continue; // dark and dead glass can't flicker
				dip[i] = 0.05 + Math.random() * 0.25;
				// Half the time it stutters back through the ignition pops instead of
				// just dipping. Reduced motion gets the dip alone.
				if (!reduced && strikeMs > 0 && Math.random() < 0.5) {
					strikeT[i] = 0.3;
					wait[i] = 0;
				}
				struck = true;
			}
			if (struck) {
				tick(0.08);
				animate();
			}
		},
		sectionAt(clientX, clientY) {
			if (n === 0 || !w || !h || !(fitS > 0)) return null;
			const r = canvas.getBoundingClientRect();
			if (!r.width || !r.height) return null;
			// Viewport → canvas CSS px → sign units: the inverse of the fit transform
			// the last frame drew with.
			const x = (((clientX - r.left) / r.width) * w - fitTx) / fitS;
			const y = (((clientY - r.top) / r.height) * h - fitTy) / fitS;
			const tol = T * 2.5; // a fingertip's worth of glass around the centreline
			let best: number | null = null;
			let bestD = tol * tol;
			for (let i = 0; i < n; i++) {
				for (const stroke of lay.sections[i].strokes) {
					for (let k = 1; k < stroke.length; k++) {
						const d = segDist2(x, y, stroke[k - 1], stroke[k]);
						if (d < bestD) {
							bestD = d;
							best = i;
						}
					}
				}
			}
			return best;
		},
		sectionRect(section) {
			const s = Math.floor(section);
			if (!(s >= 0 && s < n) || !w || !h || !(fitS > 0)) return null;
			const r = canvas.getBoundingClientRect();
			if (!r.width || !r.height) return null;
			let minX = Infinity;
			let minY = Infinity;
			let maxX = -Infinity;
			let maxY = -Infinity;
			for (const stroke of lay.sections[s].strokes) {
				for (const [px, py] of stroke) {
					if (px < minX) minX = px;
					if (py < minY) minY = py;
					if (px > maxX) maxX = px;
					if (py > maxY) maxY = py;
				}
			}
			if (minX > maxX) return null;
			// The centreline box, padded to the glass edge — the widest drawn pass
			// is the unlit tube at `T * 1.25` wide, so half of that each side.
			const pad = T * 0.625;
			// Sign units → canvas CSS px (the fit the last frame drew with) →
			// viewport, scaled into the live rect like split-flap's `cellRect`.
			const kx = r.width / w;
			const ky = r.height / h;
			return {
				left: r.left + ((minX - pad) * fitS + fitTx) * kx,
				top: r.top + ((minY - pad) * fitS + fitTy) * ky,
				width: (maxX - minX + pad * 2) * fitS * kx,
				height: (maxY - minY + pad * 2) * fitS * ky
			};
		},
		power(v) {
			if (v === on) return;
			on = v;
			if (on) beginStrikes();
			else {
				for (let i = 0; i < n; i++) {
					strikeT[i] = -1;
					wait[i] = 0;
				}
				animate();
			}
			syncAll();
		},
		setOptions(patch) {
			let rebuild = false;
			let redraw = false;
			// Anything named in this patch becomes the consumer's for good, so mark it
			// before the theme gets a chance to move it.
			themed.mark(patch);
			if (patch.theme !== undefined && patch.theme !== theme) {
				theme = patch.theme;
				scheme = resolveTheme(theme);
				stopTheme();
				stopTheme = watchTheme(theme, repaintTheme);
				applyTheme();
				redraw = true;
			}
			if (patch.text !== undefined && patch.text !== text) {
				this.setText(patch.text);
			}
			if (patch.font !== undefined && patch.font !== font) {
				font = patch.font;
				rebuild = true;
			}
			if (patch.tubes !== undefined && patch.tubes !== tubes) {
				tubes = patch.tubes;
				rebuild = true;
			}
			if (patch.align !== undefined && patch.align !== align) {
				align = patch.align;
				rebuild = true;
			}
			if (patch.lineSpacing !== undefined && patch.lineSpacing !== lineSpacing) {
				lineSpacing = patch.lineSpacing;
				rebuild = true;
			}
			if (patch.letterSpacing !== undefined && patch.letterSpacing !== letterSpacing) {
				letterSpacing = patch.letterSpacing;
				rebuild = true;
			}
			if (patch.tilt !== undefined && patch.tilt !== tilt) {
				tilt = patch.tilt;
				rebuild = true;
			}
			if (patch.art !== undefined && artKey(patch.art) !== artKey(art)) {
				// Content compare (the drum-zones precedent): a wrapper re-passing an
				// equal art list every render must never re-glass the sign.
				art = patch.art;
				rebuild = true;
			}
			if (rebuild) {
				// A re-bend is new glass, but option twiddling shouldn't strike — the
				// new tubes land at the sign's current state instantly.
				relayout();
				snapAll();
			}
			if (patch.color !== undefined) {
				colorOpt = patch.color ?? undefined; // null clears back to the gas colour
				redraw = true;
			}
			if (patch.gas != null) {
				gas = patch.gas;
				redraw = true;
			}
			if (patch.wall !== undefined) {
				wall = patch.wall === null ? null : parseColor(patch.wall);
				redraw = true;
			}
			if (patch.polarity != null && patch.polarity !== polarity) {
				polarity = patch.polarity;
				// An unnamed wall follows the flip; the consumer's own never moves.
				if (themed.owns('wall') && wall) wall = parseColor(defaultWall());
				redraw = true;
			}
			if (patch.glow != null) {
				glow = clamp01(patch.glow);
				redraw = true;
			}
			if (patch.glass !== undefined) {
				glassCol = patch.glass != null ? parseColor(patch.glass) : null;
				redraw = true;
			}
			if (patch.electrode !== undefined) {
				elecCol = patch.electrode != null ? parseColor(patch.electrode) : null;
				redraw = true;
			}
			if (patch.age != null) {
				age = clamp01(patch.age);
				redraw = true;
			}
			if (patch.flicker != null) flicker = clamp01(patch.flicker);
			if (patch.tired != null) tired = patch.tired;
			if (patch.program != null) program = patch.program;
			if (patch.speed != null) speed = Math.max(0.1, Math.min(8, patch.speed));
			if (patch.strikeMs != null) strikeMs = patch.strikeMs;
			if (patch.padding != null) {
				padding = Math.max(0, Math.min(0.4, patch.padding));
				redraw = true;
			}
			if (patch.mains != null && patch.mains !== mains) {
				mains = patch.mains;
				// The hum's fundamental is baked into its oscillators — re-voice.
				hum?.dispose();
				hum = null;
				lastHum = -1;
			}
			if (patch.sound !== undefined) {
				volume = patch.sound === true ? 0.5 : clamp01(Number(patch.sound) || 0);
				snd?.setVolume(volume);
				if (volume <= 0) {
					hum?.setLevel(0);
				} else {
					hum?.setVolume(volume);
					lastHum = -1;
				}
			}
			if (patch.lineOn !== undefined && JSON.stringify(patch.lineOn) !== JSON.stringify(lineOn)) {
				// Flipping a line's circuit ON strikes it in; OFF just cuts the discharge.
				const was = new Uint8Array(n);
				for (let i = 0; i < n; i++) was[i] = targetOf(i);
				lineOn = patch.lineOn;
				if (!reduced && strikeMs > 0) {
					for (let i = 0; i < n; i++)
						if (!was[i] && targetOf(i) === 1) {
							lit[i] = 0;
							strikeT[i] = 0;
							wait[i] = jit[i] * 0.12;
						}
				}
			}
			if (patch.label !== undefined) {
				label = patch.label;
				applyAria();
			}
			if (patch.on != null && patch.on !== on) this.power(patch.on);
			if (patch.pixelRatio != null) {
				pixelRatio = patch.pixelRatio;
				resize();
				redraw = false;
			}
			if (redraw) draw();
			pushHum();
			syncAll();
			animate();
		},
		resize,
		snapshot() {
			draw();
			return canvas.toDataURL('image/png');
		},
		dispose() {
			stopTheme();
			ro?.disconnect();
			if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis);
			if (raf) cancelAnimationFrame(raf);
			if (dipTimer) clearTimeout(dipTimer);
			if (tiredTimer) clearTimeout(tiredTimer);
			if (camTimer) clearTimeout(camTimer);
			snd?.dispose();
			hum?.dispose();
			// Hand the consumer's canvas back without our ARIA (it may be reused).
			canvas.removeAttribute('role');
			canvas.removeAttribute('aria-label');
			canvas.removeAttribute('aria-hidden');
		}
	};
}
