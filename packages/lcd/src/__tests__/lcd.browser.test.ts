import { expect, test } from 'vitest';

import { LATIN_5X7 } from '../latin';
import { createLcdModule } from '../lcd';

const makeCanvas = (w = 320, h = 100) => {
	const canvas = document.createElement('canvas');
	canvas.style.width = `${w}px`;
	canvas.style.height = `${h}px`;
	document.body.appendChild(canvas);
	return canvas;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Ink on a positive panel is dark on a light pane; with `bezel: null` the glass is
// the only opaque paint, so "dark and opaque" counts exactly the driven dots.
const inkPixels = (canvas: HTMLCanvasElement): number => {
	const ctx = canvas.getContext('2d')!;
	const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
	let n = 0;
	for (let i = 0; i < px.length; i += 4)
		if (px[i + 3] > 200 && px[i] + px[i + 1] + px[i + 2] < 220) n++;
	return n;
};

// Light pixels — the negative blue panel's ink.
const litPixels = (canvas: HTMLCanvasElement): number => {
	const ctx = canvas.getContext('2d')!;
	const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
	let n = 0;
	for (let i = 0; i < px.length; i += 4)
		if (px[i + 3] > 200 && px[i] + px[i + 1] + px[i + 2] > 550) n++;
	return n;
};

const quiet = { boot: false, response: 0, bezel: null } as const;

test('mounts, sets ARIA from the text, and inks the glass', () => {
	const canvas = makeCanvas();
	const lcd = createLcdModule(canvas, { ...quiet, text: 'HELLO\nWORLD' });
	expect(lcd).not.toBeNull();
	if (!lcd) return;
	expect(canvas.getAttribute('role')).toBe('img');
	expect(canvas.getAttribute('aria-label')).toBe('lcd display: HELLO / WORLD');
	expect(inkPixels(canvas)).toBeGreaterThan(0);
	lcd.setText('');
	expect(canvas.getAttribute('aria-label')).toBe('lcd display');
	lcd.dispose();
	expect(canvas.getAttribute('role')).toBeNull(); // canvas handed back without our ARIA
	canvas.remove();
});

test('the crystals are slow: new ink arrives over time and drains on power-off', async () => {
	const canvas = makeCanvas();
	// Backlight off so the pane colour is identical powered and unpowered — the
	// reflective glass reads either way, and only the INK moves the average.
	const lcd = createLcdModule(canvas, {
		boot: false,
		bezel: null,
		response: 0.8,
		backlight: false
	})!;
	const avg = () => {
		const px = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
		let sum = 0;
		let n = 0;
		for (let i = 0; i < px.length; i += 4)
			if (px[i + 3] > 200) {
				sum += px[i] + px[i + 1] + px[i + 2];
				n++;
			}
		return sum / n;
	};
	const blank = avg();
	lcd.setText('8888888888888888');
	await sleep(120);
	const mid = avg();
	await sleep(1300);
	const settled = avg();
	// The target is set at once, but the shutters take real time to close…
	expect(mid).toBeLessThan(blank - 1);
	expect(settled).toBeLessThan(mid - 1);
	expect(inkPixels(canvas)).toBeGreaterThan(0); // fully dark ink once settled
	// …and cutting the power doesn't blank the glass; the ink drains out slowly.
	lcd.power(false);
	await sleep(250);
	const draining = avg();
	expect(draining).toBeGreaterThan(settled + 1); // lifting…
	expect(draining).toBeLessThan(blank - 1); // …but not gone — no instant blank
	await sleep(1600);
	expect(inkPixels(canvas)).toBe(0);
	lcd.dispose();
	canvas.remove();
});

test('boot shows the uninitialised row of solid blocks, then hands over to the text', async () => {
	const canvas = makeCanvas();
	const lcd = createLcdModule(canvas, { bezel: null, response: 0, text: '' })!;
	// Nothing was written, yet the top row is full of boxes — the 16×2 symptom.
	expect(inkPixels(canvas)).toBeGreaterThan(500);
	await sleep(1000);
	expect(inkPixels(canvas)).toBe(0); // initialised: the (empty) text takes over
	lcd.dispose();
	canvas.remove();
});

test('the contrast pot: low sinks the ink, overdrive raises the resting lattice', () => {
	const canvas = makeCanvas();
	const lcd = createLcdModule(canvas, { ...quiet, text: 'CONTRAST' })!;
	const sweet = inkPixels(canvas);
	lcd.setOptions({ contrast: 0.05 });
	expect(inkPixels(canvas)).toBeLessThan(sweet / 4); // sunk into the pane
	// Overdriven: the undriven lattice itself darkens toward visibility.
	const avg = () => {
		const px = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
		let sum = 0;
		let n = 0;
		for (let i = 0; i < px.length; i += 4)
			if (px[i + 3] > 200) {
				sum += px[i] + px[i + 1] + px[i + 2];
				n++;
			}
		return sum / n;
	};
	lcd.setOptions({ contrast: 0.8 });
	const clean = avg();
	lcd.setOptions({ contrast: 1 });
	expect(avg()).toBeLessThan(clean); // streaks + lattice pull the pane darker
	lcd.dispose();
	canvas.remove();
});

test('the negative blue panel needs its backlight to have an image at all', () => {
	const canvas = makeCanvas();
	const lcd = createLcdModule(canvas, { ...quiet, panel: 'blue', text: 'NIGHT' })!;
	const lit = litPixels(canvas);
	expect(lit).toBeGreaterThan(0);
	lcd.setOptions({ backlight: false });
	expect(litPixels(canvas)).toBeLessThan(lit / 4); // transmissive: no light, no ink
	lcd.dispose();
	canvas.remove();
});

test('CGRAM glyphs drive dots and the block cursor inks its cell', () => {
	const canvas = makeCanvas();
	const lcd = createLcdModule(canvas, { ...quiet })!;
	const blank = inkPixels(canvas);
	lcd.setGlyph(0, [0b11111, 0b11111, 0b11111, 0b11111, 0b11111, 0b11111, 0b11111, 0b11111]);
	lcd.setText('\u0000');
	const glyph = inkPixels(canvas);
	expect(glyph).toBeGreaterThan(blank);
	// An out-of-range slot warns (once) and is ignored — drive-time never throws.
	expect(() => lcd.setGlyph(9, [1, 1, 1, 1, 1, 1, 1, 1])).not.toThrow();
	lcd.setText('');
	lcd.setCursor(3, 1);
	lcd.setOptions({ cursor: 'block' });
	expect(inkPixels(canvas)).toBeGreaterThan(0);
	const rect = lcd.cellRect(3, 1)!;
	// The cursor's ink sits inside its own cell.
	const ctx = canvas.getContext('2d')!;
	const r = canvas.getBoundingClientRect();
	const dpr = canvas.width / r.width;
	const probe = ctx.getImageData(
		Math.round((rect.left - r.left + rect.width / 2) * dpr),
		Math.round((rect.top - r.top + rect.height / 2) * dpr),
		1,
		1
	).data;
	expect(probe[0] + probe[1] + probe[2]).toBeLessThan(300);
	lcd.dispose();
	canvas.remove();
});

test('the glyphs option teaches the face new characters and resets with null', () => {
	const canvas = makeCanvas();
	const lcd = createLcdModule(canvas, { ...quiet, text: 'ÄÄNI 21°' })!;
	// Without the table the accents render as the hollow fallback box.
	const boxes = lcd.snapshot();
	lcd.setOptions({ glyphs: LATIN_5X7 });
	const latin = lcd.snapshot();
	expect(latin).not.toBe(boxes);
	// Handing the table back restores the plain face exactly (nixie's null-reset contract).
	lcd.setOptions({ glyphs: null });
	expect(lcd.snapshot()).toBe(boxes);
	lcd.dispose();
	canvas.remove();
});

test('cellAt and cellRect expose the layout maths', () => {
	const canvas = makeCanvas(320, 100);
	const lcd = createLcdModule(canvas, { ...quiet, cols: 16, rows: 2 })!;
	const r = canvas.getBoundingClientRect();
	// Dead centre of the glass is somewhere on the grid…
	const mid = lcd.cellAt(r.left + r.width / 2, r.top + r.height / 2);
	expect(mid).not.toBeNull();
	// …and a cell's rect round-trips: its centre names the cell it belongs to.
	const c = lcd.cellRect(5, 1)!;
	expect(lcd.cellAt(c.left + c.width / 2, c.top + c.height / 2)).toEqual({ x: 5, y: 1 });
	expect(lcd.cellAt(r.left - 20, r.top - 20)).toBeNull(); // off the module
	expect(lcd.cellRect(16, 0)).toBeNull();
	expect(lcd.cellRect(NaN, 0)).toBeNull();
	lcd.dispose();
	canvas.remove();
});

test('age dims toward a dead column; the text stays the text', () => {
	const canvas = makeCanvas();
	const lcd = createLcdModule(canvas, { ...quiet, text: '################' })!;
	const fresh = inkPixels(canvas);
	lcd.setOptions({ age: 1 });
	const worn = inkPixels(canvas);
	expect(worn).toBeLessThan(fresh); // dimming + one driver gone
	expect(worn).toBeGreaterThan(fresh / 3); // but the module still reads
	lcd.dispose();
	canvas.remove();
});

test('snapshot returns a PNG and survives absurdly small canvases', () => {
	const canvas = makeCanvas(8, 4);
	const lcd = createLcdModule(canvas, { ...quiet, text: 'HI' })!;
	expect(lcd.snapshot().startsWith('data:image/png')).toBe(true);
	lcd.dispose();
	canvas.remove();
});
