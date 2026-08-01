// The panel layout — pure arithmetic, node-testable by design (the `layout.ts` /
// `drum.ts` pattern from the sibling cores). Nothing here touches a canvas.
//
// THE ONE IDEA IN THIS FILE: every element kind — a starburst character field, a
// screen-printed word, a spectrum grid, an icon, a tuning scale, a dot-matrix area, a
// printed rule — compiles down to the same flat list of ANODES. An anode is a fixed patch
// of phosphor with an integer address, and that is the whole vocabulary the renderer and
// the physics ever see.
//
// It pays for itself immediately. The driver holds ONE Float32Array of per-anode
// brightness, so phosphor persistence, the dimmer, the power-on self-test, per-anode
// wear and the dim-grid-column failure are each a single uniform pass over that array
// instead of a special case per kind. However many element kinds get added, one renderer.
//
// The other half is that anodes are DISCRETE and never move. That sounds like a
// restriction until you notice it's how the hardware worked: a tuning cursor is not a
// sliding block, it's a row of ~24 fixed blocks with one of them driven, so
// `set('tune', 0.42)` lights the nearest. Nothing in a vacuum envelope moves.
import { type Color } from './color';
import {
	CELL,
	CELL_EXTRAS,
	CELL_SLANT,
	cellGeometry,
	MATRIX_DOTS,
	matrixDotLit,
	matrixGeometry,
	segmentBits,
	segmentCount,
	type VfdGlyphs,
	wordRuns
} from './faces';
import { pathToPolys } from './path';
import { type PhosphorName } from './phosphor';

/** How many multiplex grid columns the envelope is scanned in. Real panels drove one
 *  grid per character cell or zone; what matters visually is that a failing grid dims a
 *  VERTICAL BAND of the whole panel, across whatever elements happen to sit in it. */
export const GRID_COLS = 24;

// --- elements -----------------------------------------------------------------------

interface ElementBase {
	/** The handle `set`/`light`/`bars`/`dots` address this element by. Must be unique
	 *  within the panel — a repeat is a broken wiring diagram, and `compilePanel` throws. */
	name: string;
	/** The element's box in panel-frame units (y-down). */
	x: number;
	y: number;
	w: number;
	h: number;
	/** This element's phosphor, if it differs from the panel's (real panels did mix:
	 *  a blue main field with an amber-phosphor annunciator row). */
	phosphor?: PhosphorName;
	/** Flat colour override — wins over `phosphor`'s lit colour, which still shapes the
	 *  hot core and the undriven-anode tint. */
	color?: Color;
	// NB: there is no per-element `filter`. A filter is a piece of plastic laid over a
	// REGION of the glass, not a property of anything behind it, so it belongs to the panel
	// as `zones` — tied to an element's box it also tints whatever is drawn behind that box.
}

/** A run of character cells: the frequency readout, the track counter, the title field. */
export interface VfdDigits extends ElementBase {
	kind: 'digits';
	/** How many cells. Fixed hardware — a value longer than this is truncated. */
	chars: number;
	/** The repertoire (default '14seg'). '7seg' is the numeric classic, '14seg' and
	 *  '16seg' the starbursts that can spell, 'matrix' the 5×7 dot field. */
	glyphs?: VfdGlyphs;
	value?: string;
	/** Which end a short value sits at (default 'left'; 'right' is what a numeric
	 *  readout does). */
	align?: 'left' | 'right';
	/** The classic rightward italic (default: on for the segment modes, off for
	 *  'matrix' — a dot grid can't shear without breaking its own pitch). */
	slant?: boolean;
	/** Gap between cells as a fraction of the cell slot (default 0.16). */
	tracking?: number;
}

/** A screen-printed word: DOLBY NR, ST, MONO, REC, MEMORY. One anode, one wire — the
 *  whole word lights together, because that is physically what it is. */
export interface VfdLegend extends ElementBase {
	kind: 'legend';
	text: string;
	/** Silkscreen: printed on the glass, never wired, never lights. The dB scale
	 *  numbers and the row of source names under the annunciators are these. */
	printed?: boolean;
	on?: boolean;
	align?: 'left' | 'center' | 'right';
}

/** The spectrum analyser / level meter: a grid of blocks, `bands` across by `rows` up. */
export interface VfdBars extends ElementBase {
	kind: 'bars';
	bands: number;
	rows: number;
	/** Hold the highest block reached and let it fall slowly on its own (default
	 *  false). The cap is not extra hardware — it's the top block staying driven while
	 *  the body drops away beneath it. */
	peakHold?: boolean;
	/** Fall rate of the held cap, rows per second (default 4). */
	peakFall?: number;
	/** Ramp the column heights left→right (55% → 100%), the wedge-shaped analyser. */
	wedge?: boolean;
	/** Printed labels along the bottom edge (a dB or frequency scale); they reserve
	 *  the bottom fifth of the box. */
	scale?: string[];
	/** Which way the bars grow (default 'bottom'; 'left' is the horizontal VU row). */
	from?: 'bottom' | 'left';
}

/** Arbitrary artwork: the transport arrows, the cassette, the disc, the speaker.
 *  Straight SVG fill data — a VFD anode is a printed patch, so no centreline
 *  authoring (that was neon's tax) and holes fill correctly. */
export interface VfdIcon extends Omit<ElementBase, 'x' | 'y' | 'w' | 'h'> {
	kind: 'icon';
	d: string | string[];
	on?: boolean;
	/** Treat the path's coordinates as already being PANEL-FRAME coordinates, so several
	 *  icons cut from one drawing keep their registration without each being rescaled to
	 *  fit its own box. Give the frame's `[width, height]`.
	 *
	 *  With `frame` set, the box below is ignored — omit it. Without `frame`, the box is
	 *  required and the path is scaled to fit it. */
	frame?: [number, number];
	x?: number;
	y?: number;
	w?: number;
	h?: number;
}

/** The tuning dial: printed ticks and labels, plus a row of discrete cursor blocks of
 *  which `set(name, 0..1)` drives the nearest. */
export interface VfdScale extends ElementBase {
	kind: 'scale';
	/** Printed tick marks: a count (evenly spaced) or explicit 0..1 positions. */
	ticks?: number | number[];
	/** Printed labels at 0..1 positions along the track. */
	labels?: { at: number; text: string }[];
	/** How many discrete cursor blocks the track carries (default 24). */
	steps?: number;
	value?: number;
}

/** A raw dot-matrix area: `cols` × `rows` individually addressable dots, driven with a
 *  bitmap rather than characters. This is the graphic-capable half of a panel — the strip
 *  that showed an animation, a level histogram, or text scrolled smoothly by dot COLUMN
 *  (which a `digits` field structurally cannot do: it addresses characters, so text can
 *  only step a whole cell at a time). Row 0 is the TOP, in raster order, because what you
 *  feed it is an image. */
export interface VfdDots extends ElementBase {
	kind: 'dots';
	cols: number;
	rows: number;
	/** Gutter between dots as a fraction of the pitch (default 0.14). */
	gap?: number;
	/** Square dots, or round ones (default 'square' — a printed anode has corners). */
	dot?: 'square' | 'round';
}

/** Silkscreen furniture: the hairlines and boxes that group a panel into zones. Always
 *  printed — a rule is ink, not an anode. */
export interface VfdRule extends ElementBase {
	kind: 'rule';
	/** 'line' a hairline, 'box' a four-sided outline, 'fill' a solid block. */
	shape?: 'line' | 'box' | 'fill';
	/** Stroke weight in frame units (default 0.8). */
	weight?: number;
}

export type VfdElement = VfdDigits | VfdLegend | VfdBars | VfdIcon | VfdScale | VfdDots | VfdRule;

// --- the compiled panel --------------------------------------------------------------

/** One anode: a fixed patch of phosphor with an address. */
export interface VfdAnode {
	/** One or more closed polygons, flat `[x0,y0,x1,y1,…]` in frame units. Several
	 *  polygons means one shape with disjoint parts or holes — a legend word, an icon —
	 *  filled as a single patch, because it is a single anode on a single wire. */
	polys: number[][];
	/** Index into the panel's compiled element list. */
	el: number;
	/** Address within the element: character cell, band, or cursor step. */
	cell: number;
	/** Address within the cell: segment, dot, or bar row. */
	sub: number;
	/** Multiplex grid column, from the anode's own centroid. */
	col: number;
	/** Silkscreen — drawn once as ink, never driven. */
	printed: boolean;
	/** The anode's longest side in frame units. The renderer prices its glow off this: a
	 *  gaussian halo around a 3-pixel matrix dot costs the same as one around a whole
	 *  segment and shows nothing, so small anodes skip it. */
	size: number;
}

export interface CompiledElement {
	name: string;
	kind: VfdElement['kind'];
	box: { x: number; y: number; w: number; h: number };
	/** Where this element's anodes actually ended up, as a bounding box in frame units.
	 *  Usually the same as `box` — but an `icon` placed through a shared design `frame` takes
	 *  the whole frame as its box, and hit-testing that would have it swallow every tap on the
	 *  panel. So pointer maths uses this. */
	bounds: { x: number; y: number; w: number; h: number };
	/** This element's slice of the panel's anode list. */
	first: number;
	count: number;
	/** Character cells / bands / cursor steps. */
	cells: number;
	/** Anodes per cell. */
	stride: number;
	glyphs?: VfdGlyphs;
	/** How many of a cell's anodes are glyph segments (the rest are dp/colon extras). */
	segments: number;
	src: VfdElement;
	/** address (`cell`,`sub`) → global anode index, for the driven anodes only. A kind
	 *  may legitimately skip an address (a bar row too short to draw at this size, an
	 *  empty legend), so drive-time lookups go through here rather than assuming the
	 *  slice is a dense grid. */
	index: Map<number, number>;
	/** True when this element's slice really is a full `cells × stride` grid in address
	 *  order, so an address resolves by arithmetic instead of a Map lookup. Character
	 *  fields and dot areas always are; a `bars` element that dropped a too-short row, or
	 *  anything carrying silkscreen, is not. It removes ~840 Map lookups a frame from a
	 *  120 × 7 ticker — though measured at that size it changed nothing, because the glow
	 *  pass dominates by an order of magnitude. Headroom for bigger grids, not a fix. */
	dense: boolean;
}

// Address packing for `CompiledElement.index`. `sub` maxes out at 35 (a 5×7 matrix
// cell), so a 1024 stride is room to spare.
const SUB_STRIDE = 1024;
const addr = (cell: number, sub: number) => cell * SUB_STRIDE + sub;

export interface VfdPanelLayout {
	frame: [number, number];
	elements: CompiledElement[];
	anodes: VfdAnode[];
	byName: Map<string, number>;
	/** Anode count excluding silkscreen — what the self-test lights. */
	driven: number;
}

// NaN-safe on purpose: written as `v > 0 ? …` rather than `v < 0 ? 0 : …`, so a NaN falls
// through to 0 instead of propagating. A NaN that reaches a peak cap sticks there — every
// later comparison against it is false — and the band is dark for good.
const clamp01 = (v: number) => (v > 0 ? (v > 1 ? 1 : v) : 0);

/** Centroid of an anode's polygons, for the grid-column assignment. */
function centroidX(polys: number[][]): number {
	let sum = 0;
	let n = 0;
	for (const p of polys) {
		for (let i = 0; i < p.length; i += 2) {
			sum += p[i];
			n++;
		}
	}
	return n ? sum / n : 0;
}

/** The longest side of an anode's bounding box, in frame units. */
function extent(polys: number[][]): number {
	let lo = Infinity;
	let hi = -Infinity;
	let lov = Infinity;
	let hiv = -Infinity;
	for (const p of polys) {
		for (let i = 0; i < p.length; i += 2) {
			lo = Math.min(lo, p[i]);
			hi = Math.max(hi, p[i]);
			lov = Math.min(lov, p[i + 1]);
			hiv = Math.max(hiv, p[i + 1]);
		}
	}
	return Number.isFinite(lo) ? Math.max(hi - lo, hiv - lov) : 0;
}

function rect(x: number, y: number, w: number, h: number): number[] {
	return [x, y, x + w, y, x + w, y + h, x, y + h];
}

/** A round dot as a sampled polygon, so the renderer keeps exactly one geometry kind. */
function disc(cx: number, cy: number, r: number): number[] {
	const out: number[] = [];
	for (let i = 0; i < 10; i++) {
		const a = (i / 10) * Math.PI * 2;
		out.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
	}
	return out;
}

/** Place a `wordRuns` result into a box, preserving the face's aspect. */
function placeWord(
	text: string,
	box: { x: number; y: number; w: number; h: number },
	align: 'left' | 'center' | 'right'
): number[][] {
	const { rects, width, height } = wordRuns(text);
	if (!rects.length || width <= 0) return [];
	const k = Math.min(box.w / width, box.h / height);
	const ox =
		align === 'left'
			? box.x
			: align === 'right'
				? box.x + box.w - width * k
				: box.x + (box.w - width * k) / 2;
	const oy = box.y + (box.h - height * k) / 2;
	return rects.map((r) => rect(ox + r.x * k, oy + r.y * k, r.w * k, r.h * k));
}

/** Compile a panel declaration into the flat anode inventory. Pure: same input, same
 *  geometry, every time — which is what lets the golden-eyed parts (tests, a 3D
 *  consumer extruding the plates) rely on it. */
export function compilePanel(frame: [number, number], layout: VfdElement[]): VfdPanelLayout {
	// A frame with no area has no geometry to fit into, and letting it through turns the
	// scale into Infinity and every coordinate into NaN — which surfaces as canvas throwing
	// InvalidStateError from inside the render loop, once a frame, where nobody can catch it.
	if (!(frame[0] > 0) || !(frame[1] > 0) || !Number.isFinite(frame[0] * frame[1])) {
		throw new Error(
			`glowbox: the panel frame must be two finite positive numbers, got [${frame[0]}, ${frame[1]}].`
		);
	}
	const fw = frame[0];
	const elements: CompiledElement[] = [];
	const anodes: VfdAnode[] = [];
	const byName = new Map<string, number>();

	const push = (el: number, cell: number, sub: number, printed: boolean, polys: number[][]) => {
		if (!polys.length) return;
		const cx = centroidX(polys);
		const col = Math.max(0, Math.min(GRID_COLS - 1, Math.floor((cx / fw) * GRID_COLS)));
		anodes.push({ polys, el, cell, sub, col, printed, size: extent(polys) });
	};

	for (const src of layout) {
		const ei = elements.length;
		// Names are the wiring, so a bad one is an authoring error and fails loudly. Keeping
		// the first of a duplicate and warning about it left the second silently undriveable,
		// which is a miserable thing to debug.
		if (typeof src.name !== 'string' || !src.name) {
			throw new Error(`glowbox: every panel element needs a name (element ${ei} of the layout).`);
		}
		if (byName.has(src.name)) {
			throw new Error(
				`glowbox: two panel elements are named "${src.name}". Names are how set/light/bars/dots reach an element, so they must be unique.`
			);
		}
		// An icon given a shared design `frame` needs no box: its path coordinates already ARE
		// frame coordinates. Anything else is placed in its box, so the box is required.
		const framed = src.kind === 'icon' && src.frame != null;
		if (!framed && (src.x == null || src.y == null || src.w == null || src.h == null)) {
			throw new Error(
				`glowbox: panel element "${src.name}" needs x/y/w/h (only an icon with a shared \`frame\` may omit them).`
			);
		}
		const box = framed
			? { x: 0, y: 0, w: frame[0], h: frame[1] }
			: { x: src.x!, y: src.y!, w: src.w!, h: src.h! };
		const first = anodes.length;
		let cells = 1;
		let stride = 1;
		let segments = 0;
		let glyphs: VfdGlyphs | undefined;

		switch (src.kind) {
			case 'digits': {
				const mode = src.glyphs ?? '14seg';
				glyphs = mode;
				cells = Math.max(1, Math.floor(src.chars));
				const cellPolys = mode === 'matrix' ? matrixGeometry() : cellGeometry(mode);
				segments = mode === 'matrix' ? MATRIX_DOTS : segmentCount(mode);
				stride = mode === 'matrix' ? MATRIX_DOTS : segments + CELL_EXTRAS;
				const tracking = src.tracking ?? 0.16;
				const slant = (src.slant ?? mode !== 'matrix') ? CELL_SLANT : 0;
				const slot = box.w / cells;
				const inkW = slot * (1 - tracking);
				const k = Math.min(inkW / CELL.width, box.h / CELL.height);
				const oy = box.y + (box.h - CELL.height * k) / 2;
				for (let c = 0; c < cells; c++) {
					const ox = box.x + c * slot + (slot - CELL.width * k) / 2;
					for (let s = 0; s < stride; s++) {
						const p = cellPolys[s];
						const out: number[] = [];
						for (let i = 0; i < p.length; i += 2) {
							// Shear about the cell's vertical centre, then place: the classic
							// italic, applied in cell space so every cell leans alike.
							const sx = p[i] - slant * (p[i + 1] - CELL.height / 2);
							out.push(ox + sx * k, oy + p[i + 1] * k);
						}
						push(ei, c, s, false, [out]);
					}
				}
				break;
			}
			case 'legend': {
				push(ei, 0, 0, src.printed ?? false, placeWord(src.text, box, src.align ?? 'center'));
				break;
			}
			case 'bars': {
				cells = Math.max(1, Math.floor(src.bands));
				stride = Math.max(1, Math.floor(src.rows));
				const horizontal = src.from === 'left';
				// A printed scale reserves the bottom fifth of the box.
				const labelH = src.scale?.length ? box.h * 0.2 : 0;
				const gridH = box.h - labelH;
				const bandPitch = (horizontal ? gridH : box.w) / cells;
				const rowPitch = (horizontal ? box.w : gridH) / stride;
				const gutterB = bandPitch * 0.22;
				const gutterR = rowPitch * 0.24;
				for (let b = 0; b < cells; b++) {
					// The wedge: column height ramps left→right, so the analyser sits in a
					// slope instead of a rectangle.
					const ramp = src.wedge ? 0.55 + 0.45 * (cells > 1 ? b / (cells - 1) : 1) : 1;
					for (let r = 0; r < stride; r++) {
						const along = b * bandPitch;
						const up = r * rowPitch;
						const bw = bandPitch - gutterB;
						const rh = rowPitch * ramp - gutterR;
						if (rh <= 0) continue;
						const poly = horizontal
							? rect(box.x + up, box.y + along, rowPitch - gutterR, bw)
							: // Rows run bottom-up: row 0 is the bottom block.
								rect(box.x + along, box.y + gridH - up - rh, bw, rh);
						push(ei, b, r, false, [poly]);
					}
				}
				for (let i = 0; i < (src.scale?.length ?? 0); i++) {
					const labels = src.scale!;
					const at = labels.length > 1 ? i / (labels.length - 1) : 0.5;
					const lw = box.w / Math.max(3, labels.length);
					const lx = box.x + at * (box.w - lw);
					push(
						ei,
						i,
						0,
						true,
						placeWord(labels[i], { x: lx, y: box.y + gridH, w: lw, h: labelH }, 'center')
					);
				}
				break;
			}
			case 'icon': {
				const raw = pathToPolys(src.d);
				if (!raw.length) break;
				if (framed) {
					// The path is already in frame coordinates: place it as authored. No box, no
					// scaling, no centring — which is the whole point of a shared design frame,
					// and why several pieces of one drawing stay in register.
					push(
						ei,
						0,
						0,
						false,
						raw.map((p) => p.slice())
					);
					break;
				}
				// Otherwise scale the path's own bounding box to fit the element's box.
				let lo = Infinity;
				let hi = -Infinity;
				let lov = Infinity;
				let hiv = -Infinity;
				for (const p of raw) {
					for (let i = 0; i < p.length; i += 2) {
						lo = Math.min(lo, p[i]);
						hi = Math.max(hi, p[i]);
						lov = Math.min(lov, p[i + 1]);
						hiv = Math.max(hiv, p[i + 1]);
					}
				}
				const k = Math.min(box.w / Math.max(1e-6, hi - lo), box.h / Math.max(1e-6, hiv - lov));
				const ox = box.x + (box.w - (hi - lo) * k) / 2;
				const oy = box.y + (box.h - (hiv - lov) * k) / 2;
				push(
					ei,
					0,
					0,
					false,
					raw.map((p) => {
						const out: number[] = [];
						for (let i = 0; i < p.length; i += 2)
							out.push(ox + (p[i] - lo) * k, oy + (p[i + 1] - lov) * k);
						return out;
					})
				);
				break;
			}
			case 'scale': {
				cells = Math.max(2, Math.floor(src.steps ?? 24));
				// Cursor blocks on top, printed ticks under them, labels along the bottom.
				const cursorH = box.h * (src.labels?.length ? 0.4 : 0.55);
				const tickH = box.h * (src.labels?.length ? 0.22 : 0.45);
				const pitch = box.w / cells;
				const bw = pitch * 0.7;
				for (let c = 0; c < cells; c++) {
					push(ei, c, 0, false, [rect(box.x + c * pitch + (pitch - bw) / 2, box.y, bw, cursorH)]);
				}
				let ticks: number[];
				if (typeof src.ticks === 'number') {
					const n = Math.max(2, Math.floor(src.ticks));
					ticks = Array.from({ length: n }, (_, i) => i / (n - 1));
				} else {
					ticks = src.ticks ?? [];
				}
				const tw = Math.max(0.5, box.w * 0.004);
				for (let i = 0; i < ticks.length; i++) {
					// Every other tick is a stub — the major/minor rhythm of a printed dial.
					const major = i % 2 === 0;
					const th = tickH * (major ? 1 : 0.55);
					push(ei, i, 1, true, [
						rect(box.x + clamp01(ticks[i]) * (box.w - tw), box.y + cursorH, tw, th)
					]);
				}
				for (const lab of src.labels ?? []) {
					const lw = box.w * 0.16;
					push(
						ei,
						0,
						2,
						true,
						placeWord(
							lab.text,
							{
								x: box.x + clamp01(lab.at) * (box.w - lw),
								y: box.y + cursorH + tickH,
								w: lw,
								h: box.h - cursorH - tickH
							},
							'center'
						)
					);
				}
				break;
			}
			case 'dots': {
				cells = Math.max(1, Math.floor(src.cols));
				stride = Math.max(1, Math.floor(src.rows));
				const pitchX = box.w / cells;
				const pitchY = box.h / stride;
				const gap = src.gap ?? 0.14;
				const dw = Math.max(1e-3, pitchX * (1 - gap));
				const dh = Math.max(1e-3, pitchY * (1 - gap));
				const round = src.dot === 'round';
				for (let x = 0; x < cells; x++) {
					for (let y = 0; y < stride; y++) {
						// Row 0 at the top: this is fed images, so it runs in raster order.
						const px = box.x + x * pitchX + (pitchX - dw) / 2;
						const py = box.y + y * pitchY + (pitchY - dh) / 2;
						push(ei, x, y, false, [
							round ? disc(px + dw / 2, py + dh / 2, Math.min(dw, dh) / 2) : rect(px, py, dw, dh)
						]);
					}
				}
				break;
			}
			case 'rule': {
				const t = Math.max(0.2, src.weight ?? 0.8);
				const shape = src.shape ?? 'line';
				if (shape === 'fill') push(ei, 0, 0, true, [rect(box.x, box.y, box.w, box.h)]);
				else if (shape === 'box')
					push(ei, 0, 0, true, [
						rect(box.x, box.y, box.w, t),
						rect(box.x, box.y + box.h - t, box.w, t),
						rect(box.x, box.y + t, t, box.h - 2 * t),
						rect(box.x + box.w - t, box.y + t, t, box.h - 2 * t)
					]);
				else if (box.w >= box.h)
					push(ei, 0, 0, true, [rect(box.x, box.y + (box.h - t) / 2, box.w, t)]);
				else push(ei, 0, 0, true, [rect(box.x + (box.w - t) / 2, box.y, t, box.h)]);
				break;
			}
		}

		byName.set(src.name, ei);
		const index = new Map<number, number>();
		for (let i = first; i < anodes.length; i++) {
			const a = anodes[i];
			if (!a.printed) index.set(addr(a.cell, a.sub), i);
		}
		const count = anodes.length - first;
		// The real extent of what got drawn, for pointer maths.
		let bx0 = Infinity;
		let by0 = Infinity;
		let bx1 = -Infinity;
		let by1 = -Infinity;
		for (let i = first; i < anodes.length; i++) {
			for (const poly of anodes[i].polys) {
				for (let j = 0; j < poly.length; j += 2) {
					bx0 = Math.min(bx0, poly[j]);
					bx1 = Math.max(bx1, poly[j]);
					by0 = Math.min(by0, poly[j + 1]);
					by1 = Math.max(by1, poly[j + 1]);
				}
			}
		}
		const bounds = Number.isFinite(bx0)
			? { x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 }
			: { ...box };
		elements.push({
			name: src.name,
			kind: src.kind,
			box,
			bounds,
			first,
			count,
			cells,
			stride,
			segments,
			glyphs,
			src,
			index,
			dense: count === cells * stride && index.size === count
		});
	}

	return {
		frame,
		elements,
		anodes,
		byName,
		driven: anodes.reduce((n, a) => n + (a.printed ? 0 : 1), 0)
	};
}

// --- value → address ----------------------------------------------------------------

/** What one character cell is showing. */
export interface CellContent {
	ch: string;
	dp: boolean;
	colon: boolean;
}

/** Lay a value string onto `chars` fixed cells. When `attach` is set (every segment
 *  mode), '.' and ':' ride the cell BEFORE them instead of consuming one of their own —
 *  what a real driver chip does with its point and colon anodes, and the reason
 *  'FM 98.50' fits eight cells. A dot-matrix cell draws its own '.' as a glyph, so it
 *  passes `attach: false` and the point takes a cell like any other character.
 *  Overlong values are truncated at the hardware's width. */
export function layCells(
	value: string,
	chars: number,
	align: 'left' | 'right',
	attach: boolean
): CellContent[] {
	// Clamp rather than throw: `compilePanel` already clamps a silly `chars`, and this is
	// the same question asked one layer down. Unclamped, `out.length = chars` raises a bare
	// RangeError from deep inside the driver.
	const cells = Number.isFinite(chars) ? Math.max(0, Math.floor(chars)) : 0;
	const out: CellContent[] = [];
	for (const ch of value) {
		if (attach && (ch === '.' || ch === ':') && out.length) {
			const prev = out[out.length - 1];
			// Two points in a row can't share a cell — the second opens its own blank.
			if (ch === '.' ? !prev.dp : !prev.colon) {
				if (ch === '.') prev.dp = true;
				else prev.colon = true;
				continue;
			}
		}
		out.push({ ch, dp: false, colon: false });
	}
	if (out.length > cells) out.length = cells;
	const pad = cells - out.length;
	const blanks = Array.from({ length: pad }, () => ({ ch: ' ', dp: false, colon: false }));
	return align === 'right' ? [...blanks, ...out] : [...out, ...blanks];
}

/** Per-element drive state — what the consumer has asked this element to show. */
export interface ElementState {
	text?: string;
	on?: boolean;
	/** `bars`: 0..1 per band. The driver owns this buffer — see `VfdPanel.bars`, which
	 *  copies what you hand it rather than holding your array. */
	levels?: ArrayLike<number>;
	/** `bars`: the held cap position per band, in rows (fractional; <0 = none). */
	peaks?: number[];
	/** `scale`: cursor position 0..1. */
	pos?: number;
	/** `dots`: brightness 0..1 per dot, row-major from the top-left, or a function of
	 *  (x, y). Fractional values are honest here — a multiplexed anode dims by duty
	 *  cycle — so a greyscale image maps straight on without dithering. */
	bitmap?: ArrayLike<number> | ((x: number, y: number) => number);
}

/** Advance held peak caps by `dt` seconds. Pure, so the fall rate is testable without
 *  a render loop: each cap is pulled up instantly by a louder band and sags on its own.
 *
 *  A cap of -1 is a band with NO cap — never driven, or driven by something that has since
 *  stopped (see `VfdPanel.blank`). A silent band must not conjure one: that would light the
 *  floor row of an element nobody is driving, and leave it lit for good. */
export function fallPeaks(
	peaks: number[],
	levels: ArrayLike<number>,
	rows: number,
	rate: number,
	dt: number
): void {
	// Only ever forwards. A negative dt would ADD to every cap instead of subtracting —
	// four rows became forty-four — and a clock that steps backwards is not this module's
	// problem to have an opinion about.
	const step = rate * (dt > 0 ? dt : 0);
	for (let b = 0; b < peaks.length; b++) {
		const rest = clamp01(levels[b] ?? 0) * rows;
		// A cap that is not a finite number is not a cap: treat it as absent rather than
		// letting it poison every later Math.max.
		const cap = Number.isFinite(peaks[b]) ? peaks[b] : -1;
		if (cap < 0 && rest <= 0) {
			peaks[b] = -1;
			continue;
		}
		peaks[b] = Math.max(cap - step, rest);
	}
}

/** Resolve an address to a global anode index, or -1. Dense slices skip the Map. */
function slotOf(el: CompiledElement, cell: number, sub: number): number {
	if (el.dense) {
		if (cell < 0 || cell >= el.cells || sub < 0 || sub >= el.stride) return -1;
		return el.first + cell * el.stride + sub;
	}
	return el.index.get(addr(cell, sub)) ?? -1;
}

// Elements whose bitmap function has already thrown — warn once, not sixty times a second.
const warnedDots = new Set<string>();

/** Write an element's drive targets (0 or 1) into `out` at the element's anode slice.
 *  Pure address arithmetic — the physics (persistence, dimmer, wear) is the driver's
 *  job, applied afterwards to the same array. */
export function driveElement(el: CompiledElement, state: ElementState, out: Float32Array): void {
	const zero = () => {
		for (let i = 0; i < el.count; i++) out[el.first + i] = 0;
	};
	switch (el.kind) {
		case 'digits': {
			zero();
			const src = el.src as VfdDigits;
			const matrix = el.glyphs === 'matrix';
			const cells = layCells(state.text ?? '', el.cells, src.align ?? 'left', !matrix);
			const set = (c: number, s: number, on: boolean) => {
				const i = slotOf(el, c, s);
				if (i >= 0) out[i] = on ? 1 : 0;
			};
			for (let c = 0; c < el.cells; c++) {
				const { ch, dp, colon } = cells[c];
				if (matrix) {
					for (let s = 0; s < el.stride; s++) set(c, s, matrixDotLit(ch, Math.floor(s / 5), s % 5));
					continue;
				}
				const bits = segmentBits(el.glyphs as Exclude<VfdGlyphs, 'matrix'>, ch);
				for (let s = 0; s < el.segments; s++) set(c, s, !!(bits & (1 << s)));
				set(c, el.segments, dp);
				set(c, el.segments + 1, colon);
				set(c, el.segments + 2, colon);
			}
			break;
		}
		case 'legend':
		case 'icon': {
			const lit = state.on ? 1 : 0;
			for (let i = 0; i < el.count; i++) out[el.first + i] = lit;
			break;
		}
		case 'bars': {
			const src = el.src as VfdBars;
			const rows = el.stride;
			for (let i = 0; i < el.count; i++) out[el.first + i] = 0;
			// Anodes were pushed band-major, skipping any zero-height row, so walk the
			// element's own anode addresses rather than assuming a dense grid.
			for (let b = 0; b < el.cells; b++) {
				const lit = clamp01(state.levels?.[b] ?? 0) * rows;
				// The cap is the top block staying driven while the body falls away.
				const peak = src.peakHold ? Math.floor(Math.min(rows - 1, state.peaks?.[b] ?? -1)) : -1;
				for (let r = 0; r < rows; r++) {
					const i = slotOf(el, b, r);
					if (i >= 0) out[i] = r < lit || (peak >= 0 && r === peak) ? 1 : 0;
				}
			}
			break;
		}
		case 'scale': {
			zero();
			// A null position is no cursor at all, which is not the same as a cursor parked at
			// zero: a dial with nothing tuned in shows an empty scale. That is what `blank` sets.
			if (state.pos == null) break;
			const step = Math.min(el.cells - 1, Math.round(clamp01(state.pos) * (el.cells - 1)));
			const i = slotOf(el, step, 0);
			if (i >= 0) out[i] = 1;
			break;
		}
		case 'dots': {
			const src = state.bitmap;
			if (src == null) {
				zero();
				break;
			}
			const fn = typeof src === 'function' ? src : null;
			const flat = fn ? null : (src as ArrayLike<number>);
			try {
				for (let x = 0; x < el.cells; x++) {
					for (let y = 0; y < el.stride; y++) {
						const i = slotOf(el, x, y);
						if (i < 0) continue;
						const v = fn ? fn(x, y) : flat![y * el.cells + x];
						out[i] = clamp01(Number.isFinite(v) ? v : 0);
					}
				}
			} catch (err) {
				// A bitmap FUNCTION is sampled every frame, so one that throws throws forever —
				// out of a rAF callback, where the consumer cannot catch it. Drop the element
				// instead: dark, said once, and the panel carries on.
				zero();
				state.bitmap = undefined;
				if (!warnedDots.has(el.name)) {
					warnedDots.add(el.name);
					console.warn(
						`glowbox: the bitmap function for "${el.name}" threw, so the element was blanked.`,
						err
					);
				}
			}
			break;
		}
		case 'rule':
			break;
	}
}
