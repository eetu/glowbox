// The demo's display-theme choice, one per route: does the hardware follow the page
// chrome, or is it pinned? The cores take `theme: 'dark' | 'light' | 'auto'`; a page
// that follows the header toggle hands them the page's own mode, so 'auto' reaches
// the core and the core does its own prefers-color-scheme listening.
import { theme } from '$lib/theme.svelte';

export type DisplayThemeChoice = 'page' | 'dark' | 'light';

export const DISPLAY_THEME_OPTIONS: { value: DisplayThemeChoice; label: string }[] = [
	{ value: 'page', label: 'Page' },
	{ value: 'dark', label: 'Dark' },
	{ value: 'light', label: 'Light' }
];

/** The value to hand a core's `theme` option. */
export function coreTheme(choice: DisplayThemeChoice): 'dark' | 'light' | 'auto' {
	return choice === 'page' ? theme.mode : choice;
}

/** Which scheme that actually paints — for the page's own stage colours, which are
 *  CSS and cannot ask the core. */
export function displayScheme(choice: DisplayThemeChoice): 'dark' | 'light' {
	const mode = coreTheme(choice);
	if (mode !== 'auto') return mode;
	return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: light)').matches
		? 'light'
		: 'dark';
}
