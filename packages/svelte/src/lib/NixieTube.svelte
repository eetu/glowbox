<script lang="ts">
	// Svelte wrapper around @glowbox/nixie's canvas tube. Give it a `value` (the lit
	// symbol) plus optional appearance props that mirror the core NixieOptions and update
	// live. The canvas fills its parent — size the parent to size the tube. Ships in
	// @glowbox/svelte alongside <LedGrid>, over the sibling @glowbox/nixie core.
	import {
		createNixieTube,
		type NixieOptions,
		type NixieStyle,
		type NixieTube
	} from '@glowbox/nixie';
	import { untrack } from 'svelte';

	let {
		value = null,
		tubeStyle = 'classic',
		color,
		glow,
		background,
		mesh,
		ghost,
		wire,
		pixelRatio,
		theme,
		label,
		class: className,
		style,
		oncreate
	}: {
		/** The lit symbol: a char `0`–`9`, `:`, `-`, or null/'' for all-cathodes-dark. */
		value?: string | number | null;
		/** Physical tube style — maps to the core `style` option (renamed to avoid the DOM `style`). */
		tubeStyle?: NixieStyle;
		color?: NixieOptions['color'];
		glow?: number;
		background?: NixieOptions['background'];
		mesh?: boolean;
		ghost?: boolean;
		/** Unlit cathode-wire colour — the filament stack behind the glass. */
		wire?: NixieOptions['wire'];
		pixelRatio?: number;
		/** Accessible name (`aria-label`); defaults to the lit symbol itself. */
		label?: string;
		/** Colour bundle: 'dark' (default), 'light', or 'auto' to follow the page. */
		theme?: NixieOptions['theme'];
		/** Called with the tube when created, and null on teardown — imperative escape hatch. */
		oncreate?: (tube: NixieTube | null) => void;
		/** Forwarded to the <canvas>. */
		class?: string;
		/** Inline style forwarded to the <canvas>; wins over the built-in block/fill sizing. */
		style?: string;
	} = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);
	// $state.raw: the tube is an opaque handle (owns a 2D context + methods), not reactive data.
	let tube = $state.raw<NixieTube | null>(null);

	// Create the tube once for the canvas — options are read untracked so changing them
	// never re-creates (value goes through setValue, appearance through setOptions below).
	$effect(() => {
		const el = canvas;
		if (!el) return;
		const t = untrack(() =>
			createNixieTube(el, {
				value,
				style: tubeStyle,
				color,
				glow,
				background,
				mesh,
				ghost,
				wire,
				pixelRatio,
				theme,
				label
			})
		);
		if (!t) {
			console.warn('NixieTube: 2D canvas unavailable');
			return;
		}
		tube = t;
		untrack(() => oncreate?.(t));
		return () => {
			t.dispose();
			if (tube === t) tube = null;
			untrack(() => oncreate?.(null));
		};
	});

	// Live-update the lit symbol.
	$effect(() => {
		tube?.setValue(value);
	});

	// Live-update appearance when any option changes.
	$effect(() => {
		tube?.setOptions({
			style: tubeStyle,
			color,
			glow,
			background,
			mesh,
			ghost,
			wire,
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
