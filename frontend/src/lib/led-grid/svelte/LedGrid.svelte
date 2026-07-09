<script lang="ts">
	// Svelte wrapper around the plain-JS LED display. Give it a `size` and an
	// optional `draw(d, dt)` callback; it mounts a canvas, wires the display, and
	// runs your draw each frame. All content is the client's — this ships no
	// programs. (React/Vue wrappers can mirror this over the same core.)
	import { createLedDisplay, type LedDisplay, type RGB } from '../core/led-display';

	let {
		size,
		draw,
		autoOrbit = true,
		drag = true,
		gain = 1,
		background
	}: {
		size: [number, number, number];
		draw?: (d: LedDisplay, dt: number) => void;
		autoOrbit?: boolean;
		drag?: boolean;
		gain?: number;
		background?: RGB;
	} = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);

	$effect(() => {
		const el = canvas;
		if (!el) return;
		const d = createLedDisplay(el, { size, autoOrbit, drag, gain, background });
		if (!d) {
			console.warn('LedGrid: WebGL unavailable');
			return;
		}
		const stop = draw ? d.onFrame(draw) : undefined;
		return () => {
			stop?.();
			d.dispose();
		};
	});
</script>

<canvas bind:this={canvas}></canvas>

<style>
	canvas {
		display: block;
		width: 100%;
		height: 100%;
		touch-action: none; /* let drag-orbit work without the page panning */
	}
</style>
