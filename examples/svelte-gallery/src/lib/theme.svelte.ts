// Theme preference: auto / light / dark. `auto` (the default) follows the OS via the
// halo.css `prefers-color-scheme` media query; `light`/`dark` force it by setting
// `data-theme` on <html> (applied in +layout.svelte, keyed off by the halo tokens).
// The choice is persisted; the header ThemeToggle cycles through the three modes.

export type ThemeMode = 'auto' | 'light' | 'dark';

const KEY = 'glowbox:theme';

function initialMode(): ThemeMode {
	if (typeof localStorage === 'undefined') return 'auto';
	const v = localStorage.getItem(KEY);
	return v === 'light' || v === 'dark' || v === 'auto' ? v : 'auto';
}

export const theme = $state<{ mode: ThemeMode }>({ mode: initialMode() });

export function setTheme(mode: ThemeMode) {
	theme.mode = mode;
	if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, mode);
}

// Single cycling button: auto → light → dark → auto.
const ORDER: ThemeMode[] = ['auto', 'light', 'dark'];
export function cycleTheme() {
	setTheme(ORDER[(ORDER.indexOf(theme.mode) + 1) % ORDER.length]);
}
