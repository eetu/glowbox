// The effect must import cleanly in node/SSR — no browser globals at module scope.
import { expect, test } from 'vitest';

test('imports under node without browser globals', async () => {
	const mod = await import('../index');
	expect(typeof mod.createCrtScreen).toBe('function');
});
