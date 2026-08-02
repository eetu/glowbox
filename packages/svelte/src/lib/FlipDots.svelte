<script lang="ts">
	// Svelte wrapper around @glowbox/flip-dot's canvas board. Give it a `frame`
	// (row-major 0/1 bits or an (x, y) => on function) plus optional appearance props
	// that mirror the core options and update live. The canvas fills its parent —
	// size the parent to size the board. Ships in @glowbox/svelte alongside
	// <LedGrid> + <NixieTube> + <SevenSegment>, over the sibling @glowbox/flip-dot core.
	import {
		createFlipDots,
		type FlipDotBoard,
		type FlipDotShape,
		type FlipDotsOptions,
		type FlipDotStagger
	} from '@glowbox/flip-dot';
	import { untrack } from 'svelte';

	let {
		frame,
		cols,
		rows,
		shape,
		onColor,
		offColor,
		board,
		gap,
		shaded,
		flipMs,
		axis,
		stagger,
		scanMs,
		sound,
		pixelRatio,
		label,
		class: className,
		style,
		oncreate
	}: {
		/** The shown frame: row-major 0/1 bits (`ditherFrame` output fits) or an
		 *  (x, y) => on function. Only dots that actually change flip. */
		frame?: ArrayLike<number> | ((x: number, y: number) => number | boolean);
		cols?: number;
		rows?: number;
		shape?: FlipDotShape;
		onColor?: FlipDotsOptions['onColor'];
		offColor?: FlipDotsOptions['offColor'];
		/** Board plastic behind the dots. */
		board?: FlipDotsOptions['board'];
		gap?: number;
		/** Opt-in lighting story (gradients, socket wells, glint); flat matte default. */
		shaded?: boolean;
		flipMs?: number;
		/** Pivot-axis angle in degrees. */
		axis?: number;
		stagger?: FlipDotStagger;
		scanMs?: number;
		/** Solenoid click: true (= 0.5) or a 0..1 volume. */
		sound?: boolean | number;
		pixelRatio?: number;
		label?: string;
		/** Called with the board when created, and null on teardown — imperative escape hatch. */
		oncreate?: (board: FlipDotBoard | null) => void;
		/** Forwarded to the <canvas>. */
		class?: string;
		/** Inline style forwarded to the <canvas>; wins over the built-in block/fill sizing. */
		style?: string;
	} = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);
	// $state.raw: the board is an opaque handle (owns a 2D context + methods), not reactive data.
	let dots = $state.raw<FlipDotBoard | null>(null);

	// Create the board once for the canvas — options are read untracked so changing
	// them never re-creates (content goes through setFrame, appearance through setOptions).
	$effect(() => {
		const el = canvas;
		if (!el) return;
		const b = untrack(() =>
			createFlipDots(el, {
				cols,
				rows,
				shape,
				onColor,
				offColor,
				board,
				gap,
				shaded,
				flipMs,
				axis,
				stagger,
				scanMs,
				sound,
				pixelRatio,
				label
			})
		);
		if (!b) {
			console.warn('FlipDots: 2D canvas unavailable');
			return;
		}
		dots = b;
		untrack(() => {
			if (frame) b.setFrame(frame);
			oncreate?.(b);
		});
		return () => {
			b.dispose();
			if (dots === b) dots = null;
			untrack(() => oncreate?.(null));
		};
	});

	// Live-update the shown frame.
	$effect(() => {
		if (frame) dots?.setFrame(frame);
	});

	// Live-update appearance when any option changes.
	$effect(() => {
		dots?.setOptions({
			cols,
			rows,
			shape,
			onColor,
			offColor,
			board,
			gap,
			shaded,
			flipMs,
			axis,
			stagger,
			scanMs,
			sound,
			pixelRatio,
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
