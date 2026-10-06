// The panel as data at whole-pixel scale, for a game painting it into its own low-resolution
// raster. The same layout as the canvas panel, with boxes in pixels, compiles to one part per
// anode carrying the anode's address, so `driveElement` drives it unchanged. Geometry is built
// once; the light is per frame and apart: `vfdTargets` says what is driven, `stepPhosphor`
// runs persistence over it, `vfdLevels` applies the dimmer, wear and grid banding. Nothing
// here keeps a clock or calls Math.random, so a world that is a function of time and seed
// replays the same panel.
//
// The kinds that are rects already: `digits` as '7seg' (shared/pixel-segments.ts) or the 5×7
// 'matrix', `legend`, `bars`, `dots`, `rule`. The rest throw, naming the element.
import { CELL_EXTRAS, MATRIX_DOTS, type VfdGlyphs, wordRuns } from './faces';
import { FONT_5X7 } from './font5x7';
import {
	addr,
	type CompiledElement,
	driveElement,
	type ElementState,
	failingCols,
	GRID_COLS,
	gridPass,
	type VfdElement
} from './panel';
import { ATTACK_TAU, DECAY_MIN, DECAY_SPAN, type PhosphorName, PHOSPHORS } from './phosphor';
import type { PixelLayout, PixelPart, PixelRect } from './pixel';
import { pixelSegments } from './pixel-segments';
import { maskRects } from './pixel-stroke';
import { type Wear, wearLevels } from './wear';

/** One anode as the pixels it covers, with the canvas panel's address for it. */
export interface VfdPixelPart extends PixelPart {
	/** Index into the panel's `elements`. */
	el: number;
	/** Character cell, band, or dot column. */
	cell: number;
	/** Segment, dot, or bar row within the cell. */
	sub: number;
	/** Multiplex grid column, 0 … `GRID_COLS − 1`, from the part's centre. */
	col: number;
	/** Silkscreen: ink on the glass, never driven. */
	printed: boolean;
}

/** A compiled pixel panel: `parts` in anode order, and the elements that address them. */
export interface VfdPixelPanel extends PixelLayout<VfdPixelPart> {
	elements: CompiledElement[];
	byName: Map<string, number>;
	/** How many parts are wired, silkscreen excluded. */
	driven: number;
}

const clamp01 = (v: number) => (v > 0 ? (v > 1 ? 1 : v) : 0);

const fail = (src: VfdElement, why: string): never => {
	throw new Error(`glowbox: pixel panel element "${src.name}" ${why}.`);
};

/** `text` in the 5×7 face at `k` px a dot, merged into runs, from (x, y). */
const word = (text: string, x: number, y: number, k: number) => {
	const { rects, width } = wordRuns(text);
	return {
		width: width * k,
		rects: rects.map((r) => ({ x: x + r.x * k, y: y + r.y * k, w: r.w * k, h: r.h * k }))
	};
};

/** A round dot `w` × `h`: the cells whose centres fall inside the ellipse. */
function disc(w: number, h: number): PixelRect[] {
	const mask = new Uint8Array(w * h);
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const dx = (x + 0.5) / w - 0.5;
			const dy = (y + 0.5) / h - 0.5;
			mask[y * w + x] = dx * dx + dy * dy <= 0.25 ? 1 : 0;
		}
	return maskRects(mask, w, h);
}

/**
 * Compile a layout to whole pixels: `frame` is the panel's `[width, height]` in pixels and
 * every box is in pixels (rounded to whole ones). Parts come in the canvas panel's anode
 * order with its addresses, one per anode. Digits are upright and fill their box's height;
 * the 5×7 face (matrix cells, legends, scale labels) is drawn at the largest whole scale
 * that fits, and a box too small for its element throws. 14/16-segment digits (the default
 * `glyphs`), `icon` and `scale` throw too.
 */
export function compilePixelPanel(frame: [number, number], layout: VfdElement[]): VfdPixelPanel {
	if (!(frame[0] >= 1) || !(frame[1] >= 1) || !Number.isFinite(frame[0] * frame[1])) {
		throw new Error(
			`glowbox: the pixel panel frame must be two finite sizes of at least 1 px, got [${frame[0]}, ${frame[1]}].`
		);
	}
	const width = Math.round(frame[0]);
	const height = Math.round(frame[1]);
	const elements: CompiledElement[] = [];
	const parts: VfdPixelPart[] = [];
	const byName = new Map<string, number>();

	const push = (el: number, cell: number, sub: number, printed: boolean, rects: PixelRect[]) => {
		const kept = rects.filter((r) => r.w > 0 && r.h > 0);
		if (!kept.length) return;
		const x0 = Math.min(...kept.map((r) => r.x));
		const x1 = Math.max(...kept.map((r) => r.x + r.w));
		const col = Math.max(
			0,
			Math.min(GRID_COLS - 1, Math.floor(((x0 + x1) / 2 / width) * GRID_COLS))
		);
		parts.push({ rects: kept, el, cell, sub, col, printed });
	};

	for (const src of layout) {
		const ei = elements.length;
		if (typeof src.name !== 'string' || !src.name) {
			throw new Error(`glowbox: every panel element needs a name (element ${ei} of the layout).`);
		}
		if (byName.has(src.name)) {
			throw new Error(
				`glowbox: two panel elements are named "${src.name}". Names are how set/light/bars/dots reach an element, so they must be unique.`
			);
		}
		if (src.kind === 'icon' || src.kind === 'scale') {
			fail(
				src,
				`is ${src.kind === 'icon' ? 'an icon' : 'a scale'}; pixel panels draw digits, legend, bars, dots and rule`
			);
		}
		if (src.kind === 'digits' && src.glyphs !== '7seg' && src.glyphs !== 'matrix') {
			fail(
				src,
				`is ${src.glyphs ?? '14seg (the default)'} digits; pixel panels draw '7seg' and 'matrix'`
			);
		}
		if (src.x == null || src.y == null || src.w == null || src.h == null) {
			fail(src, 'needs x/y/w/h');
		}
		const bx = Math.round(src.x!);
		const by = Math.round(src.y!);
		const box = {
			x: bx,
			y: by,
			w: Math.round(src.x! + src.w!) - bx,
			h: Math.round(src.y! + src.h!) - by
		};
		const first = parts.length;
		let cells = 1;
		let stride = 1;
		let segments = 0;
		let glyphs: VfdGlyphs | undefined;

		switch (src.kind) {
			case 'digits': {
				glyphs = src.glyphs;
				cells = Math.max(1, Math.floor(src.chars));
				const pitch = Math.floor(box.w / cells);
				// The leftover of whole-pixel pitches, split either side of the row.
				const ox = box.x + Math.floor((box.w - cells * pitch) / 2);
				if (glyphs === 'matrix') {
					segments = stride = MATRIX_DOTS;
					const { width: cols, height: rows } = FONT_5X7;
					const p = Math.min(Math.floor(pitch / (cols + 1)), Math.floor(box.h / rows));
					if (p < 1)
						fail(src, `gives each character ${pitch} × ${box.h} px; a 5×7 cell needs 6 × 7`);
					// A pixel of gutter once a dot can spare one: dots that touch read as a bitmap
					// font, and at 2 px a gutter would halve the dot.
					const d = p < 3 ? p : p - Math.max(1, Math.round(p * 0.14));
					const inkW = cols * p - (p - d);
					const lead = ox + Math.floor((pitch - inkW) / 2);
					const top = box.y + Math.floor((box.h - (rows * p - (p - d))) / 2);
					for (let c = 0; c < cells; c++)
						for (let s = 0; s < stride; s++) {
							const x = lead + c * pitch + (s % cols) * p;
							push(ei, c, s, false, [{ x, y: top + Math.floor(s / cols) * p, w: d, h: d }]);
						}
					break;
				}
				segments = 7;
				stride = segments + CELL_EXTRAS;
				const h = box.h;
				const s = Math.max(1, Math.round(h / 13));
				// The point and colon ride the gutter after their digit, a pixel clear each side.
				const dw = Math.min(Math.round(h / 2), pitch - s - 2);
				const mid = Math.floor((h - s) / 2);
				if (dw < 2 * s + 1 || mid < 2 * s || mid + 4 * s > h) {
					fail(src, `gives each digit ${pitch} × ${h} px; 7-segment needs 6 × 6 at the least`);
				}
				const seg = pixelSegments(h, { stroke: s, width: dw });
				const bead = dw + Math.floor((pitch - dw - s) / 2);
				const cell: PixelRect[] = [
					seg.a,
					seg.b,
					seg.c,
					seg.d,
					seg.e,
					seg.f,
					seg.g,
					{ ...seg.dp, x: bead },
					{ x: bead, y: mid - 2 * s, w: s, h: s },
					{ x: bead, y: mid + 2 * s, w: s, h: s }
				];
				for (let c = 0; c < cells; c++)
					for (let i = 0; i < stride; i++) {
						const r = cell[i];
						push(ei, c, i, false, [{ ...r, x: ox + c * pitch + r.x, y: box.y + r.y }]);
					}
				break;
			}
			case 'legend': {
				const { width: w0 } = wordRuns(src.text);
				if (!w0) break;
				const k = Math.min(Math.floor(box.w / w0), Math.floor(box.h / FONT_5X7.height));
				if (k < 1) {
					fail(
						src,
						`needs ${w0} × ${FONT_5X7.height} px for "${src.text}"; the box gives ${box.w} × ${box.h}`
					);
				}
				const align = src.align ?? 'center';
				const free = box.w - w0 * k;
				const x = box.x + (align === 'left' ? 0 : align === 'right' ? free : Math.floor(free / 2));
				const y = box.y + Math.floor((box.h - FONT_5X7.height * k) / 2);
				push(ei, 0, 0, src.printed ?? false, word(src.text, x, y, k).rects);
				break;
			}
			case 'bars': {
				cells = Math.max(1, Math.floor(src.bands));
				stride = Math.max(1, Math.floor(src.rows));
				const horizontal = src.from === 'left';
				// A printed scale takes a line of the 5×7 face and a pixel above it.
				const labelH = src.scale?.length ? FONT_5X7.height + 1 : 0;
				const gridH = box.h - labelH;
				const acrossSpan = horizontal ? gridH : box.w;
				const upSpan = horizontal ? box.w : gridH;
				const bandPitch = Math.floor(acrossSpan / cells);
				const rowPitch = Math.floor(upSpan / stride);
				if (bandPitch < 1 || rowPitch < 1) {
					fail(
						src,
						`needs a pixel per band and per row (${cells} × ${stride}); the box gives ${box.w} × ${gridH}`
					);
				}
				// Blocks keep a gutter wherever the pitch has room for one: a meter of touching
				// blocks reads as a bar graph, not as a VFD's segmented column.
				const gutterB = bandPitch > 1 ? Math.max(1, Math.round(bandPitch * 0.22)) : 0;
				const gutterR = rowPitch > 1 ? Math.max(1, Math.round(rowPitch * 0.24)) : 0;
				const bw = bandPitch - gutterB;
				const along0 = Math.floor((acrossSpan - (cells * bandPitch - gutterB)) / 2);
				const up0 = Math.floor((upSpan - (stride * rowPitch - gutterR)) / 2);
				for (let b = 0; b < cells; b++) {
					const ramp = src.wedge ? 0.55 + 0.45 * (cells > 1 ? b / (cells - 1) : 1) : 1;
					const along = along0 + b * bandPitch;
					for (let r = 0; r < stride; r++) {
						const up = up0 + r * rowPitch;
						if (horizontal) {
							push(ei, b, r, false, [
								{ x: box.x + up, y: box.y + along, w: rowPitch - gutterR, h: bw }
							]);
							continue;
						}
						// Row 0 is the bottom block.
						const rh = Math.max(1, Math.round(rowPitch * ramp) - gutterR);
						push(ei, b, r, false, [{ x: box.x + along, y: box.y + gridH - up - rh, w: bw, h: rh }]);
					}
				}
				const labels = src.scale ?? [];
				const lw = box.w / Math.max(3, labels.length);
				labels.forEach((text, i) => {
					const at = labels.length > 1 ? i / (labels.length - 1) : 0.5;
					const centre = box.x + at * (box.w - lw) + lw / 2;
					const w0 = wordRuns(text).width;
					const x = Math.max(box.x, Math.min(box.x + box.w - w0, Math.round(centre - w0 / 2)));
					push(ei, i, 0, true, word(text, x, box.y + gridH + 1, 1).rects);
				});
				break;
			}
			case 'dots': {
				cells = Math.max(1, Math.floor(src.cols));
				stride = Math.max(1, Math.floor(src.rows));
				const px = Math.floor(box.w / cells);
				const py = Math.floor(box.h / stride);
				if (px < 1 || py < 1) {
					fail(
						src,
						`needs a pixel per dot (${cells} × ${stride}); the box gives ${box.w} × ${box.h}`
					);
				}
				const gap = clamp01(src.gap ?? 0.14);
				const dw = Math.max(1, px - Math.round(px * gap));
				const dh = Math.max(1, py - Math.round(py * gap));
				const dot = src.dot === 'round' ? disc(dw, dh) : [{ x: 0, y: 0, w: dw, h: dh }];
				const ox = box.x + Math.floor((box.w - (cells * px - (px - dw))) / 2);
				const oy = box.y + Math.floor((box.h - (stride * py - (py - dh))) / 2);
				// Column-major, row 0 at the top: the canvas panel's address order.
				for (let x = 0; x < cells; x++)
					for (let y = 0; y < stride; y++) {
						const at = (r: PixelRect) => ({ ...r, x: ox + x * px + r.x, y: oy + y * py + r.y });
						push(ei, x, y, false, dot.map(at));
					}
				break;
			}
			case 'rule': {
				const t = Math.max(1, Math.round(src.weight ?? 0.8));
				const shape = src.shape ?? 'line';
				const { x, y, w, h } = box;
				let rects: PixelRect[];
				if (shape === 'fill' || (shape === 'box' && (w <= 2 * t || h <= 2 * t))) rects = [box];
				else if (shape === 'box')
					rects = [
						{ x, y, w, h: t },
						{ x, y: y + h - t, w, h: t },
						{ x, y: y + t, w: t, h: h - 2 * t },
						{ x: x + w - t, y: y + t, w: t, h: h - 2 * t }
					];
				else if (w >= h) rects = [{ x, y: y + Math.floor((h - t) / 2), w, h: Math.min(t, h) }];
				else rects = [{ x: x + Math.floor((w - t) / 2), y, w: Math.min(t, w), h }];
				push(ei, 0, 0, true, rects);
				break;
			}
		}

		byName.set(src.name, ei);
		const index = new Map<number, number>();
		let bx0 = Infinity;
		let by0 = Infinity;
		let bx1 = -Infinity;
		let by1 = -Infinity;
		for (let i = first; i < parts.length; i++) {
			const p = parts[i];
			if (!p.printed) index.set(addr(p.cell, p.sub), i);
			for (const r of p.rects) {
				bx0 = Math.min(bx0, r.x);
				by0 = Math.min(by0, r.y);
				bx1 = Math.max(bx1, r.x + r.w);
				by1 = Math.max(by1, r.y + r.h);
			}
		}
		const count = parts.length - first;
		elements.push({
			name: src.name,
			kind: src.kind,
			box,
			bounds: Number.isFinite(bx0) ? { x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 } : { ...box },
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
		width,
		height,
		parts,
		elements,
		byName,
		driven: parts.reduce((n, p) => n + (p.printed ? 0 : 1), 0)
	};
}

/**
 * What drives one element in `vfdTargets`: a string or number a `digits` field, a boolean a
 * `legend`, an array of 0..1 levels a `bars` element, a bitmap or `(x, y)` function a `dots`
 * area. An `ElementState` drives any kind as `driveElement` reads it: a `bars` element's
 * held caps ride in its `peaks`, stepped with `fallPeaks`.
 */
export type VfdPixelValue =
	string | number | boolean | ArrayLike<number> | ((x: number, y: number) => number) | ElementState;

const WIRE: Record<VfdElement['kind'], string> = {
	digits: 'a string',
	legend: 'a boolean',
	bars: 'an array of levels',
	dots: 'a bitmap or an (x, y) function',
	rule: 'nothing (a rule is ink)',
	icon: 'a boolean',
	scale: 'a number'
};

const isArray = (v: unknown): v is ArrayLike<number> =>
	typeof v === 'object' && v !== null && typeof (v as ArrayLike<number>).length === 'number';

function stateOf(el: CompiledElement, v: VfdPixelValue): ElementState {
	if (typeof v === 'object' && v !== null && !isArray(v)) return v as ElementState;
	if (el.kind === 'digits' && (typeof v === 'string' || typeof v === 'number'))
		return { text: String(v) };
	if (el.kind === 'legend' && typeof v === 'boolean') return { on: v };
	if (el.kind === 'bars' && isArray(v)) return { levels: v };
	if (el.kind === 'dots' && (isArray(v) || typeof v === 'function')) return { bitmap: v };
	return fail(el.src, `is a ${el.kind} element, driven by ${WIRE[el.kind]}`);
}

/**
 * Each part's drive target, 0 or 1 (a `dots` bitmap's fractions pass through), into `out`:
 * `values` by element name, the layout's own `value`/`on` for an element not named there.
 * `selfTest` lights every wired part, what a panel does for about a second after power-on.
 * Silkscreen is 0. Throws on a name the layout doesn't have.
 */
export function vfdTargets(
	panel: VfdPixelPanel,
	values: Record<string, VfdPixelValue>,
	{ selfTest = false }: { selfTest?: boolean } = {},
	out: Float32Array = new Float32Array(panel.parts.length)
): Float32Array {
	for (const name of Object.keys(values)) {
		if (!panel.byName.has(name)) {
			throw new Error(
				`glowbox: no pixel panel element named "${name}". Known: ${[...panel.byName.keys()].join(', ') || '(none)'}`
			);
		}
	}
	for (const el of panel.elements) {
		const v = values[el.name];
		const src = el.src as { value?: string; on?: boolean };
		driveElement(
			el,
			v === undefined ? { text: src.value ?? '', on: src.on ?? false } : stateOf(el, v),
			out
		);
	}
	panel.parts.forEach((p, i) => {
		if (p.printed) out[i] = 0;
		else if (selfTest) out[i] = 1;
	});
	return out;
}

/** The envelope's persistence: the panel's `persistence` 0..1 (default 0.05) and its phosphor
 *  (default 'zn-o'), whose `lag` scales the release. */
export interface PhosphorStep {
	persistence?: number;
	phosphor?: PhosphorName;
}

/**
 * Move `levels` toward `targets` over `dt` seconds, in place: a ~12 ms attack, a release of
 * 20 ms + `persistence` × lag × 340 ms, which is the smear a falling bar leaves. Persistence 0
 * lands on the targets at once, as the canvas panel does.
 */
export function stepPhosphor(
	levels: Float32Array,
	targets: ArrayLike<number>,
	dt: number,
	{ persistence = 0.05, phosphor = 'zn-o' }: PhosphorStep = {}
): Float32Array {
	const keep = clamp01(persistence);
	if (!keep) {
		for (let i = 0; i < levels.length; i++) levels[i] = targets[i] ?? 0;
		return levels;
	}
	const step = dt > 0 ? dt : 0;
	const lag = PHOSPHORS[phosphor]?.lag ?? 1;
	const attack = 1 - Math.exp(-step / ATTACK_TAU);
	const decay = 1 - Math.exp(-step / (DECAY_MIN + keep * lag * DECAY_SPAN));
	for (let i = 0; i < levels.length; i++) {
		const t = targets[i] ?? 0;
		const l = levels[i];
		if (l === t) continue;
		const next = l + (t - l) * (t > l ? attack : decay);
		// Snap once the remainder stops being visible.
		levels[i] = Math.abs(t - next) < 0.002 ? t : next;
	}
	return levels;
}

/** What reaches the glass: the dimmer `brightness` 0..1 (default 1) and the wear. */
export interface VfdLight extends Partial<Wear> {
	brightness?: number;
}

/**
 * Each part's light at `t`, 0 (a ghost) … 1, into `out` (`levels` is left alone): the dimmer
 * raised to 1.5, as the duty-cycle button cut it; the wear arc over the wired parts
 * (`wearLevels`: worn parts dim, the most-worn flickers past age 0.7 and is dead from 0.95);
 * from age 0.6 one grid column passes 42 % and from 0.85 another 60 %, a vertical band across
 * whatever sits in it. Silkscreen is 0. The filter's tint is a colour multiply the caller
 * applies.
 */
export function vfdLevels(
	panel: VfdPixelPanel,
	levels: ArrayLike<number>,
	{ brightness = 1, age = 0, seed = 0, t = 0 }: VfdLight = {},
	out: Float32Array = new Float32Array(panel.parts.length)
): Float32Array {
	const dim = Math.pow(clamp01(brightness), 1.5);
	const worn = clamp01(age);
	const wear = worn > 0 ? wearLevels(panel.driven, { age: worn, seed, t }) : null;
	const cols = failingCols(seed);
	let j = 0;
	panel.parts.forEach((p, i) => {
		if (p.printed) {
			out[i] = 0;
			return;
		}
		let v = (levels[i] ?? 0) * dim;
		if (wear) v *= wear[j] * gridPass(p.col, worn, cols);
		j++;
		out[i] = v;
	});
	return out;
}
