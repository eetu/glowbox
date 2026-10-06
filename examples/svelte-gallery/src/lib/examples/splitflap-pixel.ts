// The /splitflap page's pixel render: the board kept the way a game keeps it, with nothing
// drawn, only what the board was told and when. The shows drive it through the same
// `SplitFlapBoard` API as the canvas board; a command lands on the stage's next frame, and
// `frame(t)` reads every module in closed form (`flapState`) on the stage's clock.
// `paintFlaps` puts those modules on whole pixels.
import {
	type Color,
	createMechSound,
	DEFAULT_CHARSET,
	type DrumZone,
	FLAP_FLIGHT,
	FLAP_NEXT,
	FLAP_ROW,
	flapAngle,
	type FlapCard,
	type FlapCell,
	type FlapFace,
	type FlapGlyph,
	flapGlyph,
	flapLandings,
	type FlapLayout,
	flapRows,
	flapsOf,
	flapState,
	type FlapStateOptions,
	type MechSound,
	padCells,
	parseColor,
	type SplitFlapBoard,
	type SplitFlapOptions
} from '@glowbox/split-flap';

import { mixHex, type PixelFill } from '$lib/components/PixelStage.svelte';

/** Where the board is on screen, for `cellAt` and `cellRect`. */
export interface PixelFlapView {
	/** The canvas the stage scales the board up into. */
	canvas: HTMLCanvasElement;
	layout: FlapLayout;
	/** Pixels of border round the layout. */
	pad: number;
}

export interface PixelFlapOptions {
	cols: number;
	rows: number;
	/** Every module's timing hashes from it. */
	seed: number;
	flipMs?: number;
	sound?: boolean | number;
	view: () => PixelFlapView | null;
	/** A show re-tiled the board. */
	onregrid?: (cols: number, rows: number) => void;
}

export interface PixelFlapBoard extends SplitFlapBoard {
	/** Per-flap faces, as the running show set them. */
	readonly palette: Record<string, Color | FlapFace>;
	/** Every module `t` seconds into the stage's clock, row-major. Lands what was commanded
	 *  since the last frame and slaps the cards that landed. */
	frame(t: number): FlapCell[];
}

/** One command: the board as it was told from, what it was told, and when. A module rides
 *  the last command that changed it until its card lands, so a later command that leaves
 *  it alone never restarts its fall. */
interface Command {
	from: string[];
	to: string[];
	t0: number;
	options: FlapStateOptions;
	/** Where each module ends up. */
	end: FlapCell[];
	/** Each module at this frame. */
	now: FlapCell[];
	riders: number;
}

const SLAPS_PER_S = 60;

const drumsKey = (zs?: DrumZone[]) =>
	(zs ?? []).map((z) => `${z.x},${z.y},${z.cols ?? 1},${z.rows ?? 1}:${z.charset}`).join('\n');

export const createPixelFlap = (opts: PixelFlapOptions): PixelFlapBoard => {
	const { seed, view, onregrid } = opts;
	let cols = Math.max(1, Math.floor(opts.cols));
	let rows = Math.max(1, Math.floor(opts.rows));
	let n = cols * rows;
	let charset = DEFAULT_CHARSET;
	let drums: DrumZone[] = [];
	let palette: Record<string, Color | FlapFace> = {};
	let flipMs = opts.flipMs ?? 90;
	const volumeOf = (s: boolean | number | undefined) =>
		s === true ? 0.5 : Math.max(0, Math.min(1, Number(s) || 0));
	let volume = volumeOf(opts.sound);
	let snd: MechSound | null = null;
	let budget = SLAPS_PER_S;

	// `told` is what the shows last commanded, `aim` what the commands so far carry; a
	// frame turns the difference into a new command.
	let told: string[] = [];
	let aim: string[] = [];
	let dirty = false;
	let rest: FlapCell[] = [];
	let rider: (Command | null)[] = [];
	let live: Command[] = [];
	let last = -1;

	const rowsOf = (cells: string[]) =>
		Array.from({ length: rows }, (_, y) => cells.slice(y * cols, (y + 1) * cols).join(''));
	const optionsNow = (): FlapStateOptions => ({ cols, rows, charset, drums, seed, flipMs });

	/** Every module at rest on what it was told, as the canvas board re-cards: instantly. */
	const settleAll = () => {
		aim = told.slice();
		const lines = rowsOf(aim);
		rest = flapState(lines, lines, 0, optionsNow());
		rider = new Array<Command | null>(n).fill(null);
		live = [];
		dirty = false;
	};
	const blank = () => {
		told = new Array<string>(n).fill(' ');
		settleAll();
	};
	blank();

	const command = (ms: number, cells: FlapCell[]) => {
		dirty = false;
		const changed: number[] = [];
		for (let i = 0; i < n; i++)
			if (told[i] !== aim[i]) {
				aim[i] = told[i];
				changed.push(i);
			}
		if (!changed.length) return;
		// From what the cards show now: a module mid-fall starts its new run from the card
		// it was dropping.
		const options = optionsNow();
		const from = rowsOf(cells.map((c) => c.char));
		const to = rowsOf(aim);
		const c: Command = {
			from,
			to,
			t0: ms,
			options,
			end: flapState(from, to, Infinity, options),
			now: flapState(from, to, 0, options),
			riders: 0
		};
		for (const i of changed) {
			const was = rider[i];
			if (was) was.riders--;
			rider[i] = c;
			c.riders++;
			cells[i] = c.now[i];
		}
		live.push(c);
	};

	// The canvas board's slap, for the cards `flapLandings` says landed this frame: a
	// cascade reads as clatter, a few ticks a frame at most, quieter the denser it lands.
	const slaps = (ms: number) => {
		budget = Math.min(SLAPS_PER_S, budget + ((ms - last) / 1000) * SLAPS_PER_S);
		let count = 0;
		let colSum = 0;
		for (const c of live)
			for (const l of flapLandings(c.from, c.to, last - c.t0, ms - c.t0, c.options))
				if (rider[l.row * cols + l.col] === c) {
					count++;
					colSum += l.col;
				}
		const play = Math.min(count, 3, Math.floor(budget));
		if (play <= 0) return;
		budget -= play;
		snd ??= createMechSound({ volume });
		const gain = Math.min(1, 1.6 / count) * 0.7 + 0.3;
		const pan = cols > 1 ? (colSum / count / (cols - 1)) * 1.4 - 0.7 : 0;
		for (let k = 0; k < play; k++) {
			const j = Math.random();
			snd.tick({
				delay: j * 0.02,
				freq: 6300 + j * 4200,
				decay: 0.008 + j * 0.024,
				noise: 0.9,
				noiseHz: 5200,
				noiseDecay: 0.012,
				gain: gain * (0.25 + 0.75 * j * j),
				pan
			});
		}
	};

	const index = (x: number, y: number) => {
		x = Math.floor(x);
		y = Math.floor(y);
		return x >= 0 && x < cols && y >= 0 && y < rows ? y * cols + x : -1;
	};
	const tell = (row: number, text: string) => {
		const line = padCells(text, cols);
		for (let x = 0; x < cols; x++) told[row * cols + x] = line[x];
		dirty = true;
	};

	return {
		get cols() {
			return cols;
		},
		get rows() {
			return rows;
		},
		get palette() {
			return palette;
		},
		frame(t) {
			const ms = t * 1000;
			if (last > ms) {
				// The stage's clock restarted (it remounted): the commands carry over.
				for (const c of live) c.t0 -= last - ms;
				last = ms;
			}
			for (const c of live) c.now = flapState(c.from, c.to, ms - c.t0, c.options);
			if (volume > 0 && last >= 0) slaps(ms);
			const cells = rider.map((c, i) => (c ? c.now[i] : rest[i]));
			if (dirty) command(ms, cells);
			for (let i = 0; i < n; i++) {
				const c = rider[i];
				if (!c || cells[i].fall >= 0 || cells[i].idx !== c.end[i].idx) continue;
				rest[i] = cells[i];
				rider[i] = null;
				c.riders--;
			}
			live = live.filter((c) => c.riders > 0);
			last = ms;
			return cells;
		},
		setText(text) {
			const lines = Array.isArray(text) ? text : text.split('\n');
			for (let y = 0; y < rows; y++) tell(y, lines[y] ?? '');
		},
		setLine(row, text) {
			row = Math.floor(row);
			if (row >= 0 && row < rows) tell(row, text);
		},
		setChar(x, y, ch) {
			const i = index(x, y);
			if (i < 0) return;
			told[i] = flapsOf(ch)[0] ?? ' ';
			dirty = true;
		},
		getChar(x, y) {
			return told[index(x, y)] ?? ' ';
		},
		getText() {
			return rowsOf(told).map((l) => l.replace(/\s+$/, ''));
		},
		clear() {
			this.setText([]);
		},
		cellAt(clientX, clientY) {
			const v = view();
			const r = v?.canvas.getBoundingClientRect();
			if (!v || !r?.width || !r.height) return null;
			const { width, height } = v.layout;
			const fx = (((clientX - r.left) / r.width) * (width + 2 * v.pad) - v.pad) / width;
			const fy = (((clientY - r.top) / r.height) * (height + 2 * v.pad) - v.pad) / height;
			const x = Math.floor(fx * cols);
			const y = Math.floor(fy * rows);
			return index(x, y) >= 0 ? { x, y } : null;
		},
		cellRect(x, y) {
			const v = view();
			const r = v?.canvas.getBoundingClientRect();
			const card = v?.layout.cards[index(x, y)];
			if (!v || !r?.width || !card) return null;
			const kx = r.width / (v.layout.width + 2 * v.pad);
			const ky = r.height / (v.layout.height + 2 * v.pad);
			return {
				left: r.left + (card.x + v.pad) * kx,
				top: r.top + (card.y + v.pad) * ky,
				width: card.w * kx,
				height: card.h * ky
			};
		},
		setOptions(patch: Partial<SplitFlapOptions>) {
			if (patch.flipMs !== undefined) flipMs = Math.max(0, patch.flipMs);
			if (patch.sound !== undefined) {
				volume = volumeOf(patch.sound);
				snd?.setVolume(volume);
			}
			if (patch.palette !== undefined) palette = patch.palette;
			const c = patch.cols != null ? Math.max(1, Math.floor(patch.cols)) : cols;
			const r = patch.rows != null ? Math.max(1, Math.floor(patch.rows)) : rows;
			const regrid = c !== cols || r !== rows;
			let recard = false;
			if (patch.charset != null && patch.charset !== charset) {
				charset = patch.charset;
				recard = true;
			}
			if (patch.drums !== undefined && drumsKey(patch.drums) !== drumsKey(drums)) {
				drums = patch.drums;
				recard = true;
			}
			if (regrid) {
				// A re-tiled board powers up blank, as the canvas board does.
				cols = c;
				rows = r;
				n = cols * rows;
				blank();
				onregrid?.(cols, rows);
			} else if (recard) settleAll();
		},
		resize() {},
		snapshot() {
			return view()?.canvas.toDataURL() ?? '';
		},
		dispose() {
			snd?.dispose();
			snd = null;
		}
	};
};

// --- painting ----------------------------------------------------------------------

/** 5×7 art for the shows' own flaps, which the face lacks: the snake, pong and scroller
 *  blocks and arrows, and the half-width katakana of the matrix rain. */
export const SHOW_GLYPHS: Record<string, string> = {
	'█': `
#####
#####
#####
#####
#####
#####
#####`,
	'▲': `
.....
..#..
..#..
.###.
.###.
#####
.....`,
	'▼': `
.....
#####
.###.
.###.
..#..
..#..
.....`,
	'░': `
#.#.#
.....
#.#.#
.....
#.#.#
.....
#.#.#`,
	ｱ: `
#####
....#
..##.
..#..
..#..
.#...
#....`,
	ｳ: `
..#..
#####
#...#
....#
...#.
..#..
.#...`,
	ｵ: `
...#.
#####
...#.
..##.
.#.#.
#..#.
..##.`,
	ｻ: `
.#.#.
#####
.#.#.
.#.#.
...#.
..#..
.#...`,
	ｼ: `
.....
##..#
....#
##..#
...#.
..#..
##...`,
	ﾂ: `
.....
#.#.#
#.#.#
....#
...#.
..#..
##...`,
	ﾃ: `
.###.
.....
#####
..#..
..#..
.#...
#....`,
	ﾅ: `
..#..
#####
..#..
..#..
..#..
.#...
#....`,
	ﾆ: `
.....
.###.
.....
.....
.....
#####
.....`,
	ﾊ: `
.....
.#.#.
.#.#.
#...#
#...#
#...#
.....`,
	ﾋ: `
#....
#....
#.###
##...
#....
#....
.####`,
	ﾎ: `
..#..
#####
..#..
#.#.#
#.#.#
..#..
..#..`,
	ﾐ: `
.##..
...##
.....
.##..
...##
.##..
...##`,
	ﾓ: `
.###.
..#..
#####
..#..
..#..
..#..
...##`,
	ﾘ: `
#...#
#...#
#...#
#...#
....#
...#.
..#..`,
	ﾜ: `
#####
#...#
#...#
....#
...#.
..#..
.#...`
};

/** The board's colours: paint, not light. */
export interface FlapInks {
	card: string;
	ink: string;
	/** What shows through the hinge: the frame, or the backdrop with the frame off. */
	split: string;
}

interface Face {
	paint: string;
	ink: string;
	glyph: string | null;
}

const hex = (c: Color) =>
	typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)
		? c
		: `#${parseColor(c)
				.map((v) =>
					Math.round(Math.max(0, Math.min(1, v)) * 255)
						.toString(16)
						.padStart(2, '0')
				)
				.join('')}`;

/** A flap's face, as the canvas board reads `palette`: a plain colour is a chroma card with
 *  no print, a face spec re-prints the flap. */
const faceOf = (ch: string, palette: Record<string, Color | FlapFace>, inks: FlapInks): Face => {
	const spec = palette[ch];
	if (spec === undefined) return { paint: inks.card, ink: inks.ink, glyph: ch };
	if (typeof spec === 'string' || Array.isArray(spec))
		return { paint: hex(spec), ink: inks.ink, glyph: null };
	return {
		paint: spec.paint != null ? hex(spec.paint) : inks.card,
		ink: spec.ink != null ? hex(spec.ink) : inks.ink,
		glyph: spec.glyph ?? ch
	};
};

const glyphs = new Map<string, FlapGlyph>();
const glyphOf = (ch: string, card: FlapCard) => {
	const key = `${card[0]}x${card[1]}:${ch}`;
	let g = glyphs.get(key);
	if (!g) {
		g = flapGlyph(ch, card, { glyphs: SHOW_GLYPHS });
		glyphs.set(key, g);
	}
	return g;
};

/** How far the falling card's front lifts toward white and its back sinks toward black, at
 *  `sin θ` = 1. */
const LIFT = 0.4;
const DIM = 0.5;
const rowMap = new Int16Array(256);
const same = (c: string) => c;

/** The modules of `cells` on `layout`, `pad` pixels in: a card at rest is its two flaps and
 *  print; a falling one goes row by row through `flapRows`, its falling card shaded. */
export const paintFlaps = (
	fill: PixelFill,
	cells: FlapCell[],
	layout: FlapLayout,
	card: FlapCard,
	palette: Record<string, Color | FlapFace>,
	inks: FlapInks,
	pad: number
) => {
	const [w, h] = card;
	const { half, parts } = layout;
	cells.forEach((cell, i) => {
		const box = layout.cards[i];
		if (!box) return;
		const x = box.x + pad;
		if (cell.fall < 0) {
			const face = faceOf(cell.char, palette, inks);
			for (let p = 3 * i; p < 3 * i + 3; p++)
				for (const r of parts[p].rects)
					fill(parts[p].half === 'hinge' ? inks.split : face.paint, r.x + pad, r.y + pad, r.w, r.h);
			if (!face.glyph) return;
			const g = glyphOf(face.glyph, card);
			for (const r of [...g.top, ...g.bottom]) fill(face.ink, x + r.x, box.y + pad + r.y, r.w, r.h);
			return;
		}
		const lit = Math.sin(flapAngle(cell.fall));
		const map = flapRows(cell.fall, card, rowMap);
		for (let row = 0; row < h; row++) {
			const y = box.y + pad + row;
			if (row >= half && row < h - half) {
				fill(inks.split, x, y, w, 1);
				continue;
			}
			const v = map[row];
			const face = faceOf(v & FLAP_NEXT ? cell.next : cell.char, palette, inks);
			// The falling card: its front lit as it swings up toward the light, its back dim.
			const tone = !(v & FLAP_FLIGHT)
				? same
				: v & FLAP_NEXT
					? (c: string) => mixHex(c, '#000000', DIM * lit)
					: (c: string) => mixHex(c, '#ffffff', LIFT * lit);
			fill(tone(face.paint), x, y, w, 1);
			if (face.glyph)
				for (const r of glyphOf(face.glyph, card).rows[v & FLAP_ROW])
					fill(tone(face.ink), x + r.x, y, r.w, 1);
		}
	});
};
