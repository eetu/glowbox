// The core must import cleanly in node/SSR — no browser globals at module scope (the
// contract nixie guards after its 1.0.0 shipped a module-scope Path2D crash). The risks
// in this package: the vendored 5×7 face compiles its ASCII art at load, and every
// element kind builds geometry — none of which may reach for Path2D, canvas or
// ResizeObserver until a draw actually happens.
import { expect, test } from 'vitest';

test('imports under node without browser globals', async () => {
	const mod = await import('../index');
	expect(typeof mod.createVfdPanel).toBe('function');
	expect(typeof mod.compilePanel).toBe('function');
	expect(typeof mod.parseColor).toBe('function');
	expect(typeof mod.glyph5x7).toBe('function');
	expect(mod.PHOSPHORS['zn-o'].color).toHaveLength(3);
	expect(mod.FILTERS.green.tint).toHaveLength(3);
});

test('the whole layout pipeline runs headless — every element kind', async () => {
	const { compilePanel, driveElement } = await import('../index');
	// The seam a 3D consumer would use, and the reason the inventory is pure: no canvas
	// exists here at all.
	const panel = compilePanel(
		[320, 64],
		[
			{ kind: 'rule', name: 'edge', shape: 'box', x: 0, y: 0, w: 320, h: 64 },
			{ kind: 'digits', name: 'main', chars: 8, glyphs: '14seg', x: 8, y: 6, w: 150, h: 26 },
			{ kind: 'digits', name: 'dots', chars: 4, glyphs: 'matrix', x: 8, y: 34, w: 60, h: 20 },
			{ kind: 'legend', name: 'st', text: 'ST', x: 170, y: 4, w: 14, h: 8 },
			{ kind: 'legend', name: 'src', text: 'TUNER', x: 170, y: 14, w: 30, h: 8, printed: true },
			{
				kind: 'bars',
				name: 'spec',
				bands: 12,
				rows: 8,
				peakHold: true,
				x: 200,
				y: 6,
				w: 110,
				h: 34
			},
			{ kind: 'icon', name: 'play', d: 'M0 0 L10 5 L0 10 Z', x: 300, y: 44, w: 10, h: 10 },
			{ kind: 'scale', name: 'tune', ticks: 9, steps: 20, x: 8, y: 56, w: 180, h: 8 }
		]
	);
	expect(panel.elements).toHaveLength(8);
	expect(panel.anodes.length).toBeGreaterThan(200);
	expect(panel.driven).toBeLessThan(panel.anodes.length); // some of it is ink

	// And it drives headless too.
	const out = new Float32Array(panel.anodes.length);
	for (const el of panel.elements) {
		driveElement(
			el,
			{
				text: '8888',
				on: true,
				levels: new Array(12).fill(1),
				peaks: new Array(12).fill(7),
				pos: 0.5
			},
			out
		);
	}
	expect(Array.from(out).some((v) => v > 0)).toBe(true);
});

test('a panel with no elements is inert, not a crash', async () => {
	const { compilePanel } = await import('../index');
	const empty = compilePanel([320, 64], []);
	expect(empty.anodes).toHaveLength(0);
	expect(empty.driven).toBe(0);
	expect(empty.byName.size).toBe(0);
});
