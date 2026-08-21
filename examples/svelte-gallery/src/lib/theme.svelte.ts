// Theme preference: dark (the default) or light, forced by setting `data-theme` on
// <html> (applied in +layout.svelte, keyed off by the halo tokens) and handed to every
// display core as its `theme` option, so the page and the hardware never disagree.
//
// No `auto` on purpose. These displays are glowing retro hardware and most of them are
// at their best in the dark, so the gallery opens dark whatever the visitor's OS says,
// and light is a deliberate choice one click away. The cores themselves DO take
// `theme: 'auto'` — an app that wants to follow `prefers-color-scheme` just passes it.
export type ThemeMode = 'dark' | 'light';

const KEY = 'glowbox:theme';

function initialMode(): ThemeMode {
	if (typeof localStorage === 'undefined') return 'dark';
	// 'auto' is a value older visits may have stored; it reads as the new default.
	return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
}

export const theme = $state<{ mode: ThemeMode }>({ mode: initialMode() });

export function setTheme(mode: ThemeMode) {
	theme.mode = mode;
	if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, mode);
}

/** The header button: one press, the other theme. */
export function cycleTheme() {
	setTheme(theme.mode === 'dark' ? 'light' : 'dark');
}
