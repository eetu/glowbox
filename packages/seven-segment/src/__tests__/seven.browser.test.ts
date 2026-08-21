import { expect, test } from 'vitest';

import { createSevenSegment } from '../seven';

const makeCanvas = () => {
	const canvas = document.createElement('canvas');
	canvas.style.width = '120px';
	canvas.style.height = '180px';
	document.body.appendChild(canvas);
	return canvas;
};

const litPixels = (canvas: HTMLCanvasElement): number => {
	const ctx = canvas.getContext('2d')!;
	const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
	let n = 0;
	for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 130) n++;
	return n;
};

test('lights a digit; blank goes dark', () => {
	const canvas = makeCanvas();
	const d = createSevenSegment(canvas, { value: 8, transition: 0, ghost: false });
	expect(d).not.toBeNull();
	if (!d) return;
	const eight = litPixels(canvas);
	expect(eight).toBeGreaterThan(0);
	d.setValue(1); // 2 segments < 7 segments
	expect(litPixels(canvas)).toBeLessThan(eight);
	d.setValue(null);
	expect(litPixels(canvas)).toBeLessThan(eight / 8);
	d.dispose();
	expect(canvas.getAttribute('role')).toBeNull(); // canvas handed back without our ARIA
});

test('per-segment transition eases between digits (mid-fade frame exists)', async () => {
	const canvas = makeCanvas();
	const d = createSevenSegment(canvas, { value: 8, transition: 300, ghost: false });
	if (!d) return;
	const before = litPixels(canvas);
	d.setValue(1);
	// A frame later some segments are mid-fade — dimmer than 8, brighter than 1.
	await new Promise((r) => setTimeout(r, 90));
	const mid = litPixels(canvas);
	expect(mid).toBeLessThan(before);
	expect(mid).toBeGreaterThan(0);
	await new Promise((r) => setTimeout(r, 600));
	expect(litPixels(canvas)).toBeLessThan(mid); // settled at the sparse digit
	d.dispose();
});

test('age dims worn segments', () => {
	const canvas = makeCanvas();
	const fresh = createSevenSegment(canvas, { value: 8, transition: 0, ghost: false });
	if (!fresh) return;
	const factory = litPixels(canvas);
	fresh.setOptions({ age: 1 });
	expect(litPixels(canvas)).toBeLessThan(factory);
	fresh.dispose();
});

test('vfd style lights, dp lights, hex letters light', () => {
	const canvas = makeCanvas();
	const d = createSevenSegment(canvas, { value: null, style: 'vfd', transition: 0 });
	if (!d) return;
	d.setOptions({ dp: true });
	const dpOnly = litPixels(canvas);
	expect(dpOnly).toBeGreaterThan(0);
	d.setOptions({ value: 'A', dp: false });
	expect(litPixels(canvas)).toBeGreaterThan(dpOnly);
	d.dispose();
});

test('aria: named by the shown symbol; blank display is hidden', () => {
	const canvas = makeCanvas();
	const d = createSevenSegment(canvas, { value: 7, dp: true, transition: 0 });
	if (!d) return;
	expect(canvas.getAttribute('role')).toBe('img');
	expect(canvas.getAttribute('aria-label')).toBe('7.');
	d.setOptions({ value: null, dp: false });
	expect(canvas.getAttribute('aria-hidden')).toBe('true');
	d.dispose();
});

test('the colon separator lights two dots and fits by height in a slim slot', () => {
	const canvas = document.createElement('canvas');
	canvas.style.width = '40px';
	canvas.style.height = '180px';
	document.body.appendChild(canvas);
	const d = createSevenSegment(canvas, { value: ':', transition: 0, ghost: false });
	if (!d) return;
	const lit = litPixels(canvas);
	expect(lit).toBeGreaterThan(0);
	expect(canvas.getAttribute('aria-label')).toBe(':');
	d.setValue(null); // dots out — only the window chrome (rim highlight) remains
	expect(litPixels(canvas)).toBeLessThan(lit / 4);
	d.dispose();
});

test('bare drops the window module: segments on a transparent canvas', () => {
	const framed = makeCanvas();
	const bare = makeCanvas();
	const a = createSevenSegment(framed, { value: 8, transition: 0 })!;
	const b = createSevenSegment(bare, { value: 8, transition: 0, bare: true })!;
	const alphaAt = (canvas: HTMLCanvasElement, x: number, y: number) =>
		canvas.getContext('2d')!.getImageData(x, y, 1, 1).data[3];
	// The framed module paints its window; bare paints nothing but the segments.
	expect(alphaAt(framed, framed.width >> 1, framed.height >> 1)).toBe(255);
	expect(alphaAt(bare, 1, 1)).toBe(0);
	// Same digit, and bare uses the whole box, so it is not the smaller of the two.
	expect(litPixels(bare)).toBeGreaterThanOrEqual(litPixels(framed));
	a.setOptions({ bare: true });
	expect(alphaAt(framed, 1, 1)).toBe(0); // live-updatable, like every option
	a.dispose();
	b.dispose();
	framed.remove();
	bare.remove();
});

test('survives absurdly small canvases (regression: negative window inset threw)', () => {
	// A sub-5px box used to feed roundRect a negative radius (IndexSizeError).
	for (const [cw, cy] of [
		['1px', '1px'],
		['4px', '180px'],
		['120px', '3px']
	]) {
		const canvas = document.createElement('canvas');
		canvas.style.width = cw;
		canvas.style.height = cy;
		document.body.appendChild(canvas);
		const d = createSevenSegment(canvas, { value: 8, transition: 0 });
		expect(d).not.toBeNull();
		d?.setValue(3);
		d?.dispose();
	}
});
