// The core must import cleanly in node/SSR — no browser globals at module scope
// (the same contract nixie guards; its 1.0.0 shipped a module-scope Path2D crash).
// The sound module is the risk here: no AudioContext until the first tick.
import { expect, test } from 'vitest';

test('imports under node without browser globals', async () => {
	const mod = await import('../index');
	expect(typeof mod.createFlipDots).toBe('function');
	expect(typeof mod.ditherFrame).toBe('function');
	expect(typeof mod.createMechSound).toBe('function');
	expect(typeof mod.parseColor).toBe('function');
});

test('createMechSound is a silent no-op without Web Audio', async () => {
	const { createMechSound } = await import('../index');
	const snd = createMechSound({ volume: 1 });
	expect(() => {
		snd.tick();
		snd.setVolume(0.2);
		snd.dispose();
	}).not.toThrow();
});
