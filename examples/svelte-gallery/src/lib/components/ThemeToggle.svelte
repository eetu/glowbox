<script lang="ts">
	// Header theme control: one button that cycles auto → light → dark, showing the
	// current mode's icon. Shared by both demos so theming reads as one app.
	import Monitor from '@lucide/svelte/icons/monitor';
	import Moon from '@lucide/svelte/icons/moon';
	import Sun from '@lucide/svelte/icons/sun';

	import { cycleTheme, theme } from '$lib/theme.svelte';

	const Icon = $derived(theme.mode === 'light' ? Sun : theme.mode === 'dark' ? Moon : Monitor);
</script>

<button
	class="theme-toggle"
	onclick={cycleTheme}
	title="theme: {theme.mode} (click to change)"
	aria-label="theme: {theme.mode}, click to change"
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
