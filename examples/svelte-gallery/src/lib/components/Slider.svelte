<script lang="ts">
	// A labelled range with the filled portion in the accent ("lit") and the current
	// value shown inline. Can be disabled with a one-line reason (for style-specific
	// controls that don't apply to the active style).
	let {
		label,
		value = $bindable(),
		min,
		max,
		step = 0.01,
		disabled = false,
		hint,
		format = (v: number) => v.toFixed(2)
	}: {
		label: string;
		value: number;
		min: number;
		max: number;
		step?: number;
		disabled?: boolean;
		hint?: string;
		format?: (v: number) => string;
	} = $props();

	const pct = $derived(((value - min) / (max - min)) * 100);
</script>

<div class="slider" class:disabled>
	<div class="top">
		<span class="label">{label}</span>
		<span class="value">{format(value)}</span>
	</div>
	<input
		type="range"
		{min}
		{max}
		{step}
		bind:value
		{disabled}
		aria-label={label}
		style="--pct: {pct}%"
	/>
	{#if hint}<span class="hint">{hint}</span>{/if}
</div>

<style>
	.slider {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.slider.disabled {
		opacity: 0.45;
	}
	.slider.disabled input {
		pointer-events: none;
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		font-size: 13px;
	}
	.label {
		color: var(--halo-text-main);
	}
	.value {
		color: var(--halo-text-muted);
		font-variant-numeric: tabular-nums;
	}
	.hint {
		font-size: 11px;
		color: var(--halo-text-muted);
	}

	input[type='range'] {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 16px;
		background: none;
		cursor: pointer;
	}
	/* Filled (accent) up to the thumb, then the unlit track. */
	input[type='range']::-webkit-slider-runnable-track {
		height: 4px;
		border-radius: 2px;
		background: linear-gradient(
			to right,
			var(--halo-accent) 0 var(--pct),
			var(--halo-border) var(--pct) 100%
		);
	}
	input[type='range']::-moz-range-track {
		height: 4px;
		border-radius: 2px;
		background: linear-gradient(
			to right,
			var(--halo-accent) 0 var(--pct),
			var(--halo-border) var(--pct) 100%
		);
	}
	input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 14px;
		height: 14px;
		margin-top: -5px;
		border-radius: 50%;
		border: 1px solid var(--halo-border);
		background: var(--halo-bg-main);
		box-shadow: var(--halo-shadow);
		transition: border-color var(--halo-d-fast) ease-out;
	}
	input[type='range']::-moz-range-thumb {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 1px solid var(--halo-border);
		background: var(--halo-bg-main);
	}
	input[type='range']:hover::-webkit-slider-thumb,
	input[type='range']:active::-webkit-slider-thumb {
		border-color: var(--halo-accent);
	}
	input[type='range']:focus-visible {
		outline: 2px solid var(--halo-accent);
		outline-offset: 2px;
		border-radius: 2px;
	}
</style>
