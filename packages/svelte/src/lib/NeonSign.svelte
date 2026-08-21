<script lang="ts">
	// Svelte wrapper around @glowbox/neon's canvas sign. Give it `text` (new glass
	// strikes on) plus optional appearance props that mirror the core options and
	// update live. The canvas fills its parent — size the parent to size the sign.
	// Ships in @glowbox/svelte alongside <LedGrid> + <NixieTube> + <SevenSegment> +
	// <FlipDots> + <SplitFlap>, over the sibling @glowbox/neon core.
	import {
		createNeonSign,
		type NeonSign as NeonSignHandle,
		type NeonSignOptions
	} from '@glowbox/neon';
	import { untrack } from 'svelte';

	let {
		text,
		font,
		art,
		color,
		gas,
		wall,
		polarity,
		on,
		lineOn,
		glow,
		glass,
		electrode,
		age,
		flicker,
		tired,
		program,
		speed,
		tubes,
		align,
		lineSpacing,
		letterSpacing,
		tilt,
		padding,
		strikeMs,
		sound,
		mains,
		pixelRatio,
		theme,
		label,
		class: className,
		style,
		oncreate
	}: {
		/** The sign's text; '\n' splits lines. A change re-glasses and strikes on. */
		text?: string;
		/** Letterform: 'script' (cursive), 'sans' (block), or a custom NeonFont. */
		font?: NeonSignOptions['font'];
		/** Sign artwork: single-stroke pieces placed behind/beside the text. */
		art?: NeonSignOptions['art'];
		/** Tube colour, or one per text line (overrides the gas preset's colour). */
		color?: NeonSignOptions['color'];
		/** What's in the glass: 'neon', 'argon', 'helium', 'co2', 'green', 'gold', 'rose'. */
		gas?: NeonSignOptions['gas'];
		/** The wall behind the sign; null = transparent canvas. */
		wall?: NeonSignOptions['wall'];
		/** Discharge direction: 'emit' (light) or the invented 'absorb' (dark ink). */
		polarity?: NeonSignOptions['polarity'];
		/** Power — off leaves the unlit glass visible; on re-strikes. */
		on?: boolean;
		/** Per-text-line circuits (the motel sign's separately switched NO). */
		lineOn?: boolean[];
		glow?: number;
		/** The unlit tube itself. */
		glass?: NeonSignOptions['glass'];
		/** The electrode caps — metal, not light. */
		electrode?: NeonSignOptions['electrode'];
		/** Wear 0..1: dimming → a flickering tube → dead glass (the MOT L arc). */
		age?: number;
		/** Electrical instability 0..1: sparse dips and re-strike blips. */
		flicker?: number;
		/** A failing transformer: whole-sign dropouts with staggered re-strikes. */
		tired?: boolean;
		/** The flasher cam: 'steady' | 'flash' | 'chase' | 'reveal' (rate-capped). */
		program?: NeonSignOptions['program'];
		speed?: number;
		/** Tube sectioning: 'auto' | 'glyph' | 'word' | 'line'. */
		tubes?: NeonSignOptions['tubes'];
		align?: NeonSignOptions['align'];
		lineSpacing?: number;
		letterSpacing?: number;
		/** Text block tilt, degrees (negative rises left-to-right). */
		tilt?: number;
		padding?: number;
		/** One tube's strike sequence, ms (0 = instant). */
		strikeMs?: number;
		/** Transformer hum + strike crackle: true (= 0.5) or a 0..1 volume. */
		sound?: boolean | number;
		/** Mains frequency the transformer sings at (50 or 60). */
		mains?: NeonSignOptions['mains'];
		pixelRatio?: number;
		label?: string;
		/** Colour bundle: 'dark' (default), 'light', or 'auto' to follow the page. */
		theme?: NeonSignOptions['theme'];
		/** Called with the sign when created, and null on teardown — imperative escape hatch. */
		oncreate?: (sign: NeonSignHandle | null) => void;
		/** Forwarded to the <canvas>. */
		class?: string;
		/** Inline style forwarded to the <canvas>; wins over the built-in block/fill sizing. */
		style?: string;
	} = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);
	// $state.raw: the sign is an opaque handle (owns a 2D context + methods), not reactive data.
	let sign = $state.raw<NeonSignHandle | null>(null);

	// Create the sign once for the canvas — options are read untracked so changing
	// them never re-creates (content goes through setText, appearance through setOptions).
	$effect(() => {
		const el = canvas;
		if (!el) return;
		const s = untrack(() =>
			createNeonSign(el, {
				text,
				font,
				art,
				color,
				gas,
				wall,
				polarity,
				on,
				lineOn,
				glow,
				glass,
				electrode,
				age,
				flicker,
				tired,
				program,
				speed,
				tubes,
				align,
				lineSpacing,
				letterSpacing,
				tilt,
				padding,
				strikeMs,
				sound,
				mains,
				pixelRatio,
				theme,
				label
			})
		);
		if (!s) {
			console.warn('NeonSign: 2D canvas unavailable');
			return;
		}
		sign = s;
		untrack(() => oncreate?.(s));
		return () => {
			s.dispose();
			if (sign === s) sign = null;
			untrack(() => oncreate?.(null));
		};
	});

	// Live-update the shown text (a change re-glasses and strikes).
	$effect(() => {
		if (text != null) sign?.setText(text);
	});

	// Live-update appearance when any option changes.
	$effect(() => {
		sign?.setOptions({
			font,
			art,
			color,
			gas,
			wall,
			polarity,
			on,
			lineOn,
			glow,
			glass,
			electrode,
			age,
			flicker,
			tired,
			program,
			speed,
			tubes,
			align,
			lineSpacing,
			letterSpacing,
			tilt,
			padding,
			strikeMs,
			sound,
			mains,
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
