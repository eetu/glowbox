// The shared theme helper is pure logic — resolution and the "who owns this colour"
// bookkeeping — so it is node-testable, symlinked into every core that themes.
import { expect, test } from 'vitest';

import { resolveTheme, themeOwner } from '../theme';

test('resolveTheme takes an explicit scheme and falls back to dark', () => {
	expect(resolveTheme('light')).toBe('light');
	expect(resolveTheme('dark')).toBe('dark');
	expect(resolveTheme(undefined)).toBe('dark');
	// 'auto' asks the page; with no matchMedia (node/SSR) that answer is dark.
	expect(resolveTheme('auto')).toBe('dark');
});

test('a colour the consumer named stops being the theme’s', () => {
	const owner = themeOwner(['card', 'ink'] as const);
	expect(owner.owns('card')).toBe(true);
	owner.mark({ ink: '#fff' });
	expect(owner.owns('ink')).toBe(false);
	expect(owner.owns('card')).toBe(true);
	// undefined is not a name — a patch that omits a key leaves it to the theme.
	owner.mark({ card: undefined });
	expect(owner.owns('card')).toBe(true);
	// and naming it once is enough, forever.
	owner.mark({ card: '#000' });
	owner.mark({});
	expect(owner.owns('card')).toBe(false);
});
