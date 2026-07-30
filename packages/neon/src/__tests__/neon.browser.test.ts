// The render path on a real canvas (headless chromium): lit pixels, the unlit
// glass floor, strike timing, the wear arc, per-line colours, the transparent
// wall, aria, and the flash cam. Assertions read pixels back off the 2D canvas.
import { afterEach, expect, test } from 'vitest';

import { createNeonSign, type NeonSignOptions } from '../index';

let cleanup: (() => void)[] = [];
afterEach(() => {
	for (const fn of cleanup) fn();
	cleanup = [];
});

function mount(opts: NeonSignOptions = {}) {
	const canvas = document.createElement('canvas');
	canvas.style.width = '320px';
	canvas.style.height = '160px';
	document.body.appendChild(canvas);
	const sign = createNeonSign(canvas, opts);
	if (!sign) throw new Error('no 2d context');
	cleanup.push(() => {
		sign.dispose();
		canvas.remove();
	});
	return { canvas, sign };
}

// Total RGB energy over a region (defaults to the whole canvas), sampled sparsely.
function energy(canvas: HTMLCanvasElement, y0 = 0, y1 = 1) {
	const g = canvas.getContext('2d')!;
	const img = g.getImageData(
		0,
		Math.floor(canvas.height * y0),
		canvas.width,
		Math.max(1, Math.floor(canvas.height * (y1 - y0)))
	);
	let sum = 0;
	for (let i = 0; i < img.data.length; i += 16)
		sum += img.data[i] + img.data[i + 1] + img.data[i + 2];
	return sum;
}

function channels(canvas: HTMLCanvasElement, y0: number, y1: number, x0 = 0, x1 = 1) {
	const g = canvas.getContext('2d')!;
	const img = g.getImageData(
		Math.floor(canvas.width * x0),
		Math.floor(canvas.height * y0),
		Math.max(1, Math.floor(canvas.width * (x1 - x0))),
		Math.max(1, Math.floor(canvas.height * (y1 - y0)))
	);
	let r = 0;
	let b = 0;
	for (let i = 0; i < img.data.length; i += 16) {
		r += img.data[i];
		b += img.data[i + 2];
	}
	return { r, b };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('a lit sign has lit pixels; powered off it dims to visible glass, not black', () => {
	const { canvas, sign } = mount({ text: 'ON', strikeMs: 0, wall: null });
	const litE = energy(canvas);
	expect(litE).toBeGreaterThan(0);
	sign.power(false);
	const offE = energy(canvas);
	expect(offE).toBeGreaterThan(0); // the unlit glass is still there —
	expect(offE).toBeLessThan(litE * 0.35); // — but it is glass, not glow
});

test('strikeMs 0 paints synchronously; a mid-strike frame is dimmer than settled', async () => {
	const { canvas, sign } = mount({ text: 'HI', font: 'sans', strikeMs: 800, wall: null });
	const settled = energy(canvas); // first paint lands lit, no boot animation
	expect(settled).toBeGreaterThan(0);
	sign.power(false);
	sign.power(true); // the strike show
	await wait(250); // arc + partial-ignition territory
	const mid = energy(canvas);
	await wait(1600); // every stagger and overshoot settled
	const after = energy(canvas);
	expect(mid).toBeLessThan(after * 0.75);
	expect(after).toBeGreaterThan(settled * 0.6);
});

test('age dims deterministically per instance', () => {
	const { canvas, sign } = mount({ text: 'WORN', font: 'sans', strikeMs: 0, wall: null });
	const fresh = energy(canvas);
	sign.setOptions({ age: 1 });
	const aged = energy(canvas);
	expect(aged).toBeLessThan(fresh * 0.92); // dimmed everywhere + one dead tube
	sign.setOptions({ age: 0 });
	expect(energy(canvas)).toBeGreaterThan(aged);
});

test('per-line colours land on their lines', () => {
	const { canvas } = mount({
		text: 'RED\nBLUE',
		font: 'sans',
		color: ['#ff2010', '#1040ff'],
		strikeMs: 0,
		wall: null,
		glow: 0.4
	});
	const top = channels(canvas, 0, 0.45);
	const bottom = channels(canvas, 0.55, 1);
	expect(top.r).toBeGreaterThan(top.b * 1.5);
	expect(bottom.b).toBeGreaterThan(bottom.r * 1.5);
});

test('wall: null leaves the canvas transparent outside the sign; a wall fills it', () => {
	const { canvas } = mount({ text: 'X', strikeMs: 0, wall: null });
	const g = canvas.getContext('2d')!;
	expect(g.getImageData(0, 0, 1, 1).data[3]).toBe(0); // corner alpha
	const walled = mount({ text: 'X', strikeMs: 0 });
	const wg = walled.canvas.getContext('2d')!;
	expect(wg.getImageData(0, 0, 1, 1).data[3]).toBe(255);
});

test('aria: role img, label + shown text, clean canvas after dispose', () => {
	const { canvas, sign } = mount({ text: 'NO\nVACANCY', strikeMs: 0 });
	expect(canvas.getAttribute('role')).toBe('img');
	expect(canvas.getAttribute('aria-label')).toBe('neon sign: NO / VACANCY');
	sign.setOptions({ label: '' });
	expect(canvas.getAttribute('aria-hidden')).toBe('true');
	sign.setOptions({ label: 'motel sign' });
	sign.setText('OPEN');
	expect(canvas.getAttribute('aria-label')).toBe('motel sign: OPEN');
	sign.dispose();
	expect(canvas.getAttribute('role')).toBeNull();
	expect(canvas.getAttribute('aria-label')).toBeNull();
	expect(canvas.getAttribute('aria-hidden')).toBeNull();
});

test("lineOn cuts one line's circuit to unlit glass and strikes it back", () => {
	const { canvas, sign } = mount({ text: 'NO\nVACANCY', font: 'sans', strikeMs: 0, wall: null });
	const both = energy(canvas, 0, 0.45);
	sign.setOptions({ lineOn: [false] });
	const cut = energy(canvas, 0, 0.45);
	expect(cut).toBeGreaterThan(0); // the NO glass is still on the wall —
	expect(cut).toBeLessThan(both * 0.35); // — but its circuit is off
	expect(energy(canvas, 0.55, 1)).toBeGreaterThan(both * 0.5); // VACANCY untouched
	sign.setOptions({ lineOn: [true] });
	expect(energy(canvas, 0, 0.45)).toBeGreaterThan(both * 0.6); // strikeMs 0 → back instantly
});

test("polarity 'absorb' inverts the discharge: the lit sign DARKENS its wall", () => {
	// The invented element — tubes that ink a pale wall instead of lighting a
	// dark one, so a sign can live in a light theme.
	const { canvas, sign } = mount({ text: 'DAY', font: 'sans', strikeMs: 0 });
	const emitLit = energy(canvas); // default: light tubes on the dark default wall
	sign.setOptions({ polarity: 'absorb' });
	const absorbLit = energy(canvas);
	// The unnamed wall followed the flip to pale, so the frame got much brighter…
	expect(absorbLit).toBeGreaterThan(emitLit * 2);
	// …and now switching the tubes OFF must brighten it further: lit glass is the
	// darkest thing on an absorbing sign.
	sign.power(false);
	expect(energy(canvas)).toBeGreaterThan(absorbLit);
	sign.power(true);
	expect(energy(canvas)).toBeCloseTo(absorbLit, -3);
});

test('art pieces flank the text and carry their own colours', () => {
	const box = 'M0 0L40 0 40 40 0 40Z';
	const { canvas } = mount({
		text: 'dice',
		strikeMs: 0,
		wall: null,
		glow: 0.4,
		art: [
			{ d: box, place: 'left', color: '#ff2010' },
			{ d: box, place: 'right', color: '#1040ff' }
		]
	});
	const L = channels(canvas, 0, 1, 0, 0.28);
	const R = channels(canvas, 0, 1, 0.72, 1);
	expect(L.r).toBeGreaterThan(L.b * 1.5); // the left die is red glass
	expect(R.b).toBeGreaterThan(R.r * 1.5); // the right one blue
});

test('the flash cam cycles the sign without exact-timing assumptions', async () => {
	const { canvas } = mount({
		text: 'FLASH',
		font: 'sans',
		strikeMs: 0,
		wall: null,
		program: 'flash',
		speed: 4
	});
	const samples: number[] = [];
	for (let i = 0; i < 8; i++) {
		samples.push(energy(canvas));
		await wait(140);
	}
	const min = Math.min(...samples);
	const max = Math.max(...samples);
	expect(max).toBeGreaterThan(0);
	expect(min).toBeLessThan(max * 0.5); // it went dark and came back
});
