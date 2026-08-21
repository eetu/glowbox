<script lang="ts">
	// Svelte wrapper around @glowbox/lcd's canvas module. Give it `text` (a string or
	// one string per row — the crystals chase it at their own speed) plus optional
	// appearance props that mirror the core options and update live. CGRAM glyphs and
	// the cursor position are imperative — take the handle from `oncreate`. The canvas
	// fills its parent — size the parent to size the module. Ships in @glowbox/svelte
	// alongside the other seven displays, over the sibling @glowbox/lcd core.
	import { createLcdModule, type LcdModule, type LcdModuleOptions } from '@glowbox/lcd';
	import { untrack } from 'svelte';

	let {
		text,
		cols,
		rows,
		panel,
		backlight,
		contrast,
		response,
		ghost,
		cursor,
		age,
		glyphs,
		on,
		boot,
		bezel,
		bezelWidth,
		pixelRatio,
		theme,
		label,
		class: className,
		style,
		oncreate
	}: {
		/** The shown text: a string (newlines split rows) or one string per row.
		 *  The shutters take real time to move — new text smears in. */
		text?: string | string[];
		cols?: number;
		rows?: number;
		/** The glass: 'green' (STN, readable unlit), 'blue' (negative), 'white' (FSTN). */
		panel?: LcdModuleOptions['panel'];
		/** true/false or a 0..1 level; the negative blue glass needs it to read at all. */
		backlight?: boolean | number;
		/** The trimmer 0..1; past ~0.85 the lattice darkens and crosstalk streaks grow. */
		contrast?: number;
		/** Liquid-crystal speed 0..1 (0 snaps, 1 is cold glass). */
		response?: number;
		/** The resting dot lattice. */
		ghost?: boolean;
		/** 'none' | 'line' | 'block' (blinking); position via the handle's setCursor. */
		cursor?: LcdModuleOptions['cursor'];
		/** Wear 0..1: dimming, then a flickering column, then a dead column. */
		age?: number;
		/** Extension glyphs over the vendored ASCII face — character → 5×7 ASCII art
		 *  (the core exports LATIN_5X7 ready-made); null resets to the plain face. */
		glyphs?: LcdModuleOptions['glyphs'];
		/** Power — off drains the ink at crystal speed. */
		on?: boolean;
		/** The uninitialised boot row of solid blocks on power-up. */
		boot?: boolean;
		/** The plastic frame; null = no plastic, and the glass takes the room. */
		bezel?: LcdModuleOptions['bezel'];
		/** Frame thickness in dot pitches (default 3); 0 is the same as null. */
		bezelWidth?: number;
		pixelRatio?: number;
		label?: string;
		/** Colour bundle: 'dark' (default), 'light', or 'auto' to follow the page. */
		theme?: LcdModuleOptions['theme'];
		/** Called with the module when created, and null on teardown — imperative escape
		 *  hatch (setGlyph, setCursor, power). */
		oncreate?: (lcd: LcdModule | null) => void;
		/** Forwarded to the <canvas>. */
		class?: string;
		/** Inline style forwarded to the <canvas>; wins over the built-in block/fill sizing. */
		style?: string;
	} = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);
	// $state.raw: the module is an opaque handle (owns a 2D context + methods), not reactive data.
	let lcd = $state.raw<LcdModule | null>(null);

	// Create the module once for the canvas — options are read untracked so changing
	// them never re-creates (content goes through setText, appearance through setOptions).
	$effect(() => {
		const el = canvas;
		if (!el) return;
		const m = untrack(() =>
			createLcdModule(el, {
				text,
				cols,
				rows,
				panel,
				backlight,
				contrast,
				response,
				ghost,
				cursor,
				age,
				glyphs,
				on,
				boot,
				bezel,
				bezelWidth,
				pixelRatio,
				theme,
				label
			})
		);
		if (!m) {
			console.warn('LcdModule: 2D canvas unavailable');
			return;
		}
		lcd = m;
		untrack(() => oncreate?.(m));
		return () => {
			m.dispose();
			if (lcd === m) lcd = null;
			untrack(() => oncreate?.(null));
		};
	});

	// Live-update the shown text.
	$effect(() => {
		if (text != null) lcd?.setText(text);
	});

	// Live-update appearance when any option changes.
	$effect(() => {
		lcd?.setOptions({
			cols,
			rows,
			panel,
			backlight,
			contrast,
			response,
			ghost,
			cursor,
			age,
			glyphs,
			on,
			boot,
			bezel,
			bezelWidth,
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
