// SHARED SOURCE. This file lives in `shared/` and is SYMLINKED into each package that
// needs it (see `scripts/check-shared.mjs` and CLAUDE.md → Conventions). Editing it here
// edits it for every one of them. It is not a package and nothing depends on it at
// runtime: each bundler inlines it, so the cores stay genuinely zero-dep.
// Shared by: flip-dot, lcd, led-grid, neon, nixie, seven-segment, split-flap, vfd.
//
// A `theme` is a bundle of colour DEFAULTS, never a render path: every core draws the
// same way in either theme, and every colour it picks can be overridden one option at a
// time. What "light" means is the core's own answer, and it is not always an inversion —
// an emissive display on a pale page is still a dark object, so those cores light a dark
// glass and put the theme into the housing around it instead.
//
// Import-safe under node/SSR: nothing here touches a browser global until it is called.

/** `'auto'` follows the page's `prefers-color-scheme`. */
export type Theme = 'dark' | 'light' | 'auto';

/** A theme once `'auto'` has been asked — what the core actually paints. */
export type ResolvedTheme = 'dark' | 'light';

const LIGHT_QUERY = '(prefers-color-scheme: light)';

/** The theme in force. Anything unreadable (no matchMedia, an unknown value) is dark,
 *  which is every core's default look. */
export function resolveTheme(theme: Theme | undefined): ResolvedTheme {
	if (theme === 'light' || theme === 'dark') return theme;
	if (theme !== 'auto' || typeof matchMedia === 'undefined') return 'dark';
	return matchMedia(LIGHT_QUERY).matches ? 'light' : 'dark';
}

/** Call `cb` whenever the page's scheme flips, but only while the theme is `'auto'`.
 *  Returns the stop function (nothing to stop in the other cases). */
export function watchTheme(
	theme: Theme | undefined,
	cb: (theme: ResolvedTheme) => void
): () => void {
	if (theme !== 'auto' || typeof matchMedia === 'undefined') return () => {};
	const mq = matchMedia(LIGHT_QUERY);
	const onChange = () => cb(mq.matches ? 'light' : 'dark');
	mq.addEventListener('change', onChange);
	return () => mq.removeEventListener('change', onChange);
}

/** Bookkeeping for the colours a theme owns. A colour the CONSUMER named is theirs for
 *  good — flipping the theme moves the rest and leaves that one alone, so
 *  `{ theme: 'light', onColor: '#c00' }` is a light board with a red dot, and stays one
 *  when the page flips to dark. */
export function themeOwner<K extends string>(keys: readonly K[]) {
	const named = new Set<K>();
	return {
		/** Record every themed key present in an option bag (creation or a patch). */
		mark(opts: Partial<Record<K, unknown>>) {
			for (const k of keys) if (opts[k] !== undefined) named.add(k);
		},
		/** Is this key still the theme's to set? */
		owns(key: K) {
			return !named.has(key);
		}
	};
}
