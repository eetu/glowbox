// Real-browser coverage for the render path: a canvas in the DOM, real 2D
// readback — the parts node can't see. (The shared sound engine's gesture
// ladder is covered in @glowbox/flip-dot, where the file is vendored from.)
import { expect, test } from 'vitest';

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
