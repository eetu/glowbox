<script lang="ts">
	// Header theme control: one button that flips dark <-> light, showing the theme it
	// would switch TO. It drives the page chrome AND every display on the page, so a
	// route is one theme all the way down.
	import Moon from '@lucide/svelte/icons/moon';
	import Sun from '@lucide/svelte/icons/sun';

	import { cycleTheme, theme } from '$lib/theme.svelte';

	const next = $derived(theme.mode === 'dark' ? 'light' : 'dark');
	const Icon = $derived(theme.mode === 'dark' ? Sun : Moon);
</script>

<button
	class="theme-toggle"
	onclick={cycleTheme}
	title="{next} theme"
	aria-label="switch to the {next} theme"
>
	<Icon size={18} />
</button>

<style>
	.theme-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border: 1px solid var(--halo-border);
		border-radius: var(--halo-radius);
		background: var(--halo-bg-main);
		color: var(--halo-text-main);
		cursor: pointer;
		transition: color var(--halo-d-fast) ease-out;
	}
	.theme-toggle:hover {
		color: var(--halo-accent);
	}
	.theme-toggle:focus-visible {
		outline: 2px solid var(--halo-accent);
		outline-offset: 1px;
	}
</style>
