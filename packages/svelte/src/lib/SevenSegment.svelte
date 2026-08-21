<script lang="ts">
	// Svelte wrapper around @glowbox/seven-segment's canvas digit. Give it a `value`
	// (the shown symbol) plus optional appearance props that mirror the core options and
	// update live. The canvas fills its parent — size the parent to size the digit.
	// Ships in @glowbox/svelte alongside <LedGrid> + <NixieTube>, over the sibling
	// @glowbox/seven-segment core.
	import {
		createSevenSegment,
		type SevenSegmentDisplay,
		type SevenSegmentOptions,
		type SevenSegmentStyle
	} from '@glowbox/seven-segment';
	import { untrack } from 'svelte';

	let {
		value = null,
		displayStyle = 'led',
		dp,
		color,
		glow,
		background,
		ghost,
		bare,
		age,
		transition,
		pixelRatio,
		theme,
		label,
		class: className,
		style,
		oncreate
	}: {
		/** The shown symbol: `0`–`9`, `-`, hex `A b C d E F`, `:`, or null/'' for dark. */
		value?: string | number | null;
		/** Display material — maps to the core `style` option (renamed to avoid the DOM `style`). */
		displayStyle?: SevenSegmentStyle;
		/** Light the decimal point. */
		dp?: boolean;
		color?: SevenSegmentOptions['color'];
		glow?: number;
		background?: SevenSegmentOptions['background'];
		ghost?: boolean;
		/** Drop the window module — segments on a transparent canvas. */
		bare?: boolean;
		/** Wear 0..1 — per-segment dimming, then flicker, then a dead segment. */
		age?: number;
		/** Per-segment cross-fade ms on value changes. */
		transition?: number;
		pixelRatio?: number;
		/** Accessible name (`aria-label`); defaults to the shown symbol itself. */
		label?: string;
		/** Colour bundle: 'dark' (default), 'light', or 'auto' to follow the page. */
		theme?: SevenSegmentOptions['theme'];
		/** Called with the display when created, and null on teardown — imperative escape hatch. */
		oncreate?: (display: SevenSegmentDisplay | null) => void;
		/** Forwarded to the <canvas>. */
		class?: string;
		/** Inline style forwarded to the <canvas>; wins over the built-in block/fill sizing. */
		style?: string;
	} = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);
	// $state.raw: the display is an opaque handle (owns a 2D context + methods), not reactive data.
	let display = $state.raw<SevenSegmentDisplay | null>(null);

	// Create the display once for the canvas — options are read untracked so changing
	// them never re-creates (value goes through setValue, appearance through setOptions).
	$effect(() => {
		const el = canvas;
		if (!el) return;
		const d = untrack(() =>
			createSevenSegment(el, {
				value,
				style: displayStyle,
				dp,
				color,
				glow,
				background,
				ghost,
				bare,
				age,
				transition,
				pixelRatio,
				theme,
				label
			})
		);
		if (!d) {
			console.warn('SevenSegment: 2D canvas unavailable');
			return;
		}
		display = d;
		untrack(() => oncreate?.(d));
		return () => {
			d.dispose();
			if (display === d) display = null;
			untrack(() => oncreate?.(null));
		};
	});

	// Live-update the shown symbol.
	$effect(() => {
		display?.setValue(value);
	});

	// Live-update appearance when any option changes.
	$effect(() => {
		display?.setOptions({
			style: displayStyle,
			dp,
			color,
			glow,
			background,
			ghost,
			bare,
			age,
			transition,
			pixelRatio,
			theme,
			label
		});
	});
</script>

<canvas bind:this={canvas} class={className} {style}></canvas>

<style>
	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
