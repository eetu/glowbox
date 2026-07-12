<script lang="ts">
	// An on/off chip wrapping a real checkbox (so it stays keyboard- and
	// screen-reader-accessible). Off = greyscale; on = accent.
	import type { Component } from 'svelte';

	let {
		checked = $bindable(),
		label,
		icon,
		ariaLabel
	}: {
		checked: boolean;
		label: string;
		icon?: Component;
		ariaLabel?: string;
	} = $props();
</script>

<label class="chip" class:on={checked}>
	<input type="checkbox" bind:checked aria-label={ariaLabel ?? label} />
	{#if icon}
		{@const Icon = icon}
		<Icon size={16} />
	{/if}
	<span>{label}</span>
</label>

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 10px;
		border: 1px solid var(--halo-border);
		border-radius: var(--halo-radius);
		background: var(--halo-bg-main);
		font-size: 13px;
		color: var(--halo-text-muted);
		cursor: pointer;
		user-select: none;
		transition:
			background var(--halo-d-fast) ease-out,
			color var(--halo-d-fast) ease-out,
			border-color var(--halo-d-fast) ease-out;
	}
	.chip:hover {
		border-color: var(--halo-text-muted);
		color: var(--halo-text-main);
	}
	.chip.on {
		background: var(--halo-accent-soft);
		color: var(--halo-text-main);
	}
	.chip.on :global(svg) {
		color: var(--halo-accent);
	}
	/* Keep the checkbox operable but invisible; the chip is the visual. */
	input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		pointer-events: none;
	}
	.chip:has(input:focus-visible) {
		outline: 2px solid var(--halo-accent);
		outline-offset: 2px;
	}
</style>
