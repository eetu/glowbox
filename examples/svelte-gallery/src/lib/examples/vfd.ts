// Attract-mode content for the /vfd page — everything here is *client* code driving the
// panel through its public API (set/light/bars/dots/selfTest), the way a consuming app
// would. The library ships no programmes; this file IS the mini-system: one faceplate laid
// out once as fixed hardware, then a show that cycles its sources the way a shop-floor
// demo unit did — the tuner sweeping its presets, a CD counting tracks with the analyser
// dancing, and a tape deck with DOLBY NR lit.
//
// Two pieces of glass, stacked the way a real component system stacked them and sharing one
// set of envelope options: the FACEPLATE (segment field, word annunciators, tuning dial, the
// transport mechanisms, and a dot ticker that crawls by column), and an ANALYSER strip under
// it. Splitting the analyser out is what gave the transport room to be legible.
//
// The strip is ONE window doing three jobs, switched by source, which is what the DISPLAY
// button on these units did: spectrum with peak caps, a graphic EQ over the top of it, and —
// on the GIF source — a frame animation on a 4:3 dot area in the middle of the same field.
// Between them the two panels cover every kind of animation these units did:
//   • a pattern crawling over a fixed set of anodes — the reel dashes and the tape, which is
//     how Technics drew a turning reel (not a rotating shape: a ring of separate dashes with
//     the lit run moving around it),
//   • a line stepping round a disc drawn in perspective, to say it is spinning,
//   • and a real frame animation, dot by dot, on the graphic area.
import { decodeGif, frameAt, type GifFrame, sampleImageToGrid } from '@glowbox/extras';
import {
	glyph5x7,
	type VfdElement,
	type VfdGlyphs,
	type VfdPanel,
	type VfdPanelOptions,
	wordRuns
} from '@glowbox/vfd';

import loopUrl from './loop.gif?url';

/** Which source the face is showing. 'auto' runs the full attract cycle. */
export type StereoSource = 'auto' | StereoScene;
/** What the chassis is actually doing — 'auto' resolves to one of these. `gif` is the DISPLAY
 *  button: the analyser strip stops being an analyser and plays an animation instead. `type`
 *  is not a source at all — it is the bench mode, showing whatever you type so the glyph
 *  repertoires can be read by eye. It is reachable only by pinning, never from the cycle. */
export type StereoScene = 'tuner' | 'cd' | 'tape' | 'gif' | 'type';

/** The faceplate's design frame — every element box below is in these units. Roughly a real
 *  faceplate's 3:1, which it can afford because the analyser moved to its own strip: the
 *  freed right-hand half is what gives the transport mechanisms room to be legible. */
export const STEREO_FRAME: [number, number] = [320, 110];

/** The analyser panel below the faceplate. The spectrum uses the whole field and the EQ curve
 *  is layered OVER its top — one window doing two jobs, which is how these were actually laid
 *  out: bars from the floor, the curve riding above them, and the preset name off to the side.
 *  Its own envelope, because it is its own piece of glass on a real stack, and giving it one is
 *  what let the transport spread out upstairs. */
export const ANALYSER_FRAME: [number, number] = [320, 104];
/** The spectrum's field. Twenty bars is what a full-width analyser carried. */
export const SPEC = { bands: 20, rows: 12 } as const;
/** The EQ curve's own grid, laid over the spectrum's upper third. Finer columns than the
 *  spectrum has bars, so the curve reads as a curve rather than a staircase. */
export const EQ = { cols: 60, rows: 7 } as const;

/** The ticker's dot grid. 120 columns shows ~20 characters at a size that sits UNDER the
 *  main field rather than shouting over it — a coarser grid makes the ticker's text bigger
 *  than the display's, which is backwards. Every dot is an anode, so this is also where the
 *  anode budget goes: 120 × 7 is 840 of them. */
export const TICKER = { cols: 120, rows: 7 } as const;

/** The graphic area's dot grid, in the middle of the analyser's own field. 4:3 and no wider,
 *  because the source is a 4:3 animation: a full-width grid would spend two thirds of its
 *  anodes on the dark bands either side of the picture, so the picture gets FEWER rows for the
 *  same budget. 32 × 24 is 768 anodes. */
export const GRAPHIC = { cols: 32, rows: 24 } as const;
/** …and where it sits: centred in the strip, using its full height. The pitch is square
 *  (123/32 ≈ 92/24), because these are dots in a picture and a stretched one reads as a fault. */
const GRAPHIC_BOX = { x: 98, y: 6, w: 123, h: 92 } as const;

// --- transport icons, as plain SVG fill data ---------------------------------------
// A VFD anode is a screen-printed patch, so these are just filled shapes — no centreline
// authoring, and the holes punch correctly because the inner subpaths wind the other way.
const PLAY = 'M0 0 L10 5.5 L0 11 Z';
const PAUSE = 'M0 0 H3.6 V11 H0 Z M6.4 0 H10 V11 H6.4 Z';

// --- the transport band, on the faceplate itself --------------------------------------
// Modelled on the real Technics tape display: a reel is not a rotating shape, it is a RING
// OF SEPARATE DASH ANODES, and rotation is a lit pattern crawling around it. The tape is a
// dashed run between them, travelling the way the tape is being spooled — one fixed set of
// anodes with a moving pattern over it, which is what the driver chip was doing.
//
/** Dashes around one reel ring. */
export const REEL_DASHES = 16;
/** Dashes along the tape path, and angular positions of the line across the disc. */
export const TAPE_DASHES = 18;
export const DISC_SPOKES = 12;
const REEL_R = 13;
/** One line weight for the whole mechanism: the tape and the reel dashes are the same
 *  ribbon, so they read as one piece of tape being spooled rather than two unrelated
 *  graphics that happen to sit near each other. */
const TAPE_W = 2.6;
// The transport lives in the faceplate's right-hand half: the tape deck on top, the disc
// below it. Stacked rather than overlaid, even though the two are never powered at once —
// the REC block needs its own red window between the reels, and a window tints whatever sits
// behind it, so an overlay would lay an amber strip across the disc's hub.
const REELS = [
	{ name: 'l', cx: 222, cy: 32 },
	{ name: 'r', cx: 286, cy: 32 }
] as const;
const DISC = { cx: 253, cy: 63, rx: 52, ry: 14 };
/** Where the RECORD block sits, and the window in the glass that lets it be red at all. */
const REC_BOX = { x: 244, y: 26, w: 20, h: 12 } as const;
/** The faceplate's extra glass: the amber strip that makes the RED record block readable
 *  under a green panel filter. Exactly the block's own box — a zone claims an anode by its
 *  CENTRE, and the block is one anode, so widening it would only show plastic around it. */
export const STEREO_ZONES: NonNullable<VfdPanelOptions['zones']> = [
	{ ...REC_BOX, filter: 'amber' }
];

const pt = (x: number, y: number) => `${x.toFixed(2)} ${y.toFixed(2)}`;

/** The tape's own path: a straight run from one reel to the other, along the line tangent to
 *  the bottom of both. Its ends land exactly on each ring's lowest point, so the tape MEETS
 *  the reels instead of floating between them as a stray row of dots — and being straight, it
 *  has nowhere to kink. */
const TAPE_PATH: [number, number][] = [
	[REELS[0].cx, REELS[0].cy + REEL_R],
	[REELS[1].cx, REELS[1].cy + REEL_R]
];

/** Walk a polyline and return the point and unit tangent at arc length `s`. */
function alongPath(
	points: [number, number][],
	s: number
): { x: number; y: number; tx: number; ty: number } {
	let left = s;
	for (let i = 0; i < points.length - 1; i++) {
		const [x0, y0] = points[i];
		const [x1, y1] = points[i + 1];
		const len = Math.hypot(x1 - x0, y1 - y0) || 1e-6;
		if (left <= len || i === points.length - 2) {
			const t = Math.max(0, Math.min(1, left / len));
			return {
				x: x0 + (x1 - x0) * t,
				y: y0 + (y1 - y0) * t,
				tx: (x1 - x0) / len,
				ty: (y1 - y0) / len
			};
		}
		left -= len;
	}
	const [x, y] = points[0];
	return { x, y, tx: 1, ty: 0 };
}

function pathLength(points: [number, number][]): number {
	let sum = 0;
	for (let i = 0; i < points.length - 1; i++)
		sum += Math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]);
	return sum;
}

/** One dash of a dashed polyline: a ribbon between two arc lengths, sampled so a dash that
 *  spans a corner bends with it instead of cutting across. */
function pathDash(
	points: [number, number][],
	s0: number,
	s1: number,
	width: number,
	steps = 3
): string {
	const half = width / 2;
	const near: string[] = [];
	const far: string[] = [];
	for (let i = 0; i <= steps; i++) {
		const p = alongPath(points, s0 + ((s1 - s0) * i) / steps);
		near.push(pt(p.x - p.ty * half, p.y + p.tx * half));
		far.unshift(pt(p.x + p.ty * half, p.y - p.tx * half));
	}
	return `M${[...near, ...far].join(' L')} Z`;
}

/** A filled arc wedge between two radii and two angles — one dash of a reel ring. Sampled
 *  as a polygon rather than written with `A` commands: fewer ways to get an arc flag wrong,
 *  and the parser flattens curves anyway. */
function arcDash(
	cx: number,
	cy: number,
	rIn: number,
	rOut: number,
	a0: number,
	a1: number,
	steps = 4
): string {
	const pts: string[] = [];
	for (let i = 0; i <= steps; i++) {
		const a = a0 + ((a1 - a0) * i) / steps;
		pts.push(pt(cx + Math.cos(a) * rOut, cy + Math.sin(a) * rOut));
	}
	for (let i = steps; i >= 0; i--) {
		const a = a0 + ((a1 - a0) * i) / steps;
		pts.push(pt(cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn));
	}
	return `M${pts.join(' L')} Z`;
}

/** A solid block with text knocked OUT of it — inverse video, the way the REC indicator was
 *  made. The block is wound one way and every letter rectangle the other, so a nonzero fill
 *  punches the letters straight through: it stays ONE anode on one wire, and the letters are
 *  holes in the phosphor rather than phosphor themselves. Authored in the element's own box
 *  coordinates, since it needs no shared registration with anything. */
function knockout(text: string, w: number, h: number, pad = 1.6): string {
	const { rects, width, height } = wordRuns(text);
	const k = Math.min((w - pad * 2) / Math.max(1, width), (h - pad * 2) / height);
	const ox = (w - width * k) / 2;
	const oy = (h - height * k) / 2;
	// The block, clockwise.
	const parts = [`M${pt(0, 0)} L${pt(w, 0)} L${pt(w, h)} L${pt(0, h)} Z`];
	for (const r of rects) {
		const x = ox + r.x * k;
		const y = oy + r.y * k;
		const rw = r.w * k;
		const rh = r.h * k;
		// …and each letter counter-clockwise, which is what makes it a hole.
		parts.push(`M${pt(x, y)} L${pt(x, y + rh)} L${pt(x + rw, y + rh)} L${pt(x + rw, y)} Z`);
	}
	return parts.join(' ');
}

/** A ring with a hole: outer loop one way, inner loop the other, so the hole punches. */
function ring(cx: number, cy: number, rIn: number, rOut: number): string {
	return (
		`M${pt(cx + rOut, cy)} A ${rOut} ${rOut} 0 1 1 ${pt(cx - rOut, cy)} ` +
		`A ${rOut} ${rOut} 0 1 1 ${pt(cx + rOut, cy)} Z ` +
		`M${pt(cx + rIn, cy)} A ${rIn} ${rIn} 0 1 0 ${pt(cx - rIn, cy)} ` +
		`A ${rIn} ${rIn} 0 1 0 ${pt(cx + rIn, cy)} Z`
	);
}

/** The disc, seen in perspective — an ellipse, not a circle, because that is how these
 *  displays drew a CD: lying flat in the machine and viewed from the front. */
function ellipseRing(cx: number, cy: number, rx: number, ry: number, t: number): string {
	const out = (k: number) =>
		`M${pt(cx + rx * k, cy)} A ${rx * k} ${ry * k} 0 1 1 ${pt(cx - rx * k, cy)} ` +
		`A ${rx * k} ${ry * k} 0 1 1 ${pt(cx + rx * k, cy)} Z`;
	const hole = (k: number) =>
		`M${pt(cx + rx * k, cy)} A ${rx * k} ${ry * k} 0 1 0 ${pt(cx - rx * k, cy)} ` +
		`A ${rx * k} ${ry * k} 0 1 0 ${pt(cx + rx * k, cy)} Z`;
	return `${out(1)} ${hole(1 - t)}`;
}

/** The panel's hardware. A layout change re-compiles the envelope, so this is deliberately
 *  near-static and everything else moves through set/light/bars/dots — the one parameter
 *  is the main field's repertoire, so the page can show all four off. Drive state survives
 *  a re-compile because it is carried by element NAME. */
export function stereoLayout(main: VfdGlyphs = '14seg'): VfdElement[] {
	// Every transport anode is placed in the faceplate's OWN frame — one shared design
	// space — so the reel dashes, their hubs and the tape all stay in register instead of
	// each being scaled to fit its own bounding box. An icon with a `frame` needs no box at
	// all: its path coordinates ARE frame coordinates.
	const transport: VfdElement[] = [];

	for (const reel of REELS) {
		// The hub: a solid ring, lit whenever a tape is loaded. Left chunkier than the
		// dashes, the way the real graphic drew it.
		transport.push({
			kind: 'icon',
			name: `hub${reel.name}`,
			d: ring(reel.cx, reel.cy, 3.6, 7),
			frame: STEREO_FRAME
		});
		// …and the ring of dashes around it, each its own anode, at the tape's own weight.
		for (let i = 0; i < REEL_DASHES; i++) {
			const a0 = (i / REEL_DASHES) * Math.PI * 2;
			const a1 = a0 + ((Math.PI * 2) / REEL_DASHES) * 0.62; // 62% duty — a dash, not a ring
			transport.push({
				kind: 'icon',
				name: `reel${reel.name}${i}`,
				d: arcDash(reel.cx, reel.cy, REEL_R - TAPE_W, REEL_R, a0, a1),
				frame: STEREO_FRAME
			});
		}
	}

	// The tape: dashes along the straight tangent run, lighting in a train that travels from
	// the left reel to the right one.
	const tapeLen = pathLength(TAPE_PATH);
	for (let i = 0; i < TAPE_DASHES; i++) {
		transport.push({
			kind: 'icon',
			name: `tape${i}`,
			d: pathDash(
				TAPE_PATH,
				((i + 0.2) / TAPE_DASHES) * tapeLen,
				((i + 0.8) / TAPE_DASHES) * tapeLen,
				TAPE_W
			),
			frame: STEREO_FRAME
		});
	}

	// RECORD, between the reels where the real deck put it: a lit block with the letters
	// knocked out of it, and RED. Red needs its own window in the glass — a green filter
	// physically blocks red, so multiplying a red anode by it gives mud — which is why the
	// panel lays an amber strip over this rectangle (STEREO_ZONES), the way the real decks did.
	// It keeps a box, unlike its neighbours, because `knockout` authors from the origin.
	transport.push({
		kind: 'icon',
		// NOT 'rec': the source row already has a legend by that name, and duplicate names throw.
		name: 'recBlock',
		// Inset from the reels rather than filling the gap edge to edge, and with room inside for
		// the letters — a block that touches the rings reads as part of the mechanism.
		d: knockout('REC', REC_BOX.w, REC_BOX.h, 1.9),
		...REC_BOX,
		color: '#ff6a28'
	});

	// The disc, in perspective, and the line across its surface at every angle it can take.
	transport.push({
		kind: 'icon',
		name: 'discRim',
		d: ellipseRing(DISC.cx, DISC.cy, DISC.rx, DISC.ry, 0.1),
		frame: STEREO_FRAME
	});
	transport.push({
		kind: 'icon',
		name: 'discHub',
		d: ellipseRing(DISC.cx, DISC.cy, DISC.rx * 0.2, DISC.ry * 0.2, 0.65),
		frame: STEREO_FRAME
	});
	for (let i = 0; i < DISC_SPOKES; i++) {
		const a = (i / DISC_SPOKES) * Math.PI * 2;
		const ca = Math.cos(a);
		const sa = Math.sin(a);
		// The radius runs along (rx·cos, ry·sin) in screen space, so the offset that gives the
		// line an even width is the NORMALISED perpendicular of that — not the raw one, which
		// would leave the line thin when horizontal and fat when vertical.
		const dx = DISC.rx * ca;
		const dy = DISC.ry * sa;
		const len = Math.hypot(dx, dy) || 1;
		const px = (-dy / len) * (TAPE_W / 2);
		const py = (dx / len) * (TAPE_W / 2);
		const at = (k: number, ox: number, oy: number) =>
			pt(DISC.cx + DISC.rx * ca * k + ox, DISC.cy + DISC.ry * sa * k + oy);
		transport.push({
			kind: 'icon',
			name: `discSpoke${i}`,
			d: `M${at(0.24, px, py)} L${at(0.93, px, py)} L${at(0.93, -px, -py)} L${at(0.24, -px, -py)} Z`,
			frame: STEREO_FRAME
		});
	}

	return [
		// --- silkscreen furniture: the ink that groups the face into zones -------------
		{ kind: 'rule', name: 'split', shape: 'line', x: 185, y: 4, w: 1.2, h: 74 },
		{ kind: 'rule', name: 'strip', shape: 'box', x: 4, y: 82, w: 312, h: 25, weight: 0.6 },

		// --- annunciator row ------------------------------------------------------------
		{ kind: 'icon', name: 'play', d: PLAY, x: 6, y: 4, w: 8, h: 9 },
		{ kind: 'icon', name: 'pause', d: PAUSE, x: 17, y: 4, w: 7, h: 9 },
		{ kind: 'legend', name: 'st', text: 'ST', x: 28, y: 4, w: 11, h: 8 },
		{ kind: 'legend', name: 'mono', text: 'MONO', x: 43, y: 4, w: 22, h: 8 },
		{ kind: 'legend', name: 'dolby', text: 'DOLBY NR', x: 69, y: 4, w: 43, h: 8 },
		{ kind: 'legend', name: 'memo', text: 'MEMO', x: 116, y: 4, w: 24, h: 8 },
		{ kind: 'legend', name: 'rand', text: 'RANDOM', x: 144, y: 4, w: 34, h: 8 },

		// --- the main character field ---------------------------------------------------
		{ kind: 'digits', name: 'main', chars: 8, glyphs: main, x: 6, y: 16, w: 148, h: 30 },
		{ kind: 'legend', name: 'mhz', text: 'MHz', x: 158, y: 19, w: 20, h: 8 },
		{ kind: 'legend', name: 'khz', text: 'kHz', x: 158, y: 31, w: 20, h: 8 },

		// --- source row -----------------------------------------------------------------
		{ kind: 'legend', name: 'tuner', text: 'TUNER', x: 6, y: 50, w: 28, h: 8 },
		{ kind: 'legend', name: 'cd', text: 'CD', x: 38, y: 50, w: 12, h: 8 },
		{ kind: 'legend', name: 'tape', text: 'TAPE', x: 54, y: 50, w: 22, h: 8 },
		{ kind: 'legend', name: 'aux', text: 'AUX', x: 80, y: 50, w: 17, h: 8 },
		{ kind: 'legend', name: 'rec', text: 'REC', x: 103, y: 50, w: 17, h: 8 },

		// --- the tuning dial ------------------------------------------------------------
		{
			kind: 'scale',
			name: 'tune',
			steps: 30,
			ticks: 11,
			labels: [
				{ at: 0, text: '88' },
				{ at: 0.5, text: '98' },
				{ at: 1, text: '108' }
			],
			x: 6,
			y: 62,
			w: 172,
			h: 16
		},

		// --- the right half: the disc counter, then the transport ---------------------------
		// TRACK and REMAIN are wired, not printed: they are annunciators, there to say what the
		// number beside them MEANS, so printing them would label a blank counter on the tuner and
		// claim a count-down that isn't happening. The dial's ticks and its 88/98/108 are the
		// opposite case and stay ink — a scale never changes, so the cursor is the only anode.
		{ kind: 'legend', name: 'trklab', text: 'TRACK', x: 192, y: 6, w: 26, h: 7 },
		{ kind: 'digits', name: 'trk', chars: 2, glyphs: '7seg', x: 220, y: 3, w: 24, h: 16 },
		{ kind: 'legend', name: 'remain', text: 'REMAIN', x: 250, y: 6, w: 30, h: 7 },
		// No printed TAPE/DISC labels: the source row already names what is playing, and a
		// second set of words only crowds the glass.
		...transport,

		// --- the dot-matrix ticker --------------------------------------------------------
		// A `dots` area, not a matrix `digits` field: individually addressable dots are what
		// let the message crawl by COLUMN. A character-addressed field can only step a whole
		// cell at a time, and with phosphor persistence that reads as two glyphs on top of
		// each other rather than as scrolling.
		{
			kind: 'dots',
			name: 'ticker',
			cols: TICKER.cols,
			rows: TICKER.rows,
			x: 8,
			y: 86,
			w: 304,
			h: 17.7 // 7 rows at the 304/120 column pitch — square dots
		}
	];
}

/** The EQ presets, as gain in dB at ten notional bands from 63 Hz up to 16 kHz. Real units
 *  shipped a handful of these behind one button, and drew the resulting curve on the glass. */
const EQ_PRESETS = [
	{ name: 'flat', curve: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
	{ name: 'rock', curve: [7, 5, 2, -1, -2, 0, 3, 5, 6, 5] },
	{ name: 'jazz', curve: [4, 3, 1, 2, -1, -1, 1, 3, 4, 4] },
	{ name: 'pop', curve: [-2, -1, 2, 4, 5, 4, 1, -1, -1, 0] },
	{ name: 'vocal', curve: [-4, -3, 0, 3, 6, 6, 3, 1, -1, -2] }
] as const;

/** The analyser panel: the spectrum across the whole field, the EQ curve laid over its top,
 *  and the active preset named on the right. The two overlap on purpose — they are one window
 *  on the real thing, and what tells them apart is shape: the bars are stacks climbing from
 *  the floor, the EQ is a single marker per column floating above them. */
export function analyserLayout(): VfdElement[] {
	return [
		{ kind: 'rule', name: 'edge', shape: 'box', x: 2, y: 2, w: 316, h: 100, weight: 0.6 },

		// The active preset, named top-left above the field — it tucks in there without stealing
		// width from anything. Five legends in one box, exactly one of them ever lit.
		{ kind: 'legend', name: 'eqlab', text: 'EQ', printed: true, x: 8, y: 7, w: 11, h: 6 },
		{ kind: 'legend', name: 'eqflat', text: 'FLAT', x: 24, y: 5, w: 50, h: 11 },
		{ kind: 'legend', name: 'eqrock', text: 'ROCK', x: 24, y: 5, w: 50, h: 11 },
		{ kind: 'legend', name: 'eqjazz', text: 'JAZZ', x: 24, y: 5, w: 50, h: 11 },
		{ kind: 'legend', name: 'eqpop', text: 'POP', x: 24, y: 5, w: 50, h: 11 },
		{ kind: 'legend', name: 'eqvocal', text: 'VOCAL', x: 24, y: 5, w: 50, h: 11 },

		// The spectrum: the whole width, with its printed frequency scale along the bottom.
		{
			kind: 'bars',
			name: 'spec',
			bands: SPEC.bands,
			rows: SPEC.rows,
			peakHold: true,
			scale: ['31.5', '160', '1k', '6.3k', '16k'],
			x: 8,
			y: 22,
			w: 304,
			h: 76
		},

		// The EQ curve, over the spectrum's upper third. Same box origin and width, so the two
		// genuinely share the window — this element simply occupies the rows the bars rarely
		// reach, and the curve floats above them.
		{
			kind: 'dots',
			name: 'eq',
			cols: EQ.cols,
			rows: EQ.rows,
			x: 8,
			y: 22,
			w: 304,
			h: 35 // 7 rows at the 304/60 column pitch — square dots
		},

		// The third job for the same window: a 4:3 graphic area for the animation, centred and
		// using the strip's full height. It is not a fourth piece of glass because it never runs
		// at the same time as the analyser — the DISPLAY button chose one or the other, and a
		// dot area sitting idle behind the bars is exactly what the real thing looked like.
		{ kind: 'dots', name: 'graphic', cols: GRAPHIC.cols, rows: GRAPHIC.rows, ...GRAPHIC_BOX }
	];
}

/** How long each scene runs in the attract cycle, seconds. Unhurried on purpose — the panel's
 *  own timing (a cap falling, a tail fading) needs room to be noticed. */
const SCENES: { scene: StereoScene; secs: number }[] = [
	{ scene: 'tuner', secs: 12 },
	{ scene: 'cd', secs: 13 },
	{ scene: 'tape', secs: 17 },
	{ scene: 'gif', secs: 11 }
];
const CYCLE = SCENES.reduce((n, s) => n + s.secs, 0);

/** One clock for the whole chassis. Both panels ask it what scene it is and how far in, so
 *  they can never disagree — and they would, given the chance: two shows each timing from
 *  their own first animation frame drift apart, and the analyser ends up playing the animation
 *  while the faceplate insists it is on the tuner. `source` is read every frame, so the page's
 *  control can pin a scene without restarting anything. */
export function createSceneClock(source: () => StereoSource) {
	let t0 = 0;
	// When the pin last changed. A pinned scene runs from its own zero rather than from the page
	// clock — otherwise picking Tape drops you into whichever of its modes absolute time happens
	// to be in, and you might never see it start playing.
	let pinnedAt = 0;
	let lastPin: StereoSource = 'auto';
	return (now: number): { scene: StereoScene; local: number; t: number } => {
		if (!t0) t0 = now;
		const t = (now - t0) / 1000;
		const pinned = source();
		if (pinned !== lastPin) {
			lastPin = pinned;
			pinnedAt = t;
		}
		if (pinned !== 'auto') return { scene: pinned, local: t - pinnedAt, t };
		let cyc = t % CYCLE;
		for (const s of SCENES) {
			if (cyc < s.secs) return { scene: s.scene, local: cyc, t };
			cyc -= s.secs;
		}
		return { scene: 'tuner', local: 0, t };
	};
}
export type SceneClock = ReturnType<typeof createSceneClock>;

/** Drive the analyser strip. It is one window with three jobs and the scene picks which: the
 *  spectrum from the synthetic feed with the EQ curve morphing over the top of it, or — on the
 *  GIF source — a frame animation on the graphic area, with the analyser itself blanked. That
 *  swap is the DISPLAY button, and it is why they share a field rather than each having one. */
export function createAnalyserShow(panel: VfdPanel, clock: SceneClock): { stop(): void } {
	const levels = new Array<number>(SPEC.bands).fill(0);
	const bitmap = new Float32Array(EQ.cols * EQ.rows);
	const shown = new Map<string, boolean>();
	const light = (name: string, on: boolean) => {
		if (shown.get(name) === on) return;
		shown.set(name, on);
		panel.light(name, on);
	};
	const HOLD = 4.5; // seconds a preset is held before sliding to the next
	let raf = 0;

	// The animation, decoded once and held. `graphicMode` remembers which job the window was
	// doing last frame, so each swap blanks the other half exactly once instead of pushing a
	// field of zeros sixty times a second at whichever half is off.
	const graphic = new Float32Array(GRAPHIC.cols * GRAPHIC.rows);
	let frames: GifFrame[] | null = null;
	let gifStart = 0;
	let gifFrame = -1;
	let graphicMode: boolean | null = null;
	void decodeGif(loopUrl).then((f) => {
		frames = f;
	});

	const tick = (now: number) => {
		raf = requestAnimationFrame(tick);
		const { scene, t } = clock(now);

		// --- the DISPLAY button: analyser, or animation ---------------------------------
		const asGraphic = scene === 'gif';
		if (asGraphic !== graphicMode) {
			graphicMode = asGraphic;
			if (asGraphic) {
				// Stop driving the analyser rather than writing it zeros: `spec` holds peak caps, and
				// a cap resting on the floor row would keep one lit line across the field. The
				// phosphor tails still fade, which is the swap worth watching.
				panel.clear('spec');
				panel.clear('eq');
				for (const p of EQ_PRESETS) light(`eq${p.name}`, false);
			} else {
				panel.clear('graphic');
			}
			// Restart the loop on entry so a pinned GIF source always begins at frame zero.
			gifStart = 0;
			gifFrame = -1;
		}
		if (asGraphic) {
			if (!frames?.length) return;
			if (!gifStart) gifStart = now;
			const idx = frameAt(frames, now - gifStart);
			if (idx === gifFrame) return; // only re-drive when the GIF actually advances
			gifFrame = idx;
			drawGifFrame(frames[idx], graphic);
			panel.setDots('graphic', graphic);
			return;
		}

		spectrum(t, 0.95, levels);
		panel.setBars('spec', levels);

		// Slide between presets rather than cutting, so the curve travels — the phosphor tail
		// then draws the movement, which a hard cut would not.
		const at = t / HOLD;
		const from = EQ_PRESETS[Math.floor(at) % EQ_PRESETS.length];
		const to = EQ_PRESETS[(Math.floor(at) + 1) % EQ_PRESETS.length];
		// Ease over the last fifth of the hold; flat for the rest, so it is readable.
		const raw = at % 1;
		const blend = raw < 0.8 ? 0 : (raw - 0.8) / 0.2;
		const eased = blend * blend * (3 - 2 * blend);
		for (const p of EQ_PRESETS) light(`eq${p.name}`, p === (eased < 0.5 ? from : to));

		const mid = (EQ.rows - 1) / 2;
		bitmap.fill(0);
		for (let x = 0; x < EQ.cols; x++) {
			// Where this column sits across the ten bands, interpolated so the curve is smooth
			// rather than stepped — the columns are finer than the bands on purpose.
			const f = (x / (EQ.cols - 1)) * (EQ_PRESETS[0].curve.length - 1);
			const i = Math.min(EQ_PRESETS[0].curve.length - 2, Math.floor(f));
			const u = f - i;
			const gainAt = (c: readonly number[]) => c[i] + (c[i + 1] - c[i]) * u;
			const gain = gainAt(from.curve) + (gainAt(to.curve) - gainAt(from.curve)) * eased;
			// ±8 dB maps onto the rows either side of the centre line.
			const row = Math.max(0, Math.min(EQ.rows - 1, mid - (gain / 8) * mid));
			// Just the marker, no stem back to the centre: the curve floats OVER the spectrum
			// here, and a stem would fill in behind the bars and turn the overlay to soup.
			bitmap[Math.round(row) * EQ.cols + x] = 1;
		}
		panel.setDots('eq', bitmap);
	};

	raf = requestAnimationFrame(tick);
	return {
		stop() {
			cancelAnimationFrame(raf);
		}
	};
}

/** One GIF frame into the graphic area's bitmap. */
function drawGifFrame(frame: GifFrame, out: Float32Array): void {
	const s = sampleImageToGrid(frame.src, GRAPHIC.cols, GRAPHIC.rows, 'contain');
	// MIND THE AXIS. `sampleImageToGrid` hands back rows y-UP (its row 0 is the BOTTOM) because
	// it was written for the LED grid, whose y axis runs up. A `dots` area is y-DOWN raster
	// order, like the image it is fed. So the rows get flipped here — otherwise the animation
	// plays upside-down.
	for (let y = 0; y < GRAPHIC.rows; y++) {
		const srcRow = GRAPHIC.rows - 1 - y;
		for (let x = 0; x < GRAPHIC.cols; x++) {
			const si = srcRow * GRAPHIC.cols + x;
			// Luma, weighted the usual way, gated by the sampled coverage.
			const r = s.rgb[si * 3];
			const g = s.rgb[si * 3 + 1];
			const b = s.rgb[si * 3 + 2];
			const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) * (s.alpha[si] ?? 1);
			// Gamma the midtones down: a phosphor dot at half drive still reads as ON, so a
			// straight luma ramp turns any bright frame into one flat glowing block. Pushing the
			// curve gives the animation its shape back.
			out[y * GRAPHIC.cols + x] = Math.pow(Math.max(0, Math.min(1, luma)), 2.2);
		}
	}
}

/** Every switchable annunciator, so a scene can state its whole state and never inherit a
 *  stale lamp from the scene before it. Rotation frames are handled separately. */
const LAMPS = [
	'play',
	'pause',
	'st',
	'mono',
	'dolby',
	'memo',
	'rand',
	'tuner',
	'cd',
	'tape',
	'aux',
	'rec',
	'mhz',
	'khz',
	'trklab',
	'remain'
] as const;

const FM_PRESETS = [
	{ mhz: 88.1, name: 'FM 88.10', stereo: false },
	{ mhz: 92.5, name: 'FM 92.50', stereo: true },
	{ mhz: 98.5, name: 'FM 98.50', stereo: true },
	{ mhz: 104.3, name: 'FM104.30', stereo: true }
];

// What the ticker says, one message per scene.
const STRIP: Record<StereoScene, string> = {
	tuner: 'RADIO TEXT - NOW PLAYING THE LATE SHIFT WITH A GUEST MIX   ',
	cd: 'CD TEXT - THE LONG WAY ROUND - 12 TRACKS - PHOSPHOR DECAY   ',
	tape: 'SIDE A - DOLBY B NR - AUTO REVERSE - COUNTER 0000   ',
	gif: 'GRAPHIC DISPLAY - ONE ANODE PER DOT - GREY BY DUTY CYCLE   ',
	// Replaced by whatever is typed, so the same string can be read on the 5x7 dot grid
	// and in the segment field at once.
	type: ''
};
const CD_TRACKS = 12;

/** Render `text` into a cols×rows bitmap with the 5×7 face, scrolled left by `offset` DOT
 *  COLUMNS. This is the thing the `dots` element exists for: the crawl is continuous
 *  because the grid is addressed by dot, so persistence smears along the direction of
 *  travel — which is what makes a real ticker look like it is moving rather than blinking. */
export function tickerBitmap(
	text: string,
	cols: number,
	rows: number,
	offset: number
): Float32Array {
	const out = new Float32Array(cols * rows);
	const advance = 6; // 5 ink columns + 1 gutter
	const span = Math.max(1, text.length * advance);
	const top = Math.floor((rows - 7) / 2);
	for (let x = 0; x < cols; x++) {
		const sx = (((x + offset) % span) + span) % span;
		const ch = text[Math.floor(sx / advance)] ?? ' ';
		const col = sx % advance;
		if (col === 5) continue; // the gutter between characters
		const bits = glyph5x7(ch);
		for (let r = 0; r < 7; r++) {
			const y = top + r;
			if (y < 0 || y >= rows) continue;
			if ((bits[r] ?? 0) & (1 << (5 - 1 - col))) out[y * cols + x] = 1;
		}
	}
	return out;
}

/** A synthetic analyser feed. The library is display-only, so the "music" is ours: a slow
 *  spectral tilt with a kick every half-bar. The kick matters — a band that SNAPS down is
 *  the only way to see phosphor persistence do its work. */
function spectrum(t: number, energy: number, out: number[]): void {
	const beat = (t * 2) % 1;
	const kick = Math.exp(-beat * 9);
	// Fills whatever it is handed, so the band count lives with the layout rather than here.
	const bands = out.length;
	for (let b = 0; b < bands; b++) {
		const tilt = 1 - (b / bands) * 0.55; // real music is bottom-heavy
		const wobble = 0.5 + 0.5 * Math.sin(t * (1.3 + b * 0.42) + b) * Math.sin(t * 0.31 + b * 0.7);
		const low = b < 4 ? kick * (1 - b / 5) : 0;
		out[b] = Math.max(0, Math.min(1, (wobble * 0.62 + low * 0.85) * tilt * energy));
	}
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Run the attract show on the faceplate. Owns its own rAF loop and returns a stop handle; the
 *  scene comes from the chassis clock, which the analyser strip reads too. */
export function createStereoShow(
	panel: VfdPanel,
	clock: SceneClock,
	/** What the bench mode shows. Read every frame, so typing is live. */
	typed: () => string = () => ''
): { stop(): void } {
	// Only push a value when it changed — the panel animates on every set(), and a character
	// field re-driven 60 times a second would never settle.
	const shown = new Map<string, string | number | boolean>();
	const set = (name: string, value: string | number) => {
		if (shown.get(name) === value) return;
		shown.set(name, value);
		panel.set(name, value);
	};
	const light = (name: string, on: boolean) => {
		if (shown.get(name) === on) return;
		shown.set(name, on);
		panel.light(name, on);
	};
	/** State the whole lamp set: anything not named goes dark. */
	const lamps = (on: Partial<Record<(typeof LAMPS)[number], boolean>>) => {
		for (const name of LAMPS) light(name, on[name] ?? false);
	};

	/** The transport band. Both mechanisms are on the glass; this decides which has power.
	 *
	 *  The reels crawl COUNTERCLOCKWISE, which is worth the derivation because getting it
	 *  backwards makes the tape look like it is being eaten. The dashes sit at increasing
	 *  angle, and in screen coordinates (y down) increasing angle runs clockwise. A wheel
	 *  turning clockwise has its lowest point moving LEFT — surface velocity there is
	 *  (-sin 90°, cos 90°) = (-1, 0). The tape leaves both hubs at their bottoms travelling
	 *  RIGHT, toward the take-up reel, so the hubs must turn the other way: the gap steps
	 *  DOWN in index, not up. */
	// LOADED and MOVING are separate on purpose. A paused deck still has a tape in it: the
	// reels and the tape stay lit and simply stop, which is what pause looks like on the real
	// thing — going dark would say the tape had been ejected. So the crawl runs on an
	// ACCUMULATED phase rather than off the clock, and pausing freezes it exactly where it
	// was instead of snapping back to a canonical frame.
	let phasePrev = 0;
	let reelPhase = 0;
	let spinPhase = 0;
	const transport = (
		t: number,
		o: { tape?: boolean; moving?: boolean; disc?: boolean; spinning?: boolean; recording?: boolean }
	) => {
		const dt = phasePrev ? Math.min(0.1, t - phasePrev) : 0;
		phasePrev = t;
		if (o.moving) reelPhase += dt * 9; // dashes a second
		if (o.spinning) spinPhase += dt * 8; // line positions a second

		const step = Math.floor(reelPhase);
		for (const reel of REELS) {
			light(`hub${reel.name}`, !!o.tape);
			for (let i = 0; i < REEL_DASHES; i++) {
				// Two dark dashes make a gap you can actually see moving; a fully lit ring
				// would just look static.
				const at = (((i + step) % REEL_DASHES) + REEL_DASHES) % REEL_DASHES;
				light(`reel${reel.name}${i}`, !!o.tape && at > 1);
			}
		}
		// The tape: a train of dashes travelling from the left reel to the right one, in step
		// with the reels — the direction the tape is being spooled.
		for (let i = 0; i < TAPE_DASHES; i++) {
			const at = (((i - step) % 4) + 4) % 4;
			light(`tape${i}`, !!o.tape && at < 2);
		}
		// RECORD: between the reels, on its own red window.
		light('recBlock', !!o.recording);
		// The disc: rim and hub lit while one is loaded, and ONE line across the surface at a
		// time, stepping round — that is what reads as the disc spinning.
		light('discRim', !!o.disc);
		light('discHub', !!o.disc);
		const spoke = Math.floor(spinPhase) % DISC_SPOKES;
		for (let i = 0; i < DISC_SPOKES; i++) light(`discSpoke${i}`, !!o.disc && i === spoke);
	};
	let raf = 0;

	const frame = (now: number) => {
		raf = requestAnimationFrame(frame);
		const { scene, local, t } = clock(now);

		// The ticker crawls at a steady ~26 dot columns a second, regardless of scene. In the
		// bench mode it holds still instead: you are reading it, not watching it.
		// Padded to the grid's own width (120 columns / 6 per character) so a short string
		// sits still instead of wrapping round and printing itself twice.
		const strip = scene === 'type' ? typed().padEnd(TICKER.cols / 6, ' ') : STRIP[scene];
		const offset = scene === 'type' ? 0 : Math.floor(t * 26);
		panel.setDots('ticker', tickerBitmap(strip, TICKER.cols, TICKER.rows, offset));

		if (scene === 'tuner') {
			// Step through the presets, pausing on each. The dial cursor tracks the frequency
			// across the printed 88–108 scale.
			const at = Math.floor(local / 3) % FM_PRESETS.length;
			const p = FM_PRESETS[at];
			set('main', p.name);
			set('tune', (p.mhz - 88) / 20);
			set('trk', '');
			lamps({
				tuner: true,
				mhz: true,
				st: p.stereo,
				mono: !p.stereo,
				memo: at === FM_PRESETS.length - 1 // the last preset is a stored one
			});
			transport(t, {}); // neither mechanism has power on the tuner
		} else if (scene === 'cd') {
			// Track number climbing, elapsed time running, the analyser at full tilt. The
			// counter ticks once a second like the real thing — faster and the character field
			// never settles between changes, which just reads as mush.
			const track = 1 + (Math.floor(local / 2.4) % CD_TRACKS);
			// The counter alternates between time ELAPSED and REMAINING, as every player let you
			// do — and REMAIN is the only thing that says which, so the two move together. 1 Hz
			// either way; the direction is the tell.
			const showRemain = Math.floor(local / 6.5) % 2 === 1;
			const into = Math.floor(local) % 240;
			const secs = showRemain ? 240 - into : into;
			// The time only. The track number belongs to the TRACK counter on the right, and
			// putting it in both places just said the same thing twice.
			set('main', `   ${pad2(Math.floor(secs / 60))}.${pad2(secs % 60)}`);
			set('trk', pad2(track));
			set('tune', 0);
			lamps({
				cd: true,
				play: true,
				rand: track % 3 === 0,
				// TRACK labels a counter that only the disc drives; REMAIN, the direction it runs.
				trklab: true,
				remain: showRemain
			});
			transport(t, { disc: true, spinning: true });
		} else if (scene === 'tape') {
			// Tape: all three modes the deck actually had, each held long enough to read —
			// PLAY, then PAUSE, then RECORD. The reels behave identically in play and record,
			// which is the point: what tells you it is recording is REC lighting between them
			// while the mechanism carries on regardless. And pause does not blank the
			// mechanism, it FREEZES it — the tape has not gone anywhere.
			const mode = local < 6 ? 'play' : local < 9 ? 'pause' : 'rec';
			const rolling = mode !== 'pause';
			const recording = mode === 'rec';
			set('main', mode === 'pause' ? 'PAUSE  A' : recording ? 'REC    A' : 'TAPE   A');
			set('trk', '');
			set('tune', 0);
			lamps({
				tape: true,
				dolby: true,
				play: mode === 'play',
				pause: mode === 'pause',
				rec: recording
			});
			transport(t, { tape: true, moving: rolling, recording });
		} else if (scene === 'gif') {
			// GRAPHIC DISPLAY. The faceplate says what the strip below it is doing and otherwise
			// gets out of the way: no source has power, so no transport, no counter, no dial.
			set('main', ' GRAPHIC');
			set('trk', '');
			set('tune', 0);
			lamps({ play: true });
			transport(t, {});
		} else {
			// THE BENCH. Whatever is typed, in the segment field and on the dot ticker at once,
			// with everything else dark so nothing distracts from the letterforms.
			set('main', typed());
			set('trk', '');
			set('tune', 0);
			lamps({});
			transport(t, {});
		}
	};

	raf = requestAnimationFrame(frame);
	return {
		stop() {
			cancelAnimationFrame(raf);
		}
	};
}
