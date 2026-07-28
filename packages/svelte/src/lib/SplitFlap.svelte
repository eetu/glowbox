<script lang="ts">
	// Svelte wrapper around @glowbox/split-flap's canvas board. Give it `text`
	// (a string or one string per row — modules spin forward to it) plus optional
	// appearance props that mirror the core options and update live. The canvas
	// fills its parent — size the parent to size the board. Ships in
	// @glowbox/svelte alongside <LedGrid> + <NixieTube> + <SevenSegment> +
	// <FlipDots>, over the sibling @glowbox/split-flap core.
	import { createSplitFlap, type SplitFlapBoard, type SplitFlapOptions } from '@glowbox/split-flap';
	import { untrack } from 'svelte';

	let {
		text,
		cols,
		rows,
		charset,
		palette,
		card,
		ink,
		board,
		gap,
		font,
		shaded,
		flipMs,
		sound,
		pixelRatio,
		label,
		oncreate
	}: {
		/** The shown text: a string (newlines split rows) or one string per row.
		 *  Only modules whose character changes spin — forward, wrapping the drum. */
		text?: string | string[];
		cols?: number;
		rows?: number;
		/** The drum: flap sequence in rotation order. */
		charset?: string;
		/** Per-flap faces: solid paint (chroma flaps) or re-inked glyphs. */
		palette?: SplitFlapOptions['palette'];
		card?: SplitFlapOptions['card'];
		ink?: SplitFlapOptions['ink'];
		/** Frame behind/between the modules. */
		board?: SplitFlapOptions['board'];
		gap?: number;
		font?: string;
		/** Opt-in lighting story (wells, clips, the fallen pile); flat matte default. */
		shaded?: boolean;
		flipMs?: number;
		/** Card slap: true (= 0.5) or a 0..1 volume. */
		sound?: boolean | number;
		pixelRatio?: number;
		label?: string;
		/** Called with the board when created, and null on teardown — imperative escape hatch. */
		oncreate?: (board: SplitFlapBoard | null) => void;
	} = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);
	// $state.raw: the board is an opaque handle (owns a 2D context + methods), not reactive data.
	let flaps = $state.raw<SplitFlapBoard | null>(null);

	// Create the board once for the canvas — options are read untracked so changing
	// them never re-creates (content goes through setText, appearance through setOptions).
	$effect(() => {
		const el = canvas;
		if (!el) return;
		const b = untrack(() =>
			createSplitFlap(el, {
				cols,
				rows,
				charset,
				palette,
				card,
				ink,
				board,
				gap,
				font,
				shaded,
				flipMs,
				sound,
				pixelRatio,
				label
			})
		);
		if (!b) {
			console.warn('SplitFlap: 2D canvas unavailable');
			return;
		}
		flaps = b;
		untrack(() => {
			if (text != null) b.setText(text);
			oncreate?.(b);
		});
		return () => {
			b.dispose();
			if (flaps === b) flaps = null;
			untrack(() => oncreate?.(null));
		};
	});

	// Live-update the shown text.
	$effect(() => {
		if (text != null) flaps?.setText(text);
	});

	// Live-update appearance when any option changes.
	$effect(() => {
		flaps?.setOptions({
			cols,
			rows,
			charset,
			palette,
			card,
			ink,
			board,
			gap,
			font,
			shaded,
			flipMs,
			sound,
			pixelRatio,
			label
		});
	});
</script>

<canvas bind:this={canvas}></canvas>

<style>
	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
