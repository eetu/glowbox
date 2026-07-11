<script lang="ts">
	// Svelte wrapper around the plain-JS LED display. Give it a `size` and an
	// optional `draw(d, dt)` callback; the grouped option props (led/color/camera/
	// interaction/quality) mirror @glowbox/core's options 1:1 and update live. All
	// content is the client's — this ships no programs. (React/Vue wrappers can
	// mirror this over the same core.)
	import {
		type CameraOptions,
		type ColorOptions,
		createLedDisplay,
		type InteractionOptions,
		type LedDisplay,
		type LedOptions,
		type QualityOptions
	} from '@glowbox/core';
	import { untrack } from 'svelte';

	let {
		size,
		draw,
		led,
		color,
		camera,
		interaction,
		quality,
		oncreate
	}: {
		size: [number, number, number];
		draw?: (d: LedDisplay, dt: number) => void;
		led?: LedOptions;
		color?: ColorOptions;
		camera?: CameraOptions;
		interaction?: InteractionOptions;
		quality?: QualityOptions;
		/** Called with the display when (re)created, and with null on teardown —
		 *  an escape hatch for imperative access (snapshot(), stats, setCamera…). */
		oncreate?: (display: LedDisplay | null) => void;
	} = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);
	// $state.raw: the display is an opaque handle (owns a Float32Array + methods),
	// not reactive data — deep-proxying it would break identity checks and mutate
	// its buffer through a proxy.
	let display = $state.raw<LedDisplay | null>(null);

	// Create the display once for the canvas. Depends only on `canvas` — the option
	// groups and size are read untracked so changing them never re-creates (size
	// changes go through display.resize() below, which keeps the same canvas/context).
	$effect(() => {
		const el = canvas;
		if (!el) return;
		const d = untrack(() =>
			createLedDisplay(el, { size, led, color, camera, interaction, quality })
		);
		if (!d) {
			console.warn('LedGrid: WebGL unavailable');
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

	// Resize the grid in place when the dimensions change (no remount / context loss).
	$effect(() => {
		const [x, y, z] = size;
		display?.resize([x, y, z]);
	});

	// Live-update each option group *independently*. Patching all groups on any one change
	// would re-send `camera` (yaw/pitch/distance) on, say, a colour tweak — snapping the
	// view back and fighting drag / auto-orbit. One effect per group patches only what changed.
	$effect(() => {
		display?.setOptions({ led });
	});
	$effect(() => {
		display?.setOptions({ color });
	});
	$effect(() => {
		display?.setOptions({ camera });
	});
	$effect(() => {
		display?.setOptions({ interaction });
	});
	$effect(() => {
		display?.setOptions({ quality });
	});

	// (Re)bind the per-frame draw callback.
	$effect(() => {
		const d = display;
		if (!d || !draw) return;
		return d.onFrame(draw);
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
