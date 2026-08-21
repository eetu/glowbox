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
function energy(canvas: HTMLCanvasElement, y0 = 0, y1 = 1, x0 = 0, x1 = 1) {
	const g = canvas.getContext('2d')!;
	const img = g.getImageData(
		Math.floor(canvas.width * x0),
		Math.floor(canvas.height * y0),
		Math.max(1, Math.floor(canvas.width * (x1 - x0))),
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

test('a piece can shine black beside lettering that still shines (mixed polarity)', () => {
	// The failure this fixes: a WHITE tube emitting on a WHITE wall is invisible.
	// Per-piece polarity lets that one element run dark while the sign keeps
	// emitting — the element inverts, not the circuit.
	const box = 'M0 0L40 0 40 40 0 40Z';
	const piece = (polarity?: 'emit' | 'absorb') => ({
		d: box,
		place: 'left' as const,
		gas: 'co2' as const,
		polarity
	});
	const wall = '#ffffff';
	const lost = mount({ text: 'dice', gas: 'gold', wall, strikeMs: 0, art: [piece('emit')] });
	const inked = mount({ text: 'dice', gas: 'gold', wall, strikeMs: 0, art: [piece('absorb')] });
	// The art sits left of the text. Its DARKEST pixel is the tell: an absorbing
	// tube inks a near-black core into the wall, while an emitting white tube on
	// a white wall leaves nothing behind at all.
	const darkest = (c: HTMLCanvasElement, x0: number, x1: number) => {
		const g = c.getContext('2d')!;
		const img = g.getImageData(0, 0, Math.floor(c.width * x1), c.height);
		let min = 765;
		for (let i = Math.floor(c.width * x0) * 4; i < img.data.length; i += 16)
			min = Math.min(min, img.data[i] + img.data[i + 1] + img.data[i + 2]);
		return min;
	};
	// (Not zero vs something: the electrode caps are hardware and stay dark
	// either way — so the emitting tube's darkest pixel is a metal stub, well
	// lighter than an inked core.)
	const inkMin = darkest(inked.canvas, 0, 0.3);
	const emitMin = darkest(lost.canvas, 0, 0.3);
	expect(inkMin).toBeLessThan(140); // an inked core, near-black
	expect(emitMin).toBeGreaterThan(inkMin * 2.5); // white light, lost in the wall
	// …and the lettering, which never asked to invert, is unchanged.
	const text = (c: HTMLCanvasElement) => energy(c, 0, 1, 0.6, 1);
	expect(text(inked.canvas) / text(lost.canvas)).toBeGreaterThan(0.99);
});

test('sectionAt hit-tests the glass; jolt makes that tube stutter', async () => {
	// 'I' is a single centred stem in the sans face, so the canvas centre is on
	// the tube and the corners are nowhere near it.
	const { canvas, sign } = mount({ text: 'I', font: 'sans', strikeMs: 0, wall: null });
	const r = canvas.getBoundingClientRect();
	expect(sign.sectionAt(r.left + r.width / 2, r.top + r.height / 2)).toBe(0);
	expect(sign.sectionAt(r.left + 2, r.top + 2)).toBeNull(); // a tap that missed
	expect(sign.sectionAt(r.left - 50, r.top - 50)).toBeNull(); // outside entirely

	// The rap: the tube dips, then eases back over ~1/6 s — so sample early for
	// the disturbance and late for the recovery. (The dip lands on the next
	// frame, like every other change the animation loop owns.)
	const lit = energy(canvas);
	sign.jolt(0);
	await wait(40);
	expect(energy(canvas)).toBeLessThan(lit * 0.9);
	await wait(400);
	expect(energy(canvas)).toBeCloseTo(lit, -3); // recovered on its own
	// Dark glass has no discharge to disturb — a jolt on an off sign is a no-op.
	sign.power(false);
	await wait(120);
	const off = energy(canvas);
	sign.jolt();
	await wait(60);
	expect(energy(canvas)).toBeCloseTo(off, -3);
});

test('sectionRect frames the glass sectionAt hit', () => {
	// Same single centred stem: the canvas centre is on tube 0, so tube 0's rect
	// must contain that point. (Not the other way round — a glyph with a counter
	// can have a rect centre off the glass, so the rect→sectionAt round-trip is
	// deliberately not the contract.)
	const { canvas, sign } = mount({ text: 'I', font: 'sans', strikeMs: 0, wall: null });
	const r = canvas.getBoundingClientRect();
	const cx = r.left + r.width / 2;
	const cy = r.top + r.height / 2;
	expect(sign.sectionAt(cx, cy)).toBe(0);
	const rect = sign.sectionRect(0)!;
	expect(rect).not.toBeNull();
	expect(rect.width).toBeGreaterThan(0);
	expect(rect.height).toBeGreaterThan(0);
	expect(cx).toBeGreaterThanOrEqual(rect.left);
	expect(cx).toBeLessThanOrEqual(rect.left + rect.width);
	expect(cy).toBeGreaterThanOrEqual(rect.top);
	expect(cy).toBeLessThanOrEqual(rect.top + rect.height);
	// A stem is tube-thin: the rect hugs the glass, it doesn't cover the canvas.
	expect(rect.width).toBeLessThan(r.width / 2);
	// Out of range, in every way an index can be.
	expect(sign.sectionRect(-1)).toBeNull();
	expect(sign.sectionRect(99)).toBeNull();
	expect(sign.sectionRect(Number.NaN)).toBeNull();
});

test('the glass and the hardware are customizable, and sane per polarity', () => {
	// On a pale wall the electrodes are the darkest marks on an unlit sign, so
	// absorbing hardware defaults to mid-grey; near-black is available, not forced.
	const wall = '#ffffff';
	const darkest = (c: HTMLCanvasElement) => {
		const img = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
		let min = 765;
		for (let i = 0; i < img.data.length; i += 16)
			min = Math.min(min, img.data[i] + img.data[i + 1] + img.data[i + 2]);
		return min;
	};
	const { canvas, sign } = mount({
		text: 'HI',
		font: 'sans',
		wall,
		polarity: 'absorb',
		on: false,
		strikeMs: 0
	});
	const dflt = darkest(canvas);
	expect(dflt).toBeGreaterThan(300); // hardware, not flyspecks
	sign.setOptions({ electrode: '#000000' });
	expect(darkest(canvas)).toBeLessThan(dflt); // …but you can have soot if you want
	// The unlit glass takes a colour too.
	const before = energy(canvas);
	sign.setOptions({ glass: '#ff0000' });
	expect(energy(canvas)).not.toBeCloseTo(before, -3);
});

test('theme light is the absorbing sign on a pale wall', () => {
	const { canvas, sign } = mount({ text: 'OPEN', strikeMs: 0, theme: 'light' });
	// A pale wall carries far more energy than a near-black one, whatever the tubes do.
	const pale = energy(canvas);
	sign.setOptions({ theme: 'dark' });
	expect(energy(canvas)).toBeLessThan(pale);
	// A wall the consumer named is theirs from then on: the theme still flips the
	// polarity (that is the trick), but the surface behind the tubes does not move.
	sign.setOptions({ wall: '#808080', theme: 'light' });
	const corner = () => [...canvas.getContext('2d')!.getImageData(2, 2, 1, 1).data].slice(0, 3);
	expect(corner()).toEqual([128, 128, 128]);
	sign.setOptions({ theme: 'dark' });
	expect(corner()).toEqual([128, 128, 128]);
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
