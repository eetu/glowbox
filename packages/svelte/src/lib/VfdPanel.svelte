<script lang="ts">
	// Svelte wrapper around @glowbox/vfd's canvas panel. Declare the hardware once
	// (`frame` + `layout`) and drive the content — either declaratively through
	// `values`, or imperatively through the handle from `oncreate`, which is what an
	// animated spectrum wants. The canvas fills its parent — size the parent to size
	// the panel. Ships in @glowbox/svelte alongside <LedGrid> + <NixieTube> +
	// <SevenSegment> + <FlipDots> + <SplitFlap> + <NeonSign>, over the sibling
	// @glowbox/vfd core.
	import {
		createVfdPanel,
		type VfdPanel as VfdPanelHandle,
		type VfdPanelOptions
	} from '@glowbox/vfd';
	import { untrack } from 'svelte';

	/** What a panel element can be told to show, dispatched by the value's own type. */
	type VfdValue = string | number | boolean | number[];

	let {
		frame,
		layout,
		values,
		phosphor,
		filter,
		zones,
		brightness,
		persistence,
		filament,
		grid,
		age,
		glow,
		bezel,
		glass,
		on,
		selfTest,
		pixelRatio,
		label,
		oncreate
	}: {
		/** The panel design frame, `[width, height]` — the units every element box is in. */
		frame?: VfdPanelOptions['frame'];
		/** The elements printed on the plate. Fixed hardware: a change re-compiles the whole
		 *  anode inventory, so hand over a stable array rather than rebuilding it inline. */
		layout?: VfdPanelOptions['layout'];
		/** Content by element name, pushed on change: a string/number drives a `digits`
		 *  field or a `scale` cursor, a boolean switches a `legend`/`icon`, a number[]
		 *  feeds a `bars` element. Only changed entries are pushed. */
		values?: Record<string, VfdValue>;
		/** Anode phosphor: 'zn-o' (the stereo cyan-green), 'blue', 'amber', 'white'. */
		phosphor?: VfdPanelOptions['phosphor'];
		/** The tinted window: 'none' | 'green' | 'smoke' | 'amber', or any colour. */
		filter?: VfdPanelOptions['filter'];
		/** Extra tinted windows over regions of the glass — a zone belongs to the panel, not
		 *  to an element, because that is what it is: plastic laid over a rectangle. */
		zones?: VfdPanelOptions['zones'];
		/** THE DIMMER 0..1 — the whole panel at once, non-linearly. 0 is DISPLAY OFF. */
		brightness?: number;
		/** Phosphor persistence 0..1 — the smear a falling bar leaves behind it. */
		persistence?: number;
		/** The filament wires across the glass, over everything. */
		filament?: boolean;
		/** The control-grid mesh, continuous across the panel. */
		grid?: boolean;
		/** Wear 0..1: per-anode dimming → a dim multiplex column → flicker → dead. */
		age?: number;
		glow?: number;
		/** The faceplate around the glass; null = transparent outside the glass. */
		bezel?: VfdPanelOptions['bezel'];
		/** The unlit glass itself. */
		glass?: VfdPanelOptions['glass'];
		/** Power — off leaves the glass and its ghosts visible. */
		on?: boolean;
		/** Light every anode for ~1 s on power-on before settling. */
		selfTest?: boolean;
		pixelRatio?: number;
		label?: string;
		/** Called with the panel when created, and null on teardown — the imperative
		 *  escape hatch, and the right way to drive a spectrum at frame rate. */
		oncreate?: (panel: VfdPanelHandle | null) => void;
	} = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);
	// $state.raw: the panel is an opaque handle (owns a 2D context + methods), not reactive data.
	let panel = $state.raw<VfdPanelHandle | null>(null);
	// Last-pushed content, so an unchanged value never re-drives the envelope.
	let pushed: Record<string, string> = {};

	// Create the panel once for the canvas — options are read untracked so changing
	// them never re-creates (content goes through set/light/bars, appearance through
	// setOptions).
	$effect(() => {
		const el = canvas;
		if (!el) return;
		const p = untrack(() =>
			createVfdPanel(el, {
				frame,
				layout,
				phosphor,
				filter,
				zones,
				brightness,
				persistence,
				filament,
				grid,
				age,
				glow,
				bezel,
				glass,
				on,
				selfTest,
				pixelRatio,
				label
			})
		);
		if (!p) {
			console.warn('VfdPanel: 2D canvas unavailable');
			return;
		}
		panel = p;
		pushed = {};
		untrack(() => oncreate?.(p));
		return () => {
			p.dispose();
			if (panel === p) panel = null;
			untrack(() => oncreate?.(null));
		};
	});

	// Push changed content. The value's own type says which wire it goes down, so the
	// caller never has to restate the element's kind.
	$effect(() => {
		const p = panel;
		if (!p || !values) return;
		for (const [name, value] of Object.entries(values)) {
			const key = JSON.stringify(value);
			if (pushed[name] === key) continue;
			pushed[name] = key;
			if (typeof value === 'boolean') p.light(name, value);
			else if (Array.isArray(value)) p.setBars(name, value);
			else p.set(name, value);
		}
	});

	// The hardware gets its own effect and its own call: re-compiling the anode inventory is
	// the one expensive thing here, so it must not ride along with the appearance patch below,
	// which is cheap and fires on every prop change.
	$effect(() => {
		if (layout) panel?.setLayout(layout, frame);
	});

	// Live-update appearance. Nothing here re-compiles.
	$effect(() => {
		panel?.setOptions({
			phosphor,
			filter,
			zones,
			brightness,
			persistence,
			filament,
			grid,
			age,
			glow,
			bezel,
			glass,
			on,
			selfTest,
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
