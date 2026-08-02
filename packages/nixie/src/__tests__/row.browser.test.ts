import { expect, test } from 'vitest';

import { glyphPath } from '../nixie';
import { createNixieRow } from '../row';

const makeContainer = (w = 600, h = 150) => {
	const el = document.createElement('div');
	el.style.width = `${w}px`;
	el.style.height = `${h}px`;
	document.body.appendChild(el);
	return el;
};

const canvases = (el: HTMLElement) => [...el.querySelectorAll('canvas')];

const litPixels = (canvas: HTMLCanvasElement): number => {
	const ctx = canvas.getContext('2d')!;
	const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
	let n = 0;
	for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 120) n++;
	return n;
};

test('createNixieRow builds one tube per char, narrow separators, one aria image', () => {
	const el = makeContainer();
	const row = createNixieRow(el, { value: '12:34', mesh: false, ghost: false });
	expect(row).not.toBeNull();
	if (!row) return;

	const cs = canvases(el);
	expect(cs).toHaveLength(5);
	// The ':' slot is narrower than a digit slot.
	const digitW = parseFloat(cs[0].style.width);
	const sepW = parseFloat(cs[2].style.width);
	expect(sepW).toBeLessThan(digitW * 0.6);
	// Every tube painted something.
	for (const c of cs) expect(litPixels(c)).toBeGreaterThan(0);
	// One image to assistive tech: the container, named with the value.
	expect(el.getAttribute('role')).toBe('img');
	expect(el.getAttribute('aria-label')).toBe('12:34');
	expect(cs[0].closest('[aria-hidden="true"]')).not.toBeNull();

	row.dispose();
	expect(canvases(el)).toHaveLength(0);
	expect(el.getAttribute('role')).toBeNull();
});

test('setValue relights in place on same length and rebuilds on a new length', () => {
	const el = makeContainer();
	const row = createNixieRow(el, { value: '12:34', mesh: false, ghost: false });
	if (!row) return;
	const before = canvases(el);
	row.setValue('56:78'); // same shape — same canvases, new digits
	expect(canvases(el)).toEqual(before);
	expect(el.getAttribute('aria-label')).toBe('56:78');

	row.setValue('3.14159'); // different length — slots rebuilt
	expect(canvases(el)).toHaveLength(7);
	expect(row.tubes).toHaveLength(7);
	row.dispose();
});

test('setOptions fans appearance out to every tube and relayouts row options', () => {
	const el = makeContainer();
	const row = createNixieRow(el, { value: '88', mesh: false, ghost: false });
	if (!row) return;
	row.setOptions({ color: '#33ccff', gap: 20 });
	for (const c of canvases(el)) expect(litPixels(c)).toBeGreaterThan(0);
	row.dispose();
});

test('a row-level null colour patch resets every tube to the default', () => {
	const el = makeContainer();
	const row = createNixieRow(el, { value: '88', mesh: false, ghost: false, color: [0, 1, 0] })!;
	const channels = (c: HTMLCanvasElement) => {
		const px = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
		let r = 0;
		let g = 0;
		for (let i = 0; i < px.length; i += 4) {
			r += px[i];
			g += px[i + 1];
		}
		return { r, g };
	};
	const first = canvases(el)[0];
	expect(channels(first).g).toBeGreaterThan(channels(first).r);
	row.setOptions({ color: null as never }); // the tube-level runtime reset, forwarded
	expect(channels(first).r).toBeGreaterThan(channels(first).g);
	row.dispose();
});

test('the decimal-point glyph exists and lights', () => {
	expect(glyphPath('.')).toBeTruthy();
	const el = makeContainer(80, 150);
	const row = createNixieRow(el, { value: '.', mesh: false, ghost: false });
	if (!row) return;
	expect(litPixels(canvases(el)[0])).toBeGreaterThan(0);
	row.dispose();
});
