// Importing @glowbox/lcd must be safe with no DOM — node / SSR module evaluation
// (Next.js, Nuxt, SvelteKit with SSR on) imports the package even when the component
// never renders. Everything browser-only stays lazy inside createLcdModule/draw.
import { describe, expect, it } from 'vitest';

describe('node/SSR import safety', () => {
	it('imports without a DOM and exposes the pure API', async () => {
		expect(typeof document).toBe('undefined'); // the env this test exists to simulate
		const mod = await import('../index');
		expect(typeof mod.createLcdModule).toBe('function');
		expect(mod.PANELS.green.negative).toBe(false);
		expect(mod.PANELS.blue.negative).toBe(true);
		expect(mod.glyph5x7('A').length).toBe(mod.FONT_5X7.height);
		expect(mod.layLines('HI', 4, 2)).toEqual(['HI  ', '    ']);
	});

	it('parses colours without a DOM (hex path; CSS names need a canvas)', async () => {
		const { parseColor } = await import('../color');
		expect(parseColor('#14161a')).toEqual([0x14 / 255, 0x16 / 255, 0x1a / 255]);
		expect(parseColor([1, 0.45, 0.08])).toEqual([1, 0.45, 0.08]);
	});
});
