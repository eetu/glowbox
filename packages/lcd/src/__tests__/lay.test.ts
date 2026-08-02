// The module's character arithmetic, node-testable by design (no canvas involved).
import { describe, expect, it } from 'vitest';

import { layLines } from '../lcd';
import { PANELS } from '../panels';

describe('layLines', () => {
	it('pads and truncates every line to exactly cols', () => {
		expect(layLines('HI', 4, 1)).toEqual(['HI  ']);
		expect(layLines('TOO LONG FOR IT', 4, 1)).toEqual(['TOO ']);
	});

	it('splits a string on newlines and takes arrays as rows — a module has exactly the cells it has', () => {
		expect(layLines('A\nB\nC', 2, 2)).toEqual(['A ', 'B ']);
		expect(layLines(['A', 'B'], 2, 3)).toEqual(['A ', 'B ', '  ']);
	});

	it('treats null/undefined as a blank module', () => {
		expect(layLines(null, 2, 1)).toEqual(['  ']);
		expect(layLines(undefined, 2, 2)).toEqual(['  ', '  ']);
	});

	it('numbers pass through String() like everything the family shows', () => {
		expect(layLines(String(42), 4, 1)).toEqual(['42  ']);
	});
});

describe('panel presets', () => {
	it('positive panels ink dark on light; the negative panel inks light on dark', () => {
		const lum = ([r, g, b]: readonly number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
		for (const name of ['green', 'white'] as const) {
			expect(lum(PANELS[name].ink)).toBeLessThan(lum(PANELS[name].pane));
		}
		expect(lum(PANELS.blue.ink)).toBeGreaterThan(lum(PANELS.blue.pane));
	});

	it('only the transmissive negative panel loses its image with the light', () => {
		const lum = ([r, g, b]: readonly number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
		// Reflective glass still reads unlit; the blue pane collapses to near-black.
		expect(lum(PANELS.green.paneOff)).toBeGreaterThan(0.3);
		expect(lum(PANELS.blue.paneOff)).toBeLessThan(0.1);
	});
});
