<script lang="ts" generics="T extends string">
	// A styled native <select> with a Lucide chevron. Native keeps it accessible and
	// keyboard/e2e-friendly; we only restyle the shell.
	import ChevronDown from '@lucide/svelte/icons/chevron-down';

	let {
		value = $bindable(),
		options,
		ariaLabel,
		onchange
	}: {
		value: T;
		options: { value: T; label: string; disabled?: boolean }[];
		ariaLabel?: string;
		onchange?: () => void;
	} = $props();
</script>

<span class="field">
	<select bind:value aria-label={ariaLabel} {onchange}>
		{#each options as o (o.value)}
			<option value={o.value} disabled={o.disabled}>{o.label}</option>
		{/each}
	</select>
	<ChevronDown size={16} />
</span>

<style>
	.field {
		position: relative;
		display: inline-flex;
		align-items: center;
	}
	.field :global(svg) {
		position: absolute;
		right: 8px;
		color: var(--halo-text-muted);
		pointer-events: none;
	}
	select {
		appearance: none;
		font: inherit;
		font-size: 13px;
		height: 32px;
		padding: 0 30px 0 10px;
		border: 1px solid var(--halo-border);
		border-radius: var(--halo-radius);
		background: var(--halo-bg-main);
		color: var(--halo-text-main);
		cursor: pointer;
		transition: border-color var(--halo-d-fast) ease-out;
	}
	select:hover {
		border-color: var(--halo-text-muted);
	}
	select:focus-visible {
		outline: 2px solid var(--halo-accent);
		outline-offset: 1px;
	}
</style>
