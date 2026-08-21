// The render path and the envelope physics on a real canvas (headless chromium).
// Everything the package claims that a font or a CSS filter cannot do is asserted here
// by reading pixels back: the persistence tail, the panel dimmer, the self-test, the
// filter glass, and the dim-grid-column failure.
import { afterEach, expect, test } from 'vitest';

import { createVfdPanel, type VfdElement, type VfdPanelOptions } from '../index';

let cleanup: (() => void)[] = [];
afterEach(() => {
	for (const fn of cleanup) fn();
	cleanup = [];
});

const FRAME: [number, number] = [320, 64];

function mount(opts: VfdPanelOptions = {}) {
	const canvas = document.createElement('canvas');
	canvas.style.width = '320px';
	canvas.style.height = '64px';
	document.body.appendChild(canvas);
	// Self-test off by default here: it drives every anode for a second, which would
	// swamp every other assertion. It gets its own test.
	const panel = createVfdPanel(canvas, { frame: FRAME, selfTest: false, ...opts });
	if (!panel) throw new Error('no 2d context');
	cleanup.push(() => {
		panel.dispose();
		canvas.remove();
	});
	return { canvas, panel };
}

/** Total RGB energy over a device-pixel box (defaults to the whole canvas). */
function energy(canvas: HTMLCanvasElement, box?: { x: number; y: number; w: number; h: number }) {
	const g = canvas.getContext('2d')!;
	const b = box ?? { x: 0, y: 0, w: canvas.width, h: canvas.height };
	const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(b.x)));
	const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(b.y)));
	const w = Math.max(1, Math.min(canvas.width - x, Math.floor(b.w)));
	const h = Math.max(1, Math.min(canvas.height - y, Math.floor(b.h)));
	const img = g.getImageData(x, y, w, h);
	let sum = 0;
	for (let i = 0; i < img.data.length; i += 4)
		sum += img.data[i] + img.data[i + 1] + img.data[i + 2];
	return sum;
}

function channels(canvas: HTMLCanvasElement) {
	const g = canvas.getContext('2d')!;
	const img = g.getImageData(0, 0, canvas.width, canvas.height);
	let r = 0;
	let gr = 0;
	let b = 0;
	for (let i = 0; i < img.data.length; i += 4) {
		r += img.data[i];
		gr += img.data[i + 1];
		b += img.data[i + 2];
	}
	return { r, g: gr, b };
}

/** An element's box converted from CSS pixels to device pixels. */
function deviceBox(
	canvas: HTMLCanvasElement,
	rect: { left: number; top: number; width: number; height: number }
) {
	const k = canvas.width / parseFloat(canvas.style.width);
	return { x: rect.left * k, y: rect.top * k, w: rect.width * k, h: rect.height * k };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const frames = (n: number) =>
	new Promise<void>((res) => {
		let i = 0;
		const tick = () => (++i >= n ? res() : requestAnimationFrame(tick));
		requestAnimationFrame(tick);
	});

const DIGITS: VfdElement[] = [
	{ kind: 'digits', name: 'main', chars: 4, glyphs: '16seg', x: 10, y: 10, w: 140, h: 40 }
];
const SPECTRUM: VfdElement[] = [
	{ kind: 'bars', name: 'spec', bands: 12, rows: 8, x: 0, y: 0, w: 320, h: 64 }
];

test('a driven character field lights pixels; a blank one falls back to glass', () => {
	const { canvas, panel } = mount({ layout: DIGITS, persistence: 0 });
	panel.set('main', '8888');
	const lit = energy(canvas);
	panel.set('main', '');
	const blank = energy(canvas);
	expect(lit).toBeGreaterThan(0);
	// Blank is not black — the undriven phosphor and the glass are still there.
	expect(blank).toBeGreaterThan(0);
	expect(blank).toBeLessThan(lit * 0.6);
});

test('phosphor persistence leaves a tail after the drive stops', async () => {
	// The headline claim, measured two ways: with persistence the panel is still glowing
	// a few frames after the drive is cut, and without it the same panel has already
	// gone dark. Same layout, same levels, same timings.
	const full = Array.from({ length: 12 }, () => 1);

	const lingering = mount({ layout: SPECTRUM, persistence: 0.6 });
	lingering.panel.setBars('spec', full);
	await wait(120);
	const litE = energy(lingering.canvas);
	lingering.panel.setBars('spec', new Array(12).fill(0));
	await frames(3);
	const tailE = energy(lingering.canvas);
	await wait(900);
	const restE = energy(lingering.canvas);

	// Still glowing a few frames after the drive stopped...
	expect(tailE).toBeGreaterThan(restE * 1.4);
	// ...on its way down from full, and eventually all the way down.
	expect(tailE).toBeLessThan(litE);
	expect(restE).toBeLessThan(litE * 0.6);

	const snappy = mount({ layout: SPECTRUM, persistence: 0 });
	snappy.panel.setBars('spec', full);
	await wait(120);
	const snapLit = energy(snappy.canvas);
	snappy.panel.setBars('spec', new Array(12).fill(0));
	await frames(3);
	const snapTail = energy(snappy.canvas);

	// A zero-persistence panel is already at its floor where the other one still glows.
	expect(snapTail / snapLit).toBeLessThan(tailE / litE);
});

test('a tail decays all the way to nothing, leaving no permanent residue', async () => {
	// The failure this guards: a tail that asymptotes to a small non-zero level would
	// leave every character field permanently ghosting its previous value, which reads as
	// a blurry panel that never resolves. Nothing may survive the decay.
	const { canvas, panel } = mount({
		persistence: 0.6,
		layout: [
			{ kind: 'digits', name: 'txt', chars: 8, glyphs: 'matrix', x: 10, y: 16, w: 260, h: 30 }
		]
	});
	const floor = energy(canvas); // never driven at all
	panel.set('txt', 'MMMMMMMM'); // the densest glyph in the face
	await wait(200);
	const lit = energy(canvas);
	expect(lit).toBeGreaterThan(floor * 1.2);
	panel.set('txt', '');
	await wait(1500);
	// Back to the untouched floor, to within rounding — not merely dimmer.
	expect(energy(canvas)).toBeLessThan(floor * 1.02);
});

test('the dimmer pulls the whole panel down together, and 0 is not blank', () => {
	const { canvas, panel } = mount({ layout: DIGITS, persistence: 0 });
	panel.set('main', '8888');
	const bright = energy(canvas);
	panel.setOptions({ brightness: 0.55 });
	const mid = energy(canvas);
	panel.setOptions({ brightness: 0.25 });
	const low = energy(canvas);
	panel.setOptions({ brightness: 0 });
	const off = energy(canvas);
	expect(mid).toBeLessThan(bright);
	expect(low).toBeLessThan(mid);
	expect(off).toBeLessThan(low);
	// DISPLAY OFF still shows the glass, the ghosts and the silkscreen.
	expect(off).toBeGreaterThan(0);
});

test('the self-test lights every anode, then settles to what is shown', async () => {
	const { canvas, panel } = mount({ layout: DIGITS, persistence: 0.2 });
	panel.set('main', '1');
	await wait(120);
	const showing = energy(canvas);
	panel.selfTest();
	await wait(200);
	const testing = energy(canvas);
	// Everything on is brighter than a single '1'.
	expect(testing).toBeGreaterThan(showing * 1.5);
	await wait(1400);
	const settled = energy(canvas);
	expect(settled).toBeLessThan(testing * 0.8);
});

test('power off keeps the glass and its ghosts, and drives nothing', () => {
	const { canvas, panel } = mount({ layout: DIGITS, persistence: 0 });
	panel.set('main', '8888');
	const on = energy(canvas);
	panel.power(false);
	const off = energy(canvas);
	expect(off).toBeGreaterThan(0);
	expect(off).toBeLessThan(on * 0.6);
});

test('a scale cursor drives exactly one block, wherever it is pointed', () => {
	const { canvas, panel } = mount({
		layout: [{ kind: 'scale', name: 'tune', steps: 12, x: 0, y: 0, w: 320, h: 40 }],
		persistence: 0
	});
	panel.set('tune', 0);
	const leftBox = deviceBox(canvas, { left: 0, top: 0, width: 40, height: 64 });
	const rightBox = deviceBox(canvas, { left: 280, top: 0, width: 40, height: 64 });
	const leftLit = energy(canvas, leftBox);
	const rightDark = energy(canvas, rightBox);
	panel.set('tune', 1);
	const leftDark = energy(canvas, leftBox);
	const rightLit = energy(canvas, rightBox);
	expect(leftLit).toBeGreaterThan(leftDark);
	expect(rightLit).toBeGreaterThan(rightDark);
});

test('the filter glass tints the whole envelope', () => {
	const green = mount({ layout: DIGITS, persistence: 0, filter: 'green' });
	green.panel.set('main', '8888');
	const g = channels(green.canvas);
	const smoke = mount({ layout: DIGITS, persistence: 0, filter: 'smoke' });
	smoke.panel.set('main', '8888');
	const s = channels(smoke.canvas);
	// Green plastic pushes the light green: the green channel dominates red harder than
	// it does behind neutral smoke.
	expect(g.g / Math.max(1, g.r)).toBeGreaterThan(s.g / Math.max(1, s.r));
});

test('a dots area paints a bitmap, with real grey levels', () => {
	// The graphic path: individually addressable dots, fed an image rather than characters,
	// and fractional values kept as fractional — a multiplexed anode dims by duty cycle, so
	// this needs no dithering.
	const { canvas, panel } = mount({
		persistence: 0,
		layout: [{ kind: 'dots', name: 'screen', cols: 8, rows: 4, x: 20, y: 8, w: 280, h: 48 }]
	});
	const dark = energy(canvas);
	// Top half on, bottom half off — and the top half must be the one that lights, because
	// row 0 is the TOP (raster order), unlike `bars`.
	panel.setDots('screen', (_x, y) => (y < 2 ? 1 : 0));
	const box = deviceBox(canvas, panel.elementRect('screen')!);
	const top = { ...box, h: box.h / 2 };
	const bottom = { ...box, y: box.y + box.h / 2, h: box.h / 2 };
	expect(energy(canvas, top)).toBeGreaterThan(energy(canvas, bottom) * 1.5);

	// Full on is brighter than half on, which is brighter than dark: the levels are real.
	panel.setDots('screen', () => 1);
	const full = energy(canvas);
	panel.setDots('screen', () => 0.35);
	const half = energy(canvas);
	expect(full).toBeGreaterThan(half);
	expect(half).toBeGreaterThan(dark);

	// A flat array works too, row-major from the top-left.
	panel.setDots('screen', new Float32Array(32).fill(1));
	expect(energy(canvas)).toBeGreaterThan(half);
});

test('a zone puts its own window over a region of the glass', () => {
	// The amber band across a level meter on an otherwise green panel. A zone belongs to the
	// PANEL because that is what it is — plastic over a rectangle — not to whichever element
	// happens to sit under it.
	const { canvas, panel } = mount({
		persistence: 0,
		filter: 'green',
		zones: [{ x: 190, y: 10, w: 80, h: 44, filter: 'amber' }],
		layout: [
			{ kind: 'digits', name: 'left', chars: 2, glyphs: '7seg', x: 20, y: 16, w: 60, h: 32 },
			{ kind: 'digits', name: 'right', chars: 2, glyphs: '7seg', x: 200, y: 16, w: 60, h: 32 }
		]
	});
	panel.set('left', '88');
	panel.set('right', '88');
	const warmth = (name: string) => {
		const g = canvas.getContext('2d')!;
		const b = deviceBox(canvas, panel.elementRect(name)!);
		const img = g.getImageData(Math.floor(b.x), Math.floor(b.y), Math.floor(b.w), Math.floor(b.h));
		let r = 0;
		let bl = 0;
		for (let i = 0; i < img.data.length; i += 4) {
			r += img.data[i];
			bl += img.data[i + 2];
		}
		return r / Math.max(1, bl);
	};
	// The digits inside the zone run redder against blue than the ones outside it.
	expect(warmth('right')).toBeGreaterThan(warmth('left') * 1.2);

	// And it can be changed without re-declaring the hardware.
	panel.setOptions({ zones: [] });
	expect(warmth('right')).toBeLessThan(warmth('left') * 1.2);
});

test('wear dims the panel and bands one multiplex column', () => {
	// The failure mode that belongs to vacuum fluorescence: a weak grid drags a vertical
	// stripe of the panel down, cutting across whatever sits in it. Measured as the
	// spread of per-column energy over a field that is uniform when healthy.
	const spread = (canvas: HTMLCanvasElement) => {
		const cols = 24;
		const step = canvas.width / cols;
		const es = Array.from({ length: cols }, (_, i) =>
			energy(canvas, { x: i * step, y: 0, w: step, h: canvas.height })
		);
		const mean = es.reduce((a, b) => a + b, 0) / cols;
		const varr = es.reduce((a, b) => a + (b - mean) ** 2, 0) / cols;
		return { mean, cv: Math.sqrt(varr) / Math.max(1, mean) };
	};
	const full = Array.from({ length: 12 }, () => 1);

	const fresh = mount({ layout: SPECTRUM, persistence: 0, age: 0 });
	fresh.panel.setBars('spec', full);
	const worn = mount({ layout: SPECTRUM, persistence: 0, age: 0.8 });
	worn.panel.setBars('spec', full);

	const f = spread(fresh.canvas);
	const wq = spread(worn.canvas);
	expect(wq.mean).toBeLessThan(f.mean); // wear dims
	expect(wq.cv).toBeGreaterThan(f.cv); // and does it unevenly, by column
});

test('elementAt maps a viewport point onto an element, and skips silkscreen', () => {
	const { canvas, panel } = mount({
		layout: [
			{ kind: 'rule', name: 'surround', shape: 'box', x: 0, y: 0, w: 320, h: 64 },
			{ kind: 'digits', name: 'main', chars: 4, glyphs: '7seg', x: 10, y: 10, w: 120, h: 40 },
			{ kind: 'legend', name: 'st', text: 'ST', x: 200, y: 10, w: 30, h: 12 }
		],
		persistence: 0
	});
	const r = canvas.getBoundingClientRect();
	const hit = (name: string) => {
		const box = panel.elementRect(name)!;
		return panel.elementAt(r.left + box.left + box.width / 2, r.top + box.top + box.height / 2);
	};
	expect(hit('main')).toBe('main');
	expect(hit('st')).toBe('st');
	// The rule box covers the whole panel but must never answer — it is ink, and a
	// tap meant for what it surrounds has to reach through it.
	expect(hit('surround')).not.toBe('surround');
	expect(panel.elementAt(r.left - 50, r.top - 50)).toBe(null);
});

test('elementRect reports where the anodes actually are, in CSS pixels', () => {
	const { canvas, panel } = mount({ layout: DIGITS, persistence: 0 });
	const box = panel.elementRect('main')!;
	const cssW = parseFloat(canvas.style.width);
	const cssH = parseFloat(canvas.style.height);
	// The frame is fitted inside the faceplate, so the rect is scaled and offset. It
	// reports the INK, not the declared box, so it comes out a shade tighter than the
	// 140×40 that was asked for — and it stays on the canvas.
	expect(box.width / box.height).toBeGreaterThan(2.5);
	expect(box.width / box.height).toBeLessThan(4.5);
	expect(box.left).toBeGreaterThan(0);
	expect(box.top).toBeGreaterThan(0);
	expect(box.left + box.width).toBeLessThanOrEqual(cssW);
	expect(box.top + box.height).toBeLessThanOrEqual(cssH);
	expect(panel.elementRect('nope')).toBe(null);
});

test('the faceplate hugs the glass instead of filling the canvas', () => {
	// A box far taller than a 320×64 frame: faceplate around the glass, page past it.
	const canvas = document.createElement('canvas');
	canvas.style.width = '320px';
	canvas.style.height = '320px';
	document.body.appendChild(canvas);
	const panel = createVfdPanel(canvas, { frame: FRAME, selfTest: false, layout: DIGITS })!;
	cleanup.push(() => {
		panel.dispose();
		canvas.remove();
	});
	const alphaAt = (x: number, y: number) =>
		canvas.getContext('2d')!.getImageData(x, y, 1, 1).data[3];
	expect(alphaAt(2, 2)).toBe(0);
	expect(alphaAt(canvas.width >> 1, 2)).toBe(0);
	// The plate itself is opaque, just above the glass.
	const box = panel.elementRect('main')!;
	const dpr = canvas.width / 320;
	expect(alphaAt(canvas.width >> 1, Math.round((box.top - 4) * dpr))).toBe(255);
});

test('an icon placed in a shared frame does not claim the whole panel', () => {
	// An `icon` in a shared design frame takes the whole frame as its box, so hit-testing
	// that box would have it answer for every tap on the glass and the last such icon would
	// swallow the lot. Pointer maths uses the anodes' real extent instead.
	const shared: [number, number] = [320, 64];
	const { canvas, panel } = mount({
		persistence: 0,
		layout: [
			{ kind: 'digits', name: 'main', chars: 4, glyphs: '7seg', x: 10, y: 10, w: 80, h: 40 },
			// No box at all: with a shared frame, the path coordinates ARE frame coordinates.
			{ kind: 'icon', name: 'mark', d: 'M280 40 L300 40 L300 56 L280 56 Z', frame: shared }
		]
	});
	const r = canvas.getBoundingClientRect();
	const rect = panel.elementRect('mark')!;
	// Its rect is the little block, not the 320×64 frame it was placed in.
	expect(rect.width).toBeLessThan(parseFloat(canvas.style.width) * 0.2);
	// And a tap on the character field reaches the character field.
	const main = panel.elementRect('main')!;
	expect(
		panel.elementAt(r.left + main.left + main.width / 2, r.top + main.top + main.height / 2)
	).toBe('main');
	// …while a tap on the block reaches the block.
	expect(
		panel.elementAt(r.left + rect.left + rect.width / 2, r.top + rect.top + rect.height / 2)
	).toBe('mark');
});

test('a re-compiled layout keeps what the panel was already showing', () => {
	const { canvas, panel } = mount({ layout: DIGITS, persistence: 0 });
	panel.set('main', '8888');
	const before = energy(canvas);
	// Same element name, a wider box: the value must survive the re-compile.
	panel.setLayout([
		{ kind: 'digits', name: 'main', chars: 4, glyphs: '16seg', x: 10, y: 6, w: 200, h: 50 }
	]);
	const after = energy(canvas);
	expect(after).toBeGreaterThan(before * 0.8);
});

test('announces what it is showing, and hands the canvas back clean', () => {
	const canvas = document.createElement('canvas');
	canvas.style.width = '320px';
	canvas.style.height = '64px';
	document.body.appendChild(canvas);
	const panel = createVfdPanel(canvas, {
		frame: FRAME,
		selfTest: false,
		persistence: 0,
		layout: [
			{ kind: 'digits', name: 'main', chars: 8, glyphs: '16seg', x: 10, y: 10, w: 150, h: 40 },
			{ kind: 'legend', name: 'st', text: 'ST', x: 200, y: 10, w: 30, h: 12 }
		]
	})!;
	panel.set('main', 'FM 98.5');
	panel.light('st', true);
	expect(canvas.getAttribute('role')).toBe('img');
	expect(canvas.getAttribute('aria-label')).toContain('FM 98.5');
	expect(canvas.getAttribute('aria-label')).toContain('ST');
	panel.dispose();
	expect(canvas.getAttribute('role')).toBe(null);
	expect(canvas.getAttribute('aria-label')).toBe(null);
	canvas.remove();
});

test('survives a sub-pixel canvas and an empty layout', () => {
	const tiny = document.createElement('canvas');
	tiny.style.width = '3px';
	tiny.style.height = '2px';
	document.body.appendChild(tiny);
	expect(() => {
		const p = createVfdPanel(tiny, { frame: FRAME, layout: DIGITS, selfTest: false })!;
		p.set('main', '88');
		p.resize();
		p.dispose();
	}).not.toThrow();
	tiny.remove();

	const bare = document.createElement('canvas');
	bare.style.width = '320px';
	bare.style.height = '64px';
	document.body.appendChild(bare);
	expect(() => {
		const p = createVfdPanel(bare, { frame: FRAME, layout: [] })!;
		p.selfTest();
		p.set('nothing', 'x');
		p.setBars('nothing', [1]);
		expect(p.elementAt(0, 0)).toBe(null);
		p.dispose();
	}).not.toThrow();
	bare.remove();
});

test('snapshot returns a PNG data URL', () => {
	const { panel } = mount({ layout: DIGITS, persistence: 0 });
	panel.set('main', '12');
	expect(panel.snapshot().startsWith('data:image/png')).toBe(true);
});

test('driving an element with the wrong call warns instead of doing nothing quietly', () => {
	const warns: string[] = [];
	const real = console.warn;
	console.warn = (...args: unknown[]) => void warns.push(String(args[0]));
	try {
		const { panel } = mount({
			persistence: 0,
			layout: [
				{ kind: 'digits', name: 'main', chars: 2, glyphs: '7seg', x: 10, y: 10, w: 40, h: 30 },
				{ kind: 'bars', name: 'spec', bands: 4, rows: 4, x: 60, y: 10, w: 60, h: 30 }
			]
		});
		// Without the warning each of these is a silent no-op: the value lands in a state
		// field the element's own driver never reads.
		panel.setBars('main', [1, 1]);
		panel.set('spec', 'nope');
		panel.light('main', true);
		expect(warns.filter((w) => w.includes('is a digits element')).length).toBeGreaterThan(0);
		expect(warns.filter((w) => w.includes('is a bars element')).length).toBeGreaterThan(0);
		// Warned once per pairing, not once per call.
		const before = warns.length;
		panel.setBars('main', [1, 1]);
		expect(warns.length).toBe(before);
	} finally {
		console.warn = real;
	}
});

test('bars and dots copy what they are given, so later mutation cannot change the panel', async () => {
	const { canvas, panel } = mount({
		persistence: 0,
		layout: [
			{ kind: 'bars', name: 'spec', bands: 8, rows: 8, x: 10, y: 8, w: 140, h: 48 },
			{ kind: 'dots', name: 'screen', cols: 8, rows: 8, x: 160, y: 8, w: 140, h: 48 }
		]
	});
	const levels = new Array(8).fill(1);
	const bitmap = new Float32Array(64).fill(1);
	panel.setBars('spec', levels);
	panel.setDots('screen', bitmap);
	const lit = energy(canvas);
	expect(lit).toBeGreaterThan(0);

	// Reuse the same arrays for the next frame's data — which is what any real driver does.
	levels.fill(0);
	bitmap.fill(0);
	await wait(120);
	// Nothing was pushed, so nothing may have changed.
	expect(energy(canvas)).toBeCloseTo(lit, -2);

	// Pushing the emptied arrays does take effect.
	panel.setBars('spec', levels);
	panel.setDots('screen', bitmap);
	expect(energy(canvas)).toBeLessThan(lit * 0.7);
});

test('blank stops driving an element, including a peak cap that zeros cannot clear', async () => {
	// Why `blank` exists. Writing an all-zero level set does NOT dark a `peakHold` element:
	// the caps sag on their own, and the floor is where they stop — so one lit row stays across
	// the whole element for good. A panel whose window has two jobs (an analyser field that
	// becomes a graphic display) needs the driver to be able to actually stop.
	const { canvas, panel } = mount({
		persistence: 0,
		layout: [
			{ kind: 'bars', name: 'spec', bands: 8, rows: 8, peakHold: true, x: 10, y: 8, w: 300, h: 48 }
		]
	});
	const box = deviceBox(canvas, panel.elementRect('spec')!);
	panel.setBars('spec', new Array<number>(8).fill(1));
	const loud = energy(canvas, box);
	expect(loud).toBeGreaterThan(0);

	// Zeros: the caps fall to the floor row and park there, lit.
	panel.setBars('spec', new Array<number>(8).fill(0));
	await wait(600);
	const parked = energy(canvas, box);
	expect(parked).toBeLessThan(loud * 0.5);
	expect(parked).toBeGreaterThan(0);

	// blank(): nothing is driven, so the tail fades to the undriven ghost and stays there.
	panel.clear('spec');
	await wait(600);
	expect(energy(canvas, box)).toBeLessThan(parked * 0.6);
});

test('blank leaves a scale with no cursor at all, not a cursor at zero', async () => {
	const { canvas, panel } = mount({
		persistence: 0,
		layout: [{ kind: 'scale', name: 'tune', steps: 20, ticks: 5, x: 10, y: 20, w: 300, h: 24 }]
	});
	const box = deviceBox(canvas, panel.elementRect('tune')!);
	panel.set('tune', 0);
	const atZero = energy(canvas, box);
	panel.clear('tune');
	await wait(200);
	// Only the printed ticks are left. A cursor parked at 0 would still be a lit block.
	expect(energy(canvas, box)).toBeLessThan(atZero * 0.9);
});

test('blanking silkscreen warns — a rule is never driven', () => {
	const warns: string[] = [];
	const real = console.warn;
	console.warn = (...args: unknown[]) => void warns.push(String(args[0]));
	try {
		const { panel } = mount({
			persistence: 0,
			layout: [{ kind: 'rule', name: 'edge', shape: 'box', x: 4, y: 4, w: 300, h: 50 }]
		});
		panel.clear('edge');
		expect(warns.some((w) => w.includes('silkscreen is never driven'))).toBe(true);
	} finally {
		console.warn = real;
	}
});

test('a frame with no area fails at construction, not once a frame forever', () => {
	// Unchecked this made the scale Infinity and every coordinate NaN, and canvas threw
	// InvalidStateError from inside the render loop where nothing can catch it.
	const canvas = document.createElement('canvas');
	document.body.appendChild(canvas);
	cleanup.push(() => canvas.remove());
	expect(() => createVfdPanel(canvas, { frame: [0, 0], layout: [] })).toThrow(
		/finite positive numbers/
	);
});

test('setLayout with a bad frame throws and leaves the panel untouched', async () => {
	const { canvas, panel } = mount({
		persistence: 0,
		layout: [{ kind: 'digits', name: 'main', chars: 4, glyphs: '7seg', x: 10, y: 8, w: 200, h: 48 }]
	});
	panel.set('main', '8888');
	const lit = energy(canvas);
	expect(lit).toBeGreaterThan(0);
	expect(() =>
		panel.setLayout(
			[{ kind: 'digits', name: 'main', chars: 4, glyphs: '7seg', x: 10, y: 8, w: 200, h: 48 }],
			[0, 0]
		)
	).toThrow(/finite positive numbers/);
	// Still the old hardware, still showing what it was showing.
	await wait(60);
	expect(energy(canvas)).toBeCloseTo(lit, -3);
	expect(panel.elementRect('main')).not.toBeNull();
});

test('clear() with no name stops the whole panel but leaves the silkscreen', async () => {
	// Matches the family: flip-dot and split-flap both have a no-argument clear().
	const { canvas, panel } = mount({
		persistence: 0,
		layout: [
			{ kind: 'digits', name: 'main', chars: 3, glyphs: '7seg', x: 8, y: 8, w: 90, h: 44 },
			{
				kind: 'bars',
				name: 'spec',
				bands: 6,
				rows: 6,
				peakHold: true,
				x: 110,
				y: 8,
				w: 120,
				h: 44
			},
			{ kind: 'legend', name: 'st', text: 'ST', x: 240, y: 10, w: 20, h: 10 },
			{ kind: 'rule', name: 'edge', shape: 'box', x: 4, y: 4, w: 300, h: 52 }
		]
	});
	panel.set('main', '888');
	panel.setBars('spec', new Array<number>(6).fill(1));
	panel.light('st', true);
	const lit = energy(canvas);
	expect(lit).toBeGreaterThan(0);

	panel.clear();
	await wait(400);
	const dark = energy(canvas);
	expect(dark).toBeLessThan(lit * 0.4);
	// The rule is ink, so something is still on the glass — clear() is not a blank canvas.
	expect(dark).toBeGreaterThan(0);
	// And it can be driven again straight afterwards.
	panel.set('main', '888');
	expect(energy(canvas)).toBeGreaterThan(dark);
});

test('theme light puts a brushed-silver plate round the same dark glass', () => {
	const canvas = document.createElement('canvas');
	canvas.style.width = '320px';
	canvas.style.height = '200px'; // taller than the frame: the plate shows
	document.body.appendChild(canvas);
	// persistence 0 so every setOptions settles synchronously, like the other tests.
	const panel = createVfdPanel(canvas, {
		frame: FRAME,
		selfTest: false,
		layout: DIGITS,
		persistence: 0,
		theme: 'light'
	})!;
	cleanup.push(() => {
		panel.dispose();
		canvas.remove();
	});
	// The plate is the module's own top edge: walk the centre column to the first
	// opaque pixel and read two rows in.
	const plate = () => {
		const x = canvas.width >> 1;
		const col = canvas.getContext('2d')!.getImageData(x, 0, 1, canvas.height).data;
		for (let y = 0; y < canvas.height; y++)
			if (col[y * 4 + 3] > 250) {
				const i = (y + 2) * 4;
				return col[i] + col[i + 1] + col[i + 2];
			}
		return -1;
	};
	const silver = plate();
	expect(silver).toBeGreaterThan(400);
	panel.setOptions({ theme: 'dark' });
	expect(plate()).toBeLessThan(silver);
	// A plate the consumer named never moves again.
	panel.setOptions({ bezel: '#ff0000', theme: 'light' });
	const named = plate();
	panel.setOptions({ theme: 'dark' });
	expect(plate()).toBe(named);
});
