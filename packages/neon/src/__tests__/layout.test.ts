// Pure layout arithmetic — text → placed tube sections, no canvas anywhere.
import { expect, test, vi } from 'vitest';

import { resolveFont } from '../font';
import { layoutTubes, type NeonLayout, roundCorners, type TubeSection } from '../layout';

const sans = resolveFont('sans');

test('single line: per-glyph sections, width = advances + tracking', () => {
	const l = layoutTubes('HI', 'sans');
	expect(l.sections.length).toBe(2);
	expect(l.sections.every((s) => s.line === 0)).toBe(true);
	expect(l.width).toBe(sans.glyphs['H'].adv + sans.glyphs['I'].adv);
	expect(l.top).toBe(-sans.ascent);
	const tracked = layoutTubes('HI', 'sans', { letterSpacing: 0.5 });
	expect(tracked.width).toBeCloseTo(l.width + 0.5 * sans.capHeight);
});

test('multi-line: line indices, advance, alignment', () => {
	const l = layoutTubes('NO\nVACANCY', 'sans');
	expect(l.lines).toBe(2);
	expect(new Set(l.sections.map((s) => s.line))).toEqual(new Set([0, 1]));
	expect(l.height).toBeCloseTo((sans.ascent + sans.descent) * 1.1 + sans.ascent + sans.descent);
	// The short line centres by default, hugs the edges under left/right.
	const minX = (lay: ReturnType<typeof layoutTubes>, line: number) =>
		Math.min(
			...lay.sections
				.filter((s) => s.line === line)
				.flatMap((s) => s.strokes.flat().map((p) => p[0]))
		);
	const centered = minX(l, 0);
	expect(minX(layoutTubes('NO\nVACANCY', 'sans', { align: 'left' }), 0)).toBeLessThan(centered);
	expect(minX(layoutTubes('NO\nVACANCY', 'sans', { align: 'right' }), 0)).toBeGreaterThan(centered);
});

test("grouping: script→word, sans→glyph under 'auto'; explicit overrides win", () => {
	expect(layoutTubes('so hot', 'script').sections.length).toBe(2);
	expect(layoutTubes('so hot', 'sans').sections.length).toBe(5);
	expect(layoutTubes('so hot', 'sans', { tubes: 'word' }).sections.length).toBe(2);
	expect(layoutTubes('so hot\nso cold', 'sans', { tubes: 'line' }).sections.length).toBe(2);
});

test('electrode ends sit on the outermost stroke endpoints, pointing outward', () => {
	const l = layoutTubes('I', 'sans');
	const [a, b] = l.sections[0].ends;
	expect(a.y).toBe(-sans.capHeight); // top of the stem
	expect(a.dy).toBeLessThan(0); // stub points up and out
	expect(b.y).toBe(0); // baseline
	expect(b.dy).toBeGreaterThan(0);
	expect(a.x).toBeCloseTo(b.x);
});

test('roundCorners: endpoints untouched, fillet stays inside the corner wedge', () => {
	const bent = roundCorners(
		[
			[0, 0],
			[10, 0],
			[10, 10]
		],
		2
	);
	expect(bent[0]).toEqual([0, 0]);
	expect(bent[bent.length - 1]).toEqual([10, 10]);
	expect(bent.length).toBeGreaterThan(3);
	for (const [x, y] of bent) {
		expect(x).toBeLessThanOrEqual(10 + 1e-9);
		expect(y).toBeGreaterThanOrEqual(-1e-9);
		// Inside the fillet region the path must have left the sharp corner itself.
		if (x > 8 && y < 2) expect(x - 8 + (2 - y)).toBeLessThanOrEqual(4 + 1e-9);
	}
	expect(bent.some(([x, y]) => x === 10 && y === 0)).toBe(false); // corner is gone
});

test('a glyph the face lacks is skipped with one warning, ever', () => {
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
	try {
		const l = layoutTubes('éé', 'sans');
		layoutTubes('é', 'script');
		expect(l.sections.length).toBe(0);
		expect(l.width).toBe(0);
		expect(warn).toHaveBeenCalledTimes(1);
	} finally {
		warn.mockRestore();
	}
});

test('empty text lays out to nothing', () => {
	const l = layoutTubes('', 'script');
	expect(l.sections).toEqual([]);
	expect(l.width).toBe(0);
	expect(l.lines).toBe(1);
});

test('tilt rotates the text block about its centre; negative rises left-to-right', () => {
	const flat = layoutTubes('HI', 'sans');
	const tilted = layoutTubes('HI', 'sans', { tilt: -20 });
	expect(tilted.height).toBeGreaterThan(flat.height); // the box grew to the diagonal
	expect(tilted.left).toBeLessThan(0);
	const meanY = (lay: ReturnType<typeof layoutTubes>, i: number) => {
		const ys = lay.sections[i].strokes.flat().map((p) => p[1]);
		return ys.reduce((a, b) => a + b, 0) / ys.length;
	};
	// H (left) drops, I (right) rises — the word climbs to the right.
	expect(meanY(tilted, 0)).toBeGreaterThan(meanY(flat, 0));
	expect(meanY(tilted, 1)).toBeLessThan(meanY(flat, 1));
	// Electrode ends followed the rotation.
	expect(tilted.sections[0].ends[0].y).not.toBeCloseTo(flat.sections[0].ends[0].y);
});

// --- art -----------------------------------------------------------------------

const RING: [number, number][][] = [
	[
		[0, 0],
		[10, 0],
		[10, 10],
		[0, 10],
		[0, 0]
	]
];

test('art: behind centres on the text block, sized by it, and renders first', () => {
	const noArt = layoutTubes('HI', 'sans');
	const blockH = noArt.height;
	const l = layoutTubes('HI', 'sans', { art: [{ d: RING, place: 'behind', size: 2 }] });
	expect(l.sections[0].art).toBe(0); // z-order: the backdrop piece first
	expect(l.sections[l.sections.length - 1].art).toBeUndefined();
	const ys = l.sections[0].strokes[0].map((p) => p[1]);
	expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(2 * blockH);
	const xs = l.sections[0].strokes[0].map((p) => p[0]);
	expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(noArt.width / 2);
	// Bounds grow to the art (wider + taller than the text alone), left goes past 0.
	expect(l.width).toBeGreaterThan(noArt.width);
	expect(l.left).toBeLessThan(0);
});

test('art: side and stacked anchors clear the text box; dx/dy nudge; rotate tilts', () => {
	const t = layoutTubes('HI', 'sans');
	const last = (lay: ReturnType<typeof layoutTubes>) => lay.sections[lay.sections.length - 1];
	const sideL = last(layoutTubes('HI', 'sans', { art: [{ d: RING, place: 'left' }] }));
	expect(sideL.art).toBe(0); // side pieces render after the text
	expect(Math.max(...sideL.strokes[0].map((p) => p[0]))).toBeLessThan(0);
	const rSec = last(layoutTubes('HI', 'sans', { art: [{ d: RING, place: 'right' }] }));
	expect(Math.min(...rSec.strokes[0].map((p) => p[0]))).toBeGreaterThan(t.width);
	const aSec = last(layoutTubes('HI', 'sans', { art: [{ d: RING, place: 'above' }] }));
	expect(Math.max(...aSec.strokes[0].map((p) => p[1]))).toBeLessThan(t.top);
	const nudged = last(layoutTubes('HI', 'sans', { art: [{ d: RING, place: 'left', dy: 1 }] }));
	expect(Math.min(...nudged.strokes[0].map((p) => p[1]))).toBeCloseTo(
		Math.min(...sideL.strokes[0].map((p) => p[1])) + t.height
	);
	// 45° tilt widens the square's bbox by √2.
	const flat = last(layoutTubes('HI', 'sans', { art: [{ d: RING, place: 'left' }] }));
	const tilted = last(layoutTubes('HI', 'sans', { art: [{ d: RING, place: 'left', rotate: 45 }] }));
	const bw = (s: (typeof flat.strokes)[0]) =>
		Math.max(...s.map((p) => p[0])) - Math.min(...s.map((p) => p[0]));
	expect(bw(tilted.strokes[0]) / bw(flat.strokes[0])).toBeCloseTo(Math.SQRT2, 1);
});

test('opaque art cuts the tubes behind it, shy of its edge (the dice pair)', () => {
	const SQ: [number, number][][] = [
		[
			[0, 0],
			[10, 0],
			[10, 10],
			[0, 10],
			[0, 0]
		]
	];
	// Two same-size squares centred on the text block, the front one half a block
	// right and opaque — it covers the rear square's right side.
	const l = layoutTubes('HI', 'sans', {
		art: [
			{ d: SQ, place: 'behind' },
			{ d: SQ, place: 'behind', dx: 0.5, opaque: true }
		]
	});
	const rear = l.sections.find((s) => s.art === 0)!;
	const front = l.sections.find((s) => s.art === 1)!;
	expect(front.strokes[0].length).toBe(5); // the face itself is never cut
	expect(rear.strokes.length).toBeGreaterThanOrEqual(2); // the ring split at the cover
	const frontMinX = Math.min(...front.strokes[0].map((p) => p[0]));
	for (const s of rear.strokes) for (const [x] of s) expect(x).toBeLessThan(frontMinX); // nothing survives under the face

	// Without `opaque`, overlap is just paint order — nothing is cut.
	const soft = layoutTubes('HI', 'sans', {
		art: [
			{ d: SQ, place: 'behind' },
			{ d: SQ, place: 'behind', dx: 0.5 }
		]
	});
	expect(soft.sections.find((s) => s.art === 0)!.strokes[0].length).toBe(5);
});

test('opaque art: a fully covered tube is dropped; a dived end keeps no electrode', () => {
	const SQ: [number, number][][] = [
		[
			[0, 0],
			[10, 0],
			[10, 10],
			[0, 10],
			[0, 0]
		]
	];
	const gone = layoutTubes('HI', 'sans', {
		art: [
			{ d: SQ, place: 'behind', size: 0.4 },
			{ d: SQ, place: 'behind', opaque: true }
		]
	});
	expect(gone.sections.some((s) => s.art === 0)).toBe(false);
	expect(gone.sections.some((s) => s.art === 1)).toBe(true);

	// An open run whose right half dives behind the face: one electrode remains,
	// on the outer (left) end.
	const openRun: [number, number][][] = [
		[
			[0, 0],
			[40, 4]
		]
	];
	const l = layoutTubes('HI', 'sans', {
		art: [
			{ d: openRun, place: 'behind', size: 0.2 },
			{ d: SQ, place: 'behind', dx: 0.5, opaque: true }
		]
	});
	const run = l.sections.find((s) => s.art === 0)!;
	expect(run.ends.length).toBe(1);
	const minX = Math.min(...run.strokes.flat().map((p) => p[0]));
	expect(run.ends[0].x).toBeCloseTo(minX);
});

test('art: a shared frame keeps sibling pieces registered', () => {
	// Two pieces cut from one 100×100 drawing: without `frame` each would scale
	// to its own bbox; with it, their coordinates stay in the same space.
	const a: [number, number][][] = [
		[
			[0, 0],
			[10, 10]
		]
	];
	const b: [number, number][][] = [
		[
			[90, 90],
			[100, 100]
		]
	];
	const l = layoutTubes('HI', 'sans', {
		art: [
			{ d: a, place: 'behind', size: 1, frame: [100, 100] },
			{ d: b, place: 'behind', size: 1, frame: [100, 100] }
		]
	});
	const [pa, pb] = [l.sections[0].strokes[0], l.sections[1].strokes[0]];
	// Frame corners map symmetrically about the shared centre: a's (0,0) and
	// b's (100,100) must be point reflections through it.
	const cx = (pa[0][0] + pb[1][0]) / 2;
	const cy = (pa[0][1] + pb[1][1]) / 2;
	expect(pa[1][0] + pb[0][0]).toBeCloseTo(2 * cx); // (10,10) vs (90,90) too
	expect(pa[1][1] + pb[0][1]).toBeCloseTo(2 * cy);
	// And both pieces share one scale: equal-length segments stay equal.
	const len = (p: [number, number][]) => Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]);
	expect(len(pa)).toBeCloseTo(len(pb));
});

test("art: SVG path data accepted; tubes 'path' splits per subpath", () => {
	const one = layoutTubes('', 'sans', { art: [{ d: 'M0 0L10 0M0 5L10 5' }] });
	expect(one.sections.length).toBe(1); // whole piece = one tube
	expect(one.sections[0].strokes.length).toBe(2);
	const per = layoutTubes('', 'sans', { art: [{ d: 'M0 0L10 0M0 5L10 5', tubes: 'path' }] });
	expect(per.sections.length).toBe(2);
	expect(per.sections.every((s) => s.art === 0)).toBe(true);
});

const runLen = (s: [number, number][]) =>
	s.reduce((a, p, k) => (k ? a + Math.hypot(p[0] - s[k - 1][0], p[1] - s[k - 1][1]) : 0), 0);

test('crossover: a section threads onto one tube and the hops come back painted', () => {
	const plain = layoutTubes('OPEN', 'sans', { tubes: 'word' });
	const wired = layoutTubes('OPEN', 'sans', { tubes: 'word', crossover: 'direct' });
	expect(plain.sections[0].painted).toBeUndefined(); // plain wiring carries no paint
	const sec = wired.sections[0];
	expect(sec.painted).toHaveLength(sec.strokes.length);
	// Every painted run bridges the glass either side of it — its ends ARE its
	// neighbours' ends, which is what makes the tube continuous.
	sec.painted!.forEach((isPaint, i) => {
		if (!isPaint) return;
		const before = sec.strokes[i - 1];
		const after = sec.strokes[i + 1];
		const run = sec.strokes[i];
		expect(before[before.length - 1]).toEqual(run[0]);
		expect(after[0]).toEqual(run[run.length - 1]);
	});
	// The glass itself is untouched: same runs, same total length, either wiring.
	const glass = (l: NeonLayout) =>
		l.sections[0].strokes
			.filter((_, i) => !l.sections[0].painted?.[i])
			.reduce((sum, s) => sum + runLen(s), 0);
	expect(glass(wired)).toBeCloseTo(glass(plain), 3);
	// Still one electrode pair: the joints in between are glass under paint.
	expect(sec.ends).toHaveLength(2);
	expect(wired.width).toBeCloseTo(plain.width);
});

test('crossover: strokes that already meet need no run; the rail drops below the line', () => {
	// The sans N bends as one continuous run — stem, diagonal, stem — so threading
	// it asks for no paint at all.
	const n = layoutTubes('N', 'sans', { crossover: 'direct' }).sections[0];
	expect(n.painted?.some(Boolean) ?? false).toBe(false);
	// The E has to double back, and the rail takes those returns under the baseline.
	const deepestPaint = (sec: TubeSection) =>
		Math.max(
			...sec.strokes.flatMap((s, i) => (sec.painted?.[i] ? s.map(([, y]) => y) : [-Infinity]))
		);
	const direct = layoutTubes('OPEN', 'sans', { tubes: 'word', crossover: 'direct' }).sections[0];
	const rail = layoutTubes('OPEN', 'sans', { tubes: 'word', crossover: 'rail' }).sections[0];
	expect(deepestPaint(rail)).toBeGreaterThan(deepestPaint(direct));
	expect(deepestPaint(rail)).toBeGreaterThan(0); // under the baseline, where a shop runs them
});

test('crossover: an opaque face cuts painted runs with their flags', () => {
	const l = layoutTubes('OPEN', 'sans', {
		tubes: 'word',
		crossover: 'direct',
		art: [{ d: 'M-40 -30L40 -30 40 30 -40 30Z', place: 'behind', size: 1.2, opaque: true }]
	});
	for (const sec of l.sections)
		if (sec.painted) expect(sec.painted).toHaveLength(sec.strokes.length);
});
