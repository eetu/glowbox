// The core must import cleanly in node/SSR — no browser globals at module scope
// (the same contract nixie guards; its 1.0.0 shipped a module-scope Path2D crash).
import { expect, test } from 'vitest';

test('imports under node without browser globals', async () => {
	const mod = await import('../index');
	expect(typeof mod.createSevenSegment).toBe('function');
	expect(typeof mod.parseColor).toBe('function');
});
