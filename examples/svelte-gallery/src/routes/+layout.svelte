<script lang="ts">
	import '$lib/styles/halo.css';

	import { theme } from '$lib/theme.svelte';

	let { children } = $props();

	// The chosen theme is always forced via `data-theme` on <html> — the gallery opens
	// dark by choice, not by asking the OS (see $lib/theme.svelte).
	$effect(() => {
		document.documentElement.dataset.theme = theme.mode;
	});
</script>

{@render children()}

<style>
	:global(html),
	:global(body) {
		margin: 0;
		height: 100%;
		/* Fixed-viewport app shell: the header + stage fill the screen and the control
		   panel scrolls internally, so the page itself never scrolls (this also clips
		   the off-canvas mobile sheet so it can't create horizontal overflow). */
		overflow: hidden;
		background: var(--halo-body);
		color: var(--halo-text-main);
		font-family: 'Inter', system-ui, sans-serif;
	}
	:global(*) {
		box-sizing: border-box;
	}
</style>
