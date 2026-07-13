// Regression: importing @glowbox/nixie must be safe with no DOM — node / SSR module
// evaluation (Next.js, Nuxt, SvelteKit with SSR on) imports the package even when the
// component never renders. 1.0.0 crashed here: a module-scope `new Path2D(...)` for the
// colon glyph. Everything browser-only must stay lazy inside createNixieTube/draw.
import { describe, expect, it } from 'vitest';

describe('node/SSR import safety', () => {
	it('imports without a DOM and exposes the pure API', async () => {
		expect(typeof Path2D).toBe('undefined'); // the env this test exists to simulate
		const mod = await import('../index');
		expect(typeof mod.createNixieTube).toBe('function');
		expect(mod.glyphPath(8)).toBeTruthy();
		expect(mod.glyphPath(':')).toBeTruthy();
		expect(mod.glyphPath('x')).toBeNull();
		expect(mod.nixieCathodes()).toHaveLength(10);
		expect(mod.nixieMesh(60, 100).cells.length).toBeGreaterThan(0);
	});

	it('parses colours without a DOM (hex path; CSS names need a canvas)', async () => {
		const { parseColor } = await import('../color');
		expect(parseColor('#ff8800')).toEqual([1, 0x88 / 255, 0]);
		expect(parseColor([1, 0.45, 0.08])).toEqual([1, 0.45, 0.08]);
	});
});
