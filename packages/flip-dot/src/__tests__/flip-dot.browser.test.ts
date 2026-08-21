import { expect, test } from 'vitest';

import { createFlipDots } from '../flip-dot';

// Count pixels noticeably brighter than the board/off discs (the lit face is
// fluorescent yellow-green — the dark parts never get near this threshold).
const litPixels = (canvas: HTMLCanvasElement): number => {
	const ctx = canvas.getContext('2d')!;
	const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
	let n = 0;
	for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 240) n++;
	return n;
};

const makeCanvas = (w = 280, h = 140) => {
	const canvas = document.createElement('canvas');
	canvas.style.width = `${w}px`;
	canvas.style.height = `${h}px`;
	document.body.appendChild(canvas);
	return canvas;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('mounts, sets ARIA, and lights dots (flipMs 0 reads back synchronously)', () => {
	const canvas = makeCanvas();
	const board = createFlipDots(canvas, { cols: 14, rows: 7, flipMs: 0 });
	expect(board).not.toBeNull();
	if (!board) return;
	expect(canvas.getAttribute('role')).toBe('img');
	expect(canvas.getAttribute('aria-label')).toBe('flip-dot display');
	const dark = litPixels(canvas);
	board.fill();
	expect(litPixels(canvas)).toBeGreaterThan(dark);
	board.clear();
	expect(litPixels(canvas)).toBe(dark);
	board.dispose();
	canvas.remove();
});

test('set/get address the grid; out-of-bounds is a no-op', () => {
	const canvas = makeCanvas();
	const board = createFlipDots(canvas, { cols: 4, rows: 4, flipMs: 0 })!;
	board.set(1, 2, true);
	expect(board.get(1, 2)).toBe(true);
	expect(board.get(0, 0)).toBe(false);
	expect(() => {
		board.set(-1, 0, true);
		board.set(4, 99, true);
	}).not.toThrow();
	expect(board.get(-1, 0)).toBe(false);
	board.dispose();
	canvas.remove();
});

test('the flip is animated: mid-flight the board is not yet settled', async () => {
	const canvas = makeCanvas();
	const board = createFlipDots(canvas, {
		cols: 10,
		rows: 5,
		flipMs: 300,
		stagger: 'none'
	})!;
	board.fill();
	// Immediately after the command the discs have barely moved…
	const early = litPixels(canvas);
	await sleep(700);
	// …and well after flipMs they have all arrived.
	const settled = litPixels(canvas);
	expect(settled).toBeGreaterThan(early);
	expect(settled).toBeGreaterThan(0);
	board.dispose();
	canvas.remove();
});

test('scan stagger sweeps top rows before bottom rows', async () => {
	const canvas = makeCanvas(280, 280);
	const board = createFlipDots(canvas, {
		cols: 8,
		rows: 8,
		flipMs: 40,
		stagger: 'scan',
		scanMs: 900
	})!;
	board.fill();
	await sleep(300); // inside the sweep: the top has flipped, the bottom hasn't
	const ctx = canvas.getContext('2d')!;
	const half = Math.floor(canvas.height / 2);
	const bright = (y0: number, y1: number) => {
		const px = ctx.getImageData(0, y0, canvas.width, y1 - y0).data;
		let s = 0;
		for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 240) s++;
		return s;
	};
	const top = bright(0, half);
	const bottom = bright(half, canvas.height);
	expect(top).toBeGreaterThan(bottom);
	await sleep(900);
	expect(bright(half, canvas.height)).toBeGreaterThan(0); // the sweep does finish
	board.dispose();
	canvas.remove();
});

test('sound: no AudioContext before a user gesture, then exactly one, shared', async () => {
	const RealAC = window.AudioContext;
	let constructed = 0;
	window.AudioContext = class extends RealAC {
		constructor(...args: ConstructorParameters<typeof AudioContext>) {
			super(...args);
			constructed++;
		}
	};
	const realActivation = Object.getOwnPropertyDescriptor(Navigator.prototype, 'userActivation');
	try {
		// 1. Sound off → nothing, ever.
		const canvas = makeCanvas();
		const board = createFlipDots(canvas, { cols: 6, rows: 3, flipMs: 20 })!;
		board.fill();
		await sleep(150);
		expect(constructed).toBe(0);

		// 2. Sound ON but the page has never seen a gesture → still nothing: a
		//    pre-gesture context would sit suspended and burn a slot on a host
		//    page already running its own audio.
		Object.defineProperty(navigator, 'userActivation', {
			value: { hasBeenActive: false, isActive: false },
			configurable: true
		});
		board.setOptions({ sound: 0.5 });
		board.clear();
		await sleep(150);
		expect(constructed).toBe(0);

		// 3. After the page has a gesture, the first flip boots exactly ONE
		//    context — and a second sound-enabled board SHARES it.
		Object.defineProperty(navigator, 'userActivation', {
			value: { hasBeenActive: true, isActive: false },
			configurable: true
		});
		board.fill();
		await sleep(150);
		expect(constructed).toBe(1);

		const canvas2 = makeCanvas();
		const board2 = createFlipDots(canvas2, { cols: 6, rows: 3, flipMs: 20, sound: 0.5 })!;
		board2.fill();
		await sleep(150);
		expect(constructed).toBe(1); // still the shared one

		// Disposing releases the channels without throwing (the last one closes the
		// shared context; autoplay may have kept it suspended — also fine).
		board.dispose();
		board2.dispose();
		canvas.remove();
		canvas2.remove();
	} finally {
		window.AudioContext = RealAC;
		delete (navigator as { userActivation?: unknown }).userActivation;
		if (realActivation)
			Object.defineProperty(Navigator.prototype, 'userActivation', realActivation);
	}
});

/** A rect's centre, as dotAt's two arguments. */
const mid = (b: { left: number; top: number; width: number; height: number }): [number, number] => [
	b.left + b.width / 2,
	b.top + b.height / 2
];

const alphaAt = (canvas: HTMLCanvasElement, x: number, y: number) =>
	canvas.getContext('2d')!.getImageData(x, y, 1, 1).data[3];

test('dotAt and dotRect expose the layout maths', () => {
	const canvas = makeCanvas(280, 140); // a 14 × 7 field and its plastic margin
	const board = createFlipDots(canvas, { cols: 14, rows: 7, flipMs: 0 })!;
	const r = canvas.getBoundingClientRect();
	const first = board.dotRect(0, 0)!;
	const cell = board.dotRect(1, 0)!.left - first.left;
	// A disc centre round-trips to its own dot, at both ends of the field...
	expect(board.dotAt(...mid(first))).toEqual({ x: 0, y: 0 });
	expect(board.dotAt(...mid(board.dotRect(13, 6)!))).toEqual({ x: 13, y: 6 });
	// ...and the margin around the field is plastic, not a dot.
	expect(board.dotAt(r.left + 1, r.top + 1)).toBeNull();
	expect(board.dotAt(r.left - 5, r.top + 5)).toBeNull(); // off the canvas
	const c = board.dotRect(3, 2)!;
	// The disc sits inside its own cell (the gap is excluded).
	expect(c.left).toBeCloseTo(first.left + 3 * cell, 3);
	expect(c.width).toBeLessThan(cell);
	expect(board.dotAt(...mid(c))).toEqual({ x: 3, y: 2 });
	expect(board.dotRect(14, 0)).toBeNull();
	expect(board.dotRect(NaN, 0)).toBeNull();
	board.dispose();
	canvas.remove();

	// A canvas wider than its grid centres the board — the plastic margin
	// beside the discs is not a dot.
	const wide = makeCanvas(320, 140);
	const b2 = createFlipDots(wide, { cols: 14, rows: 7, flipMs: 0 })!;
	const r2 = wide.getBoundingClientRect();
	expect(b2.dotAt(r2.left + 5, r2.top + 70)).toBeNull(); // in the margin
	expect(b2.dotAt(...mid(b2.dotRect(0, 3)!))).toEqual({ x: 0, y: 3 });
	b2.dispose();
	wide.remove();
});

test('the panel hugs the dot field, and board: null paints no plastic', () => {
	// A canvas far taller than a 14 × 7 board: page above and below, no letterbox.
	const tall = makeCanvas(280, 400);
	const board = createFlipDots(tall, { cols: 14, rows: 7, flipMs: 0 })!;
	expect(alphaAt(tall, 2, 2)).toBe(0);
	expect(alphaAt(tall, tall.width >> 1, 2)).toBe(0);
	// The plastic is there, just above the top row of discs.
	const r = tall.getBoundingClientRect();
	const dpr = tall.width / r.width;
	const top = board.dotRect(0, 0)!.top - r.top;
	expect(alphaAt(tall, tall.width >> 1, Math.round((top - 2) * dpr))).toBe(255);
	board.dispose();
	tall.remove();

	// No plastic at all: the discs sit straight on the page.
	const bare = makeCanvas(280, 140);
	const b2 = createFlipDots(bare, { cols: 14, rows: 7, flipMs: 0, board: null })!;
	expect(alphaAt(bare, 1, 1)).toBe(0);
	b2.dispose();
	bare.remove();
});

test('theme light repaints the board in the other paint job', () => {
	const canvas = makeCanvas(280, 140);
	const mean = () => {
		const d = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
		let n = 0;
		for (let i = 0; i < d.length; i += 4) n += d[i] + d[i + 1] + d[i + 2];
		return n / (d.length / 4);
	};
	const board = createFlipDots(canvas, { cols: 14, rows: 7, flipMs: 0, theme: 'light' })!;
	board.setFrame((x, y) => (x + y) % 2);
	const light = mean();
	board.setOptions({ theme: 'dark' });
	expect(mean()).toBeLessThan(light);
	// A dot colour the consumer named is theirs through every later theme move.
	board.setOptions({ onColor: '#ff0000', theme: 'light' });
	const red = () => {
		const d = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
		let n = 0;
		for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 90) n++;
		return n;
	};
	expect(red()).toBeGreaterThan(0);
	board.setOptions({ theme: 'dark' });
	expect(red()).toBeGreaterThan(0);
	board.dispose();
	canvas.remove();
});

test('dispose hands the canvas back without ARIA and stops the loop', () => {
	const canvas = makeCanvas();
	const board = createFlipDots(canvas, { cols: 4, rows: 2 })!;
	board.dispose();
	expect(canvas.getAttribute('role')).toBeNull();
	expect(canvas.getAttribute('aria-label')).toBeNull();
	expect(canvas.getAttribute('aria-hidden')).toBeNull();
	canvas.remove();
});

test('a sub-5px canvas degrades instead of throwing (the 1.3.1 lesson)', () => {
	const canvas = makeCanvas(3, 4);
	expect(() => {
		const board = createFlipDots(canvas, { cols: 28, rows: 14, flipMs: 0 })!;
		board.fill();
		board.resize();
		board.dispose();
	}).not.toThrow();
	canvas.remove();
});
