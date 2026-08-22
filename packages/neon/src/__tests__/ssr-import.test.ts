// The core must import cleanly in node/SSR — no browser globals at module scope
// (the contract nixie guards; its 1.0.0 shipped a module-scope Path2D crash). The
// risks here: the sound module (no AudioContext until the first tick/level) and
// the vendored faces (packed strings; no Path2D until the first draw).
import { expect, test } from 'vitest';

test('imports under node without browser globals', async () => {
	const mod = await import('../index');
	expect(typeof mod.createNeonSign).toBe('function');
	expect(typeof mod.createMechSound).toBe('function');
	expect(typeof mod.createHum).toBe('function');
	expect(typeof mod.parseColor).toBe('function');
	expect(typeof mod.HERSHEY_LICENSE).toBe('string');
	// The pure text→tube pipeline runs headless (the 3D-consumer seam); the word
	// is wired as one circuit by default.
	expect(mod.layoutTubes('HI', 'sans').sections.length).toBe(1);
});

test('createMechSound and createHum are silent no-ops without Web Audio', async () => {
	const { createHum, createMechSound } = await import('../index');
	const snd = createMechSound({ volume: 1 });
	const hum = createHum({ volume: 1, base: 120 });
	expect(() => {
		snd.tick();
		snd.setVolume(0.2);
		snd.dispose();
		hum.setLevel(1);
		hum.setVolume(0.4);
		hum.setLevel(0);
		hum.dispose();
	}).not.toThrow();
});
