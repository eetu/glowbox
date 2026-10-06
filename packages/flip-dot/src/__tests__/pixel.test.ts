// The pixel board is pure data and closed-form physics: node-testable by design.
import { expect, test } from 'vitest';

import type { PixelRect } from '../pixel';
import {
	type FlipChange,
	flipDotPixels,
	flipFrames,
	flipLandings,
	flipPhases,
	type FlipTiming
} from '../pixel-flipdot';

const cells = (rects: PixelRect[]) => {
	const out: string[] = [];
	for (const r of rects)
		for (let y = r.y; y < r.y + r.h; y++)
			for (let x = r.x; x < r.x + r.w; x++) out.push(`${x},${y}`);
	return out.sort();
};

const picture = (rects: PixelRect[], dot: number) => {
	const g = Array.from({ length: dot }, () => Array<string>(dot).fill('.'));
	for (const c of cells(rects)) {
		const [x, y] = c.split(',').map(Number);
		g[y][x] = '#';
	}
	return g.map((row) => row.join(''));
};

test('flipDotPixels: row-major dots dot + gap apart, whole pixels, no trailing gap', () => {
	const lay = flipDotPixels({ cols: 28, rows: 7, dot: 3, gap: 1 });
	expect(lay.width).toBe(28 * 4 - 1);
	expect(lay.height).toBe(7 * 4 - 1);
	expect(lay.parts).toHaveLength(28 * 7);
	lay.parts.forEach((p, i) => {
		expect([p.col, p.row]).toEqual([i % 28, Math.floor(i / 28)]);
		expect([p.x, p.y]).toEqual([p.col * 4, p.row * 4]);
		for (const r of p.rects) {
			for (const v of [r.x, r.y, r.w, r.h]) expect(Number.isInteger(v)).toBe(true);
			expect(r.x).toBeGreaterThanOrEqual(p.x);
			expect(r.x + r.w).toBeLessThanOrEqual(p.x + 3);
		}
	});
	expect(flipDotPixels({ cols: 2, rows: 1, dot: 2, gap: 0 }).width).toBe(4);
});

test('flipDotPixels: square at 1–2 px, round from 3, in the fewest rects', () => {
	const face = (dot: number, shape?: 'disc' | 'square') =>
		flipDotPixels({ cols: 1, rows: 1, dot, shape }).parts[0].rects;
	expect(face(1)).toEqual([{ x: 0, y: 0, w: 1, h: 1 }]);
	expect(face(2)).toEqual([{ x: 0, y: 0, w: 2, h: 2 }]);
	expect(picture(face(3), 3)).toEqual(['.#.', '###', '.#.']);
	expect(face(3)).toHaveLength(3);
	expect(picture(face(4), 4)).toEqual(['.##.', '####', '####', '.##.']);
	expect(face(5)).toHaveLength(3);
	expect(picture(face(8), 8).slice(0, 3)).toEqual(['..####..', '.######.', '########']);
	// The vane is an octagon, its corners clipped.
	expect(picture(face(6, 'square'), 6)).toEqual([
		'.####.',
		'######',
		'######',
		'######',
		'######',
		'.####.'
	]);
});

test('flipFrames: face A at rest to face B at rest, the edge between', () => {
	for (const dot of [1, 2, 3, 4, 5, 6, 8]) {
		const frames = flipFrames(dot);
		const rest = cells(flipDotPixels({ cols: 1, rows: 1, dot }).parts[0].rects);
		expect(frames).toHaveLength(4 * dot + 1);
		expect(cells(frames[0].a)).toEqual(rest);
		expect(frames[0].b).toEqual([]);
		expect(cells(frames[frames.length - 1].b)).toEqual(rest);
		const mid = frames[2 * dot];
		expect(mid.a).toEqual([]);
		expect(mid.b).toEqual([]);
		expect(mid.edge.length).toBeGreaterThan(0);
		for (const c of cells(mid.edge)) expect(rest).toContain(c);
		// The disc only narrows toward the edge, and opens the same on the other face.
		for (let i = 0; i < 2 * dot; i++) {
			expect(cells(frames[i + 1].a).length).toBeLessThanOrEqual(cells(frames[i].a).length);
			expect(cells(frames[i].a)).toEqual(cells(frames[4 * dot - i].b));
		}
	}
});

test('flipFrames: the disc turns about its axis, edge-on along it', () => {
	const edge = (axis: number) => picture(flipFrames(5, { axis })[10].edge, 5);
	// The rest mask clips the diagonal's ends: a 5 px disc has no corners.
	expect(edge(135)).toEqual(['.....', '...#.', '..#..', '.#...', '.....']);
	expect(edge(0)).toEqual(['.....', '.....', '#####', '.....', '.....']);
	expect(edge(90)).toEqual(['..#..', '..#..', '..#..', '..#..', '..#..']);
	// Squashed across a diagonal axis, the disc keeps its length along it.
	expect(picture(flipFrames(5)[6].a, 5)).toEqual(['.....', '..##.', '.###.', '.##..', '.....']);
});

test('flipFrames: the vane folds, always covering its octagon, both faces mid-fold', () => {
	for (const dot of [3, 4, 6, 8]) {
		const rest = cells(flipDotPixels({ cols: 1, rows: 1, dot, shape: 'square' }).parts[0].rects);
		const frames = flipFrames(dot, { shape: 'square' });
		for (const f of frames) {
			const all = [...cells(f.a), ...cells(f.b), ...cells(f.edge)];
			expect(all.sort()).toEqual(rest);
		}
		const mid = frames[2 * dot];
		expect(mid.a.length && mid.b.length && mid.edge.length).toBeTruthy();
	}
});

// A board: frames as strings, one char per dot.
const bits = (s: string) => Uint8Array.from(s, (c) => (c === '#' ? 1 : 0));

/** Each dot's stagger delay and flip time, read off the landings of one change. */
const timingsOf = (timing: FlipTiming) => {
	const n = timing.cols * timing.rows;
	const all: FlipChange[] = [{ t: 0, frame: new Uint8Array(n).fill(1) }];
	const at = (stagger: FlipTiming['stagger']) => {
		const out = new Float64Array(n);
		for (const l of flipLandings(all, -1, 10, { ...timing, stagger })) out[l.index] = l.t;
		return out;
	};
	const dur = at('none');
	const scan = at('scan');
	return { dur, delay: Array.from(scan, (t, i) => t - dur[i]) };
};

test('flipPhases: face A before the first change, the frame once it has swept', () => {
	const timing = { cols: 4, rows: 2, seed: 3 };
	const changes = [{ t: 1, frame: bits('#..#.##.') }];
	expect([...flipPhases(changes, 0.5, timing)]).toEqual(Array(8).fill(0));
	expect([...flipPhases(changes, 2, timing)]).toEqual([...changes[0].frame]);
	// A change put in the past is a board at rest on it.
	expect([...flipPhases([{ t: -1, frame: bits('##..##..') }], 0, timing)]).toEqual([
		1, 1, 0, 0, 1, 1, 0, 0
	]);
});

test('flipPhases: the scan sweeps rows top to bottom; flips take 0.85–1.15 flipMs', () => {
	const timing = { cols: 6, rows: 5, seed: 9 };
	const { dur, delay } = timingsOf(timing);
	for (let i = 0; i < 30; i++) {
		const row = Math.floor(i / 6);
		expect(dur[i]).toBeGreaterThanOrEqual(0.07 * 0.85 - 1e-9);
		expect(dur[i]).toBeLessThanOrEqual(0.07 * 1.15 + 1e-9);
		expect(delay[i]).toBeGreaterThanOrEqual((row / 4) * 0.15 - 1e-9);
		expect(delay[i]).toBeLessThanOrEqual((row / 4) * 0.15 + 0.014 + 1e-9);
	}
	const mid = flipPhases([{ t: 0, frame: new Uint8Array(30).fill(1) }], 0.08, timing);
	const rowMean = (r: number) => mid.slice(r * 6, r * 6 + 6).reduce((s, p) => s + p, 0) / 6;
	expect(rowMean(0)).toBeGreaterThan(rowMean(2));
	expect(rowMean(2)).toBeGreaterThan(rowMean(4));
});

test('flipPhases: the same at the same moment; the seed is the board', () => {
	const changes = [{ t: 0, frame: new Uint8Array(40).fill(1) }];
	const at = (seed: number) => [...flipPhases(changes, 0.06, { cols: 8, rows: 5, seed })];
	expect(at(1)).toEqual(at(1));
	expect(at(1)).not.toEqual(at(2));
	// 'random' scatters by the change's time, not its place in the list: an old change the
	// board has long settled from changes nothing.
	const timing = { cols: 8, rows: 5, seed: 4, stagger: 'random' } as const;
	const recent = [
		{ t: -10, frame: bits('#'.repeat(20) + '.'.repeat(20)) },
		{ t: 0, frame: bits('.#'.repeat(20)) }
	];
	const longer = [{ t: -20, frame: bits('#'.repeat(40)) }, ...recent];
	expect([...flipPhases(longer, 0.05, timing)]).toEqual([...flipPhases(recent, 0.05, timing)]);
});

test('flipPhases: a disc caught mid-flip finishes it before the next one starts', () => {
	const timing = { cols: 1, rows: 2, seed: 5 };
	const { dur, delay } = timingsOf(timing);
	const [d, f] = [delay[1], dur[1]];
	// The bottom dot is half over when it is sent back: it lands first, then waits its delay.
	const back = d + f / 2;
	const changes = [
		{ t: 0, frame: bits('##') },
		{ t: back, frame: bits('..') }
	];
	const p = (t: number) => flipPhases(changes, t, timing)[1];
	expect(p(back)).toBeCloseTo(0.5, 5);
	expect(p(back + f / 4)).toBeCloseTo(0.75, 5);
	expect(p(back + f / 2 + 0.001)).toBe(1);
	expect(p(back + d - 0.001)).toBe(1);
	expect(p(back + d + f / 2)).toBeCloseTo(0.5, 5);
	expect(p(back + d + f + 0.001)).toBe(0);
});

// The canvas board's loop, stepped: the closed form must agree with it at any moment.
const stepped = (
	changes: FlipChange[],
	t: number,
	n: number,
	timing: { delay: number[]; dur: Float64Array }
) => {
	const target = new Uint8Array(n);
	const cur = new Float64Array(n);
	const delay = new Float64Array(n);
	const dt = 1e-4;
	let c = 0;
	for (let s = 0; changes[0].t + s * dt < t; s++) {
		const now = changes[0].t + s * dt;
		for (; c < changes.length && changes[c].t <= now; c++)
			for (let i = 0; i < n; i++) {
				const v = changes[c].frame[i] ? 1 : 0;
				if (target[i] === v) continue;
				target[i] = v;
				delay[i] = timing.delay[i];
			}
		for (let i = 0; i < n; i++) {
			const rate = dt / timing.dur[i];
			if (delay[i] > 0) {
				delay[i] -= dt;
				if (delay[i] > 0) {
					const back = 1 - target[i];
					cur[i] = back > cur[i] ? Math.min(back, cur[i] + rate) : Math.max(back, cur[i] - rate);
					continue;
				}
				delay[i] = 0;
			}
			const v = target[i];
			cur[i] = v > cur[i] ? Math.min(v, cur[i] + rate) : Math.max(v, cur[i] - rate);
		}
	}
	return cur;
};

test('flipPhases: matches the canvas loop through rapid changes', () => {
	const timing = { cols: 4, rows: 3, seed: 11 };
	const n = 12;
	let r = 7;
	const rand = () => {
		r = (Math.imul(r, 1103515245) + 12345) >>> 0;
		return r / 4294967296;
	};
	const changes: FlipChange[] = [];
	let t = 0;
	for (let k = 0; k < 14; k++) {
		changes.push({ t, frame: Uint8Array.from({ length: n }, () => (rand() < 0.5 ? 1 : 0)) });
		// Some changes come faster than a flip, some before the sweep reaches the bottom.
		t += 0.01 + rand() * 0.2;
	}
	const times = timingsOf(timing);
	for (const at of [0.05, 0.13, 0.31, 0.5, 0.77, 1.1, t + 0.3]) {
		const want = stepped(changes, at, n, times);
		const got = flipPhases(changes, at, timing);
		for (let i = 0; i < n; i++) expect(Math.abs(got[i] - want[i])).toBeLessThan(0.01);
	}
});

test('flipPhases: flipMs 0 is instant, no sweep', () => {
	const changes = [
		{ t: 0, frame: bits('#.#.') },
		{ t: 1, frame: bits('.##.') }
	];
	expect([...flipPhases(changes, 1, { cols: 2, rows: 2, flipMs: 0 })]).toEqual([0, 1, 1, 0]);
});

test('flipLandings: each flipped dot lands once, when it reaches its face, windows split cleanly', () => {
	const timing = { cols: 5, rows: 4, seed: 2 };
	const changes = [
		{ t: -1, frame: bits('#####.....#####.....') },
		{ t: 0, frame: bits('#.#.#.#.#.#.#.#.#.#.') }
	];
	const all = flipLandings(changes, 0, 1, timing);
	const flipped = [...changes[1].frame].filter((v, i) => v !== changes[0].frame[i]).length;
	expect(all).toHaveLength(flipped);
	expect(new Set(all.map((l) => l.index)).size).toBe(flipped);
	expect(all.map((l) => l.t)).toEqual([...all.map((l) => l.t)].sort((a, b) => a - b));
	for (const l of all) {
		const face = changes[1].frame[l.index];
		expect([l.col, l.row]).toEqual([l.index % 5, Math.floor(l.index / 5)]);
		expect(Math.abs(flipPhases(changes, l.t, timing)[l.index] - face)).toBeLessThan(1e-6);
		expect(Math.abs(flipPhases(changes, l.t - 0.002, timing)[l.index] - face)).toBeGreaterThan(
			0.01
		);
	}
	const split = [
		...flipLandings(changes, 0, 0.1, timing),
		...flipLandings(changes, 0.1, 1, timing)
	];
	expect(split).toEqual(all);
	expect(flipLandings(changes, 1, 2, timing)).toEqual([]);
});
