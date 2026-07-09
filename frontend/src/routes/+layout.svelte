<script lang="ts">
	import '$lib/styles/halo.css';

	let { children } = $props();
</script>

{@render children()}

<style>
	:global(html),
	:global(body) {
		margin: 0;
		height: 100%;
		background: var(--halo-body);
		color: var(--halo-text-main);
		font-family: 'Inter', system-ui, sans-serif;
	}
	:global(*) {
		box-sizing: border-box;
	}
</style>
