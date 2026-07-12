<script lang="ts" generics="T extends string">
	// A segmented (single-choice) control — a pill of buttons where the active one
	// carries the accent. For 2–3 mutually exclusive options you flip often.
	import type { Component } from 'svelte';

	let {
		value = $bindable(),
		options,
		ariaLabel
	}: {
		value: T;
		options: { value: T; label?: string; icon?: Component }[];
		ariaLabel?: string;
	} = $props();
</script>

<div class="seg" role="group" aria-label={ariaLabel}>
	{#each options as o (o.value)}
		<button
			type="button"
			class:active={value === o.value}
			aria-pressed={value === o.value}
			title={o.value}
			onclick={() => (value = o.value)}
		>
			{#if o.icon}
				{@const Icon = o.icon}
				<Icon size={16} />
			{/if}
			{#if o.label}<span>{o.label}</span>{/if}
		</button>
	{/each}
</div>

<style>
	.seg {
		display: inline-flex;
		padding: 2px;
		gap: 2px;
		border: 1px solid var(--halo-border);
		border-radius: var(--halo-radius);
		background: var(--halo-bg-main);
	}
	button {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 4px 10px;
		border: none;
		border-radius: calc(var(--halo-radius) - 2px);
		background: none;
		font: inherit;
		font-size: 13px;
		color: var(--halo-text-muted);
		cursor: pointer;
		transition:
			background var(--halo-d-fast) ease-out,
			color var(--halo-d-fast) ease-out;
	}
	button:hover {
		color: var(--halo-text-main);
	}
	button.active {
		background: var(--halo-accent-soft);
		color: var(--halo-text-main);
	}
	button:focus-visible {
		outline: 2px solid var(--halo-accent);
		outline-offset: 1px;
	}
</style>
