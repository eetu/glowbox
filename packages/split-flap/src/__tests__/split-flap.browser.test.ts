// Real-browser coverage for the render path: a canvas in the DOM, real 2D
// readback — the parts node can't see. (The shared sound engine's gesture
// ladder is covered in @glowbox/flip-dot, where the file is vendored from.)
import { expect, test } from 'vitest';

import { DRUM_DIGITS } from '../drum';
import { createSplitFlap } from '../split-flap';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const mount = (w = 480, h = 80): HTMLCanvasElement => {
	const canvas = document.createElement('canvas');
	canvas.style.width = `${w}px`;
	canvas.style.height = `${h}px`;
	canvas.style.display = 'block';
	document.body.appendChild(canvas);
	return canvas;
};

/** Does the canvas hold a pixel within `tol` of the given 0..255 colour? */
const hasColor = (canvas: HTMLCanvasElement, r: number, g: number, b: number, tol = 40) => {
	const ctx = canvas.getContext('2d')!;
	const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
	for (let i = 0; i < d.length; i += 4)
		if (Math.abs(d[i] - r) < tol && Math.abs(d[i + 1] - g) < tol && Math.abs(d[i + 2] - b) < tol)
			return true;
	return false;
};

test('mounts and paints cards on the board', () => {
	const canvas = mount();
	const board = createSplitFlap(canvas, { cols: 6, rows: 1, flipMs: 0 });
	expect(board).not.toBeNull();
	// A blank board is still hardware: card plastic distinct from the frame.
	expect(hasColor(canvas, 0x1b, 0x1c, 0x1f, 12)).toBe(true);
	board!.dispose();
	canvas.remove();
});

test('setText prints ink instantly at flipMs 0, and the state API agrees', () => {
	const canvas = mount();
	const board = createSplitFlap(canvas, { cols: 6, rows: 1, flipMs: 0 })!;
	board.setText('ABC');
	expect(hasColor(canvas, 0xf4, 0xf4, 0xef)).toBe(true); // glyph ink on screen
	expect(board.getChar(0, 0)).toBe('A');
	expect(board.getChar(3, 0)).toBe(' '); // padded
	expect(board.getText()).toEqual(['ABC']);
	expect(canvas.getAttribute('aria-label')).toBe('split-flap display: ABC');
	board.dispose();
	canvas.remove();
});

test('lowercase and off-drum characters land on the drum honestly', () => {
	const canvas = mount();
	const board = createSplitFlap(canvas, { cols: 3, rows: 1, flipMs: 0 })!;
	board.setText('ab~');
	expect(board.getText()).toEqual(['AB']); // uppercased; ~ → blank, trimmed
	board.dispose();
	canvas.remove();
});

test('a frame change flies cards, then settles deterministically', async () => {
	const canvas = mount();
	const board = createSplitFlap(canvas, { cols: 4, rows: 1, flipMs: 140 })!;
	board.setText('AAAA'); // one flap per module: blank → A
	await sleep(100); // mid-flight (address scatter ≤50ms, fall 140ms)
	const mid = board.snapshot();
	await sleep(900); // fall + settle bounce well past
	const done = board.snapshot();
	expect(mid).not.toBe(done);
	expect(board.snapshot()).toBe(done); // a resting board draws byte-identically
	expect(hasColor(canvas, 0xf4, 0xf4, 0xef)).toBe(true);
	board.dispose();
	canvas.remove();
});

test('a custom katakana drum renders end-to-end', () => {
	const canvas = mount();
	const board = createSplitFlap(canvas, { cols: 4, rows: 1, flipMs: 0, charset: ' ｱｲｳｴｵ012' })!;
	board.setText('ｱ01');
	expect(board.getChar(0, 0)).toBe('ｱ');
	expect(board.getText()).toEqual(['ｱ01']);
	expect(hasColor(canvas, 0xf4, 0xf4, 0xef)).toBe(true); // kana ink on screen
	board.dispose();
	canvas.remove();
});

test('a drum can carry the same letter twice in different inks', () => {
	const canvas = mount();
	const board = createSplitFlap(canvas, {
		cols: 4,
		rows: 1,
		flipMs: 0,
		charset: ' Dd',
		// The red duplicate alphabet of the real arrival boards: flap 'd' PRINTS
		// as a red 'D' — a different flap, the same letterform.
		palette: { d: { glyph: 'D', ink: '#d64541' } }
	})!;
	board.setText('Dd');
	expect(hasColor(canvas, 0xf4, 0xf4, 0xef)).toBe(true); // the white D
	expect(hasColor(canvas, 0xd6, 0x45, 0x41)).toBe(true); // the red D
	expect(board.getText()).toEqual(['Dd']); // two distinct flaps on the drum
	board.dispose();
	canvas.remove();
});

test('a chroma drum paints solid-colour flaps, no glyphs', () => {
	const canvas = mount();
	const board = createSplitFlap(canvas, {
		cols: 4,
		rows: 1,
		flipMs: 0,
		charset: ' RG',
		palette: { R: '#d64541', G: '#43a457' }
	})!;
	board.setText('RRGG');
	expect(hasColor(canvas, 0xd6, 0x45, 0x41)).toBe(true);
	expect(hasColor(canvas, 0x43, 0xa4, 0x57)).toBe(true);
	board.dispose();
	canvas.remove();
});

test('drum zones give fields their own drums', () => {
	const canvas = mount(480, 160);
	const board = createSplitFlap(canvas, {
		cols: 8,
		rows: 2,
		flipMs: 0,
		// A letter board with a 3-module digit field on the top row — the real
		// boards' track column (zone extent defaults to one row).
		drums: [{ x: 5, y: 0, cols: 3, charset: ' 0123456789' }]
	})!;
	board.setText(['ICE  704', 'ABCDEFGH']);
	expect(board.getText()).toEqual(['ICE  704', 'ABCDEFGH']);
	board.setLine(0, 'ABCDEFGH'); // letters can't ride the digit field
	expect(board.getText()).toEqual(['ABCDE', 'ABCDEFGH']);
	board.dispose();
	canvas.remove();
});

test('setOptions({drums}) re-cards live and clips out-of-range zones', () => {
	const canvas = mount();
	const board = createSplitFlap(canvas, { cols: 6, rows: 1, flipMs: 0 })!;
	board.setText('AB12');
	board.setOptions({ drums: [{ x: 2, y: 0, cols: 99, charset: DRUM_DIGITS }] });
	expect(board.getText()).toEqual(['AB12']); // re-carded: every module kept its character
	board.setText('CDEF56');
	expect(board.getText()).toEqual(['CD  56']); // E, F fell off the digit field
	board.setOptions({ drums: [] });
	board.setText('CDEF56');
	expect(board.getText()).toEqual(['CDEF56']); // the whole board is letters again
	board.dispose();
	canvas.remove();
});

test('multi-row boards address rows independently', () => {
	const canvas = mount(480, 160);
	const board = createSplitFlap(canvas, { cols: 8, rows: 2, flipMs: 0 })!;
	board.setText(['TOP', 'BOTTOM']);
	expect(board.getText()).toEqual(['TOP', 'BOTTOM']);
	board.setLine(1, 'SWAPPED');
	expect(board.getText()).toEqual(['TOP', 'SWAPPED']);
	board.setChar(0, 0, 'X');
	expect(board.getChar(0, 0)).toBe('X');
	board.dispose();
	canvas.remove();
});

test('non-finite coordinates are ignored, not thrown (the drum lookup is per cell)', () => {
	const canvas = mount();
	const board = createSplitFlap(canvas, { cols: 4, rows: 1, flipMs: 0 })!;
	board.setText('ABCD');
	expect(() => board.setChar(NaN, 0, 'X')).not.toThrow();
	expect(() => board.setChar(0, Infinity, 'X')).not.toThrow();
	expect(() => board.setLine(NaN, 'XXXX')).not.toThrow();
	expect(board.getChar(NaN, 0)).toBe(' ');
	expect(board.getChar(0, -Infinity)).toBe(' ');
	expect(board.getText()).toEqual(['ABCD']); // untouched
	board.dispose();
	canvas.remove();
});

test('cellAt and cellRect expose the layout maths', () => {
	const canvas = mount(480, 80); // 6 × 80px cells
	const board = createSplitFlap(canvas, { cols: 6, rows: 1, flipMs: 0 })!;
	const r = canvas.getBoundingClientRect();
	expect(board.cellAt(r.left + 5, r.top + 5)).toEqual({ x: 0, y: 0 });
	expect(board.cellAt(r.right - 5, r.bottom - 5)).toEqual({ x: 5, y: 0 });
	expect(board.cellAt(r.left - 5, r.top + 5)).toBeNull(); // off the board
	const c = board.cellRect(2, 0)!;
	// The card window sits inside its own cell (the gap is excluded)...
	expect(c.left).toBeGreaterThan(r.left + 2 * 80);
	expect(c.left + c.width).toBeLessThan(r.left + 3 * 80);
	// ...and round-trips: its centre hits the module it belongs to.
	expect(board.cellAt(c.left + c.width / 2, c.top + c.height / 2)).toEqual({ x: 2, y: 0 });
	expect(board.cellRect(6, 0)).toBeNull();
	expect(board.cellRect(NaN, 0)).toBeNull();
	board.dispose();
	canvas.remove();
});

/** The ink-free run of rows through the seam, in device px: the mechanical split
 *  alone for a letterform the seam cuts, wider when the artwork left it a gap. */
const seamGap = (canvas: HTMLCanvasElement): number => {
	const d = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
	const inked = (y: number) => {
		for (let x = 0; x < canvas.width; x++) {
			const i = (y * canvas.width + x) * 4;
			if (Math.abs(d[i] - 0xf4) < 40 && Math.abs(d[i + 1] - 0xf4) < 40) return true;
		}
		return false;
	};
	const seam = canvas.height >> 1; // one flat cell: the hinge is dead-centre
	let n = 1;
	for (let y = seam - 1; y >= 0 && !inked(y); y--) n++;
	for (let y = seam + 1; y < canvas.height && !inked(y); y++) n++;
	return n;
};

/** The glyph's first and last inked row, in device px. */
const inkSpan = (canvas: HTMLCanvasElement): [number, number] => {
	const d = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
	let top = -1;
	let bottom = -1;
	for (let y = 0; y < canvas.height; y++) {
		for (let x = 0; x < canvas.width; x++) {
			const i = (y * canvas.width + x) * 4;
			if (Math.abs(d[i] - 0xf4) < 40 && Math.abs(d[i + 1] - 0xf4) < 40) {
				if (top < 0) top = y;
				bottom = y;
				break;
			}
		}
	}
	return [top, bottom];
};

test('the seam is kept out of a feature it would sever', () => {
	// A digit is cut by the seam; a colon's dots sit either side of it.
	const letter = mount(120, 160);
	const colon = mount(120, 160);
	const a = createSplitFlap(letter, { cols: 1, rows: 1, flipMs: 0, charset: DRUM_DIGITS })!;
	const b = createSplitFlap(colon, { cols: 1, rows: 1, flipMs: 0, charset: DRUM_DIGITS })!;
	a.setText('8');
	b.setText(':');
	// The 8 is still cut — its ink runs right up to both sides of the split.
	const cut = seamGap(letter);
	expect(cut).toBeLessThan(letter.height * 0.06);
	// The colon's dots sit either side of it, with real clearance.
	expect(seamGap(colon)).toBeGreaterThan(3 * cut);
	a.dispose();
	b.dispose();
	letter.remove();
	colon.remove();
});

test('a cut letterform is cut through its middle', () => {
	const canvas = mount(120, 160);
	const board = createSplitFlap(canvas, { cols: 1, rows: 1, flipMs: 0, charset: DRUM_DIGITS })!;
	board.setText('8');
	const [top, bottom] = inkSpan(canvas);
	const seam = canvas.height / 2; // one flat cell: the hinge is dead-centre
	// Equal halves: the ink reaches as far above the cut as below it.
	expect(Math.abs(seam - top - (bottom - seam))).toBeLessThan(canvas.height * 0.02);
	board.dispose();
	canvas.remove();
});

test('sound: true is safe before any user gesture', () => {
	const canvas = mount();
	const board = createSplitFlap(canvas, { cols: 4, rows: 1, flipMs: 0, sound: true })!;
	expect(() => board.setText('CLIC')).not.toThrow();
	board.dispose();
	canvas.remove();
});

test('dispose hands the canvas back clean', () => {
	const canvas = mount();
	const board = createSplitFlap(canvas, { cols: 4, rows: 1 })!;
	expect(canvas.getAttribute('role')).toBe('img');
	board.dispose();
	expect(canvas.getAttribute('role')).toBeNull();
	expect(canvas.getAttribute('aria-label')).toBeNull();
	canvas.remove();
});
