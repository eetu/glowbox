import { expect, test } from 'vitest';

import { framesFromBuffer } from '../gif';
import { type ImageSource, sampleImageToGrid } from '../sample';

// A 2×2 image: bottom row (y-down last row) red|green, top row blue|white.
const img2x2 = (): ImageSource => {
	const data = new Uint8ClampedArray(2 * 2 * 4);
	const set = (i: number, r: number, g: number, b: number) => {
		data[i] = r;
		data[i + 1] = g;
		data[i + 2] = b;
		data[i + 3] = 255;
	};
	set(0, 0, 0, 255); // (0,0) top-left  blue
	set(4, 255, 255, 255); // (1,0) top-right white
	set(8, 255, 0, 0); // (0,1) bottom-left red
	set(12, 0, 255, 0); // (1,1) bottom-right green
	return { data, width: 2, height: 2 };
};

test('sampleImageToGrid stretch maps 1:1 and flips y so the image is upright', () => {
	const { rgb, alpha } = sampleImageToGrid(img2x2(), 2, 2, 'stretch');
	// Grid is y-up: row 0 (bottom) should be the image's bottom row (red|green).
	expect(alpha.every((a) => a === 1)).toBe(true);
	const cell = (gx: number, gy: number) => {
		const o = (gy * 2 + gx) * 3;
		return [rgb[o], rgb[o + 1], rgb[o + 2]];
	};
	expect(cell(0, 0)).toEqual([1, 0, 0]); // bottom-left red
	expect(cell(1, 0)).toEqual([0, 1, 0]); // bottom-right green
	expect(cell(0, 1)).toEqual([0, 0, 1]); // top-left blue
	expect(cell(1, 1)).toEqual([1, 1, 1]); // top-right white
});

test('contain letterboxes a wide image on a square grid (alpha 0 outside)', () => {
	// A 4×1 image on a 4×4 grid → drawn as a 4×1 band, centred vertically.
	const data = new Uint8ClampedArray(4 * 1 * 4).fill(255);
	const { alpha } = sampleImageToGrid({ data, width: 4, height: 1 }, 4, 4, 'contain');
	const litRows = [0, 1, 2, 3].map((gy) => [0, 1, 2, 3].some((gx) => alpha[gy * 4 + gx] > 0));
	// Exactly one row (the centre band) is lit; the rest are letterbox.
	expect(litRows.filter(Boolean).length).toBe(1);
});

test('cover fills the whole grid (no letterbox)', () => {
	const data = new Uint8ClampedArray(4 * 1 * 4).fill(255);
	const { alpha } = sampleImageToGrid({ data, width: 4, height: 1 }, 4, 4, 'cover');
	expect(alpha.every((a) => a > 0)).toBe(true);
});

// A 1×1 GIF (base64) — exercises the decode + composite path in node.
const GIF_1x1 = 'R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const bytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

test('framesFromBuffer decodes + composites a GIF into full-size RGBA frames', () => {
	const frames = framesFromBuffer(bytes(GIF_1x1).buffer);
	expect(frames.length).toBeGreaterThanOrEqual(1);
	const f0 = frames[0];
	expect(f0.src.width).toBe(1);
	expect(f0.src.height).toBe(1);
	expect(f0.src.data.length).toBe(1 * 1 * 4); // full-size RGBA snapshot
	expect(Number.isFinite(f0.delay)).toBe(true);
});
