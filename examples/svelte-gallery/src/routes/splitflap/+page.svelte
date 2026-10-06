<script lang="ts">
	// A split-flap board on @glowbox/split-flap — one canvas, driven framework-free.
	// The point of this page is the mechanism a text cross-fade can't do: cards
	// falling from the drum about the hinge line, forward-only wrap-through
	// cascades — and turn SOUND on for the card-slap clatter.
	import { createCrtScreen } from '@glowbox/crt';
	import { createSplitFlap, flapPixels, type SplitFlapBoard } from '@glowbox/split-flap';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import X from '@lucide/svelte/icons/x';
	import { untrack } from 'svelte';

	import CoreNav from '$lib/components/CoreNav.svelte';
	import PixelStage, { type PixelPaint } from '$lib/components/PixelStage.svelte';
	import Segmented from '$lib/components/Segmented.svelte';
	import Select from '$lib/components/Select.svelte';
	import Slider from '$lib/components/Slider.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import ToggleChip from '$lib/components/ToggleChip.svelte';
	import { type ChromaKind, FLAP_SHOWS, type FlapShow } from '$lib/examples/splitflap';
	import {
		createPixelFlap,
		paintFlaps,
		type PixelFlapBoard,
		type PixelFlapView
	} from '$lib/examples/splitflap-pixel';
	import { theme } from '$lib/theme.svelte';

	let show = $state<FlapShow>('departures');
	let chromaKind = $state<ChromaKind>('rich');
	// Canvas is the component; pixel is the same board as data (`flapState`), painted the
	// way a game would into its own raster and scaled up by a whole number.
	let render = $state<'canvas' | 'pixel'>('canvas');
	// The tappable shows (they still self-play; a tap just takes the wheel).
	let interactive = $derived(show === 'counter' || show === 'scroller' || show === 'poll');

	// Panel resolution (cols × rows), preset-seeded and user-editable — the same
	// contract as the LED page's resolution section. Chroma re-tiles itself to a
	// finer image grid derived from the panel width.
	const clampDim = (v: number, max: number) => Math.max(2, Math.min(max, Math.round(v) || 2));
	let cols = $state(18);
	let rows = $state(6);
	const PRESETS: [number, number][] = [
		[12, 4],
		[18, 6],
		[24, 8],
		[30, 10],
		[36, 12]
	];
	const presetOptions = [
		{ value: 'custom', label: 'custom', disabled: true },
		...PRESETS.map(([c, r]) => ({ value: `${c}x${r}`, label: `${c} × ${r}` }))
	];
	let preset = $derived(
		PRESETS.some(([c, r]) => c === cols && r === rows) ? `${cols}x${rows}` : 'custom'
	);
	const applyPreset = () => {
		const m = /^(\d+)x(\d+)$/.exec(preset);
		if (m) {
			cols = Number(m[1]);
			rows = Number(m[2]);
		}
	};
	let soundOn = $state(false);
	let volume = $state(0.5);
	let shaded = $state(false);
	let flipMs = $state(90);
	let freeText = $state('GLOWBOX SPLIT-FLAP');
	let cardColor = $state('#1b1c1f');
	let inkColor = $state('#f4f4ef');
	let boardColor = $state('#0c0c0f');
	// The frame behind the modules: off is `board: null` — cards on the page.
	let frameOn = $state(true);
	let backdrop = $state('#0a0a0e');
	// Does the hardware follow the page's theme toggle, or is it pinned? The
	// stage follows the display, because dark ink on a dark stage is invisible.
	let backdropNamed = false;
	const scheme = $derived(theme.mode);
	// This page has a swatch for every colour the core's `theme` owns, and a named
	// colour stops being the theme's — so the switch moves the swatches, using the
	// core's own palette. Pick a colour afterwards and it stays until you flip again.
	$effect(() => {
		const light = scheme === 'light';
		cardColor = light ? '#f1efe8' : '#1b1c1f';
		inkColor = light ? '#1b1c1f' : '#f4f4ef';
		boardColor = light ? '#d6d2c8' : '#0c0c0f';
	});
	$effect(() => {
		if (!backdropNamed) backdrop = scheme === 'light' ? '#e9e7e1' : '#0a0a0e';
	});
	let crtOn = $state(false);
	let panelOpen = $state(false);
	const onKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Escape' && panelOpen) panelOpen = false;
	};

	// The board — 18×6 default, a small station hall; cells land near the ~2:3
	// card aspect of the real modules at the canvas's 2:1. A resolution change
	// recreates the board (fresh grid, blank power-up), which also restarts the
	// running show against the new module count.
	let canvas = $state<HTMLCanvasElement>();
	let board = $state.raw<SplitFlapBoard | null>(null);
	$effect(() => {
		if (!canvas) return;
		const c = clampDim(cols, 48);
		const r = clampDim(rows, 24);
		const b = createSplitFlap(
			canvas,
			untrack(() => ({
				cols: c,
				rows: r,
				shaded,
				flipMs,
				sound: soundOn ? volume : 0,
				card: cardColor,
				ink: inkColor,
				board: frameOn ? boardColor : null,
				theme: theme.mode
			}))
		);
		board = b;
		return () => {
			b?.dispose();
			board = null;
		};
	});
	$effect(() => {
		board?.setOptions({
			shaded,
			flipMs,
			sound: soundOn ? volume : 0,
			card: cardColor,
			ink: inkColor,
			board: frameOn ? boardColor : null,
			theme: theme.mode
		});
	});

	// The pixel render's board: the same commands, kept as data and read in closed form
	// each frame on the stage's clock. Odd card heights only: an even one takes a two-row
	// hinge, which reads as two letters stacked. 12 wide is where the print doubles.
	const CARDS = [
		[7, 11],
		[9, 15],
		[12, 19]
	] as const;
	const PAD = 2;
	const GAP = 1;
	const SEED = 7;
	let cardStep = $state(0);
	const card = $derived(CARDS[cardStep]);
	let grid = $state({ cols: 18, rows: 6 });
	const pixelLayout = $derived(flapPixels({ ...grid, card, gap: GAP }));
	let pixelBoard = $state.raw<PixelFlapBoard | null>(null);
	const pixelView = (): PixelFlapView | null => {
		const el = stageWrap?.querySelector<HTMLCanvasElement>('.pixel-stage canvas');
		return el ? { canvas: el, layout: pixelLayout, pad: PAD } : null;
	};
	$effect(() => {
		if (render !== 'pixel') return;
		const c = clampDim(cols, 48);
		const r = clampDim(rows, 24);
		const b = createPixelFlap(
			untrack(() => ({
				cols: c,
				rows: r,
				seed: SEED,
				flipMs,
				sound: soundOn ? volume : 0,
				view: pixelView,
				onregrid: (gc: number, gr: number) => (grid = { cols: gc, rows: gr })
			}))
		);
		grid = { cols: c, rows: r };
		pixelBoard = b;
		return () => {
			b.dispose();
			pixelBoard = null;
		};
	});
	$effect(() => {
		pixelBoard?.setOptions({ flipMs, sound: soundOn ? volume : 0 });
	});
	const pixelPaint: PixelPaint = (fill, t) => {
		const b = pixelBoard;
		if (!b) return;
		const split = frameOn ? boardColor : backdrop;
		const inks = { card: cardColor, ink: inkColor, split };
		paintFlaps(fill, b.frame(t), pixelLayout, card, b.palette, inks, PAD);
	};

	// One show at a time; each returns its stop(). The knobs are getters so live
	// edits (the text field) apply without restarting the show.
	const activeBoard = $derived<SplitFlapBoard | null>(render === 'pixel' ? pixelBoard : board);
	$effect(() => {
		const b = activeBoard;
		if (!b) return;
		const pixel = render === 'pixel';
		return FLAP_SHOWS[show](b, {
			text: () => freeText,
			chroma: () => chromaKind,
			stage: () => stageWrap,
			aspect: pixel ? () => untrack(() => (card[0] + GAP) / (card[1] + GAP)) : undefined
		});
	});

	// The composable @glowbox/crt layer over the whole board.
	let stageWrap = $state<HTMLDivElement>();
	$effect(() => {
		if (!crtOn || !stageWrap) return;
		const crt = createCrtScreen(stageWrap, { persistence: 0.35 });
		return () => crt?.dispose();
	});
</script>

<svelte:head>
	<title>glowbox — split-flap board</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<div class="app">
	<header>
		<CoreNav core="splitflap" />
		<label class="hdr-field example-field">
			<span class="lbl">show</span>
			<Select
				bind:value={show}
				ariaLabel="show"
				options={[
					{ value: 'departures', label: 'Departures' },
					{ value: 'clock', label: 'Clock' },
					{ value: 'text', label: 'Text' },
					{ value: 'counter', label: 'Counter' },
					{ value: 'scroller', label: 'Scroller' },
					{ value: 'poll', label: 'Poll' },
					{ value: 'chroma', label: 'Chroma' },
					{ value: 'matrix', label: 'Matrix' },
					{ value: 'snake', label: 'Snake' },
					{ value: 'pong', label: 'Pong' }
				]}
			/>
		</label>
		{#if show === 'chroma'}
			<!-- Not a <label>: it would name the group's first button. -->
			<div class="hdr-field style-field">
				drum
				<Segmented
					bind:value={chromaKind}
					ariaLabel="chroma drum"
					options={[
						{ value: 'mono', label: 'Mono' },
						{ value: 'coarse', label: 'Coarse' },
						{ value: 'rich', label: 'Rich' },
						{ value: 'ultra', label: 'Ultra' }
					]}
				/>
			</div>
		{/if}
		<div class="hdr-field">
			render
			<Segmented
				bind:value={render}
				ariaLabel="render"
				options={[
					{ value: 'canvas', label: 'Canvas' },
					{ value: 'pixel', label: 'Pixel' }
				]}
			/>
		</div>
		<span class="hint">{interactive ? 'tap the board' : 'forward-only drums'} · turn SOUND on</span>
		<ThemeToggle />
		<button
			class="panel-toggle"
			onclick={() => (panelOpen = !panelOpen)}
			aria-label="controls"
			aria-expanded={panelOpen}
			aria-controls="controls-panel"
		>
			<SlidersHorizontal size={18} />
		</button>
	</header>

	<div class="stage" style="background: {backdrop}">
		<div
			class="board-wrap"
			class:clickable={interactive}
			class:pixel={render === 'pixel'}
			bind:this={stageWrap}
		>
			{#if render === 'pixel'}
				<PixelStage
					width={pixelLayout.width + 2 * PAD}
					height={pixelLayout.height + 2 * PAD}
					paint={pixelPaint}
					background={frameOn ? boardColor : backdrop}
					label="split-flap display"
				/>
			{:else}
				<canvas bind:this={canvas} aria-label="split-flap display"></canvas>
			{/if}
		</div>
	</div>

	<button
		class="scrim"
		class:open={panelOpen}
		aria-label="close controls"
		tabindex={panelOpen ? 0 : -1}
		onclick={() => (panelOpen = false)}
	></button>

	<aside id="controls-panel" class="panel" class:open={panelOpen}>
		<div class="panel-head">
			<span>controls</span>
			<button class="sheet-close" onclick={() => (panelOpen = false)} aria-label="close controls">
				<X size={18} />
			</button>
		</div>

		{#if show === 'text'}
			<section>
				<h2>show</h2>
				<input
					class="text-input"
					type="text"
					bind:value={freeText}
					placeholder="GLOWBOX SPLIT-FLAP"
					aria-label="display text"
					maxlength="120"
				/>
			</section>
		{/if}

		<section>
			<h2>mechanics</h2>
			<div class="row">
				<ToggleChip bind:checked={soundOn} label="sound" />
				<ToggleChip bind:checked={crtOn} label="CRT" />
			</div>
			{#if soundOn}
				<Slider
					bind:value={volume}
					label="volume"
					min={0.05}
					max={1}
					step={0.05}
					format={(v) => `${Math.round(v * 100)}%`}
				/>
			{/if}
			<Slider
				bind:value={flipMs}
				label="flap fall"
				min={0}
				max={300}
				step={10}
				format={(v) => (v === 0 ? 'instant' : `${v}ms`)}
			/>
		</section>

		<section>
			<h2>resolution</h2>
			<div class="row">
				<span class="rlabel">preset</span>
				<Select
					bind:value={preset}
					options={presetOptions}
					ariaLabel="preset"
					onchange={applyPreset}
				/>
			</div>
			<div class="duo">
				<label>
					<span>cols</span>
					<input type="number" min="2" max="48" bind:value={cols} aria-label="cols" />
				</label>
				<label>
					<span>rows</span>
					<input type="number" min="2" max="24" bind:value={rows} aria-label="rows" />
				</label>
			</div>
			<div class="count"><b>{clampDim(cols, 48) * clampDim(rows, 24)}</b> modules</div>
			{#if render === 'pixel'}
				<div class="card-size">
					<Slider
						bind:value={cardStep}
						label="card"
						min={0}
						max={CARDS.length - 1}
						step={1}
						format={(v) => `${CARDS[v][0]} × ${CARDS[v][1]} px`}
						hint="in the display's own pixels; the stage scales them up whole"
					/>
				</div>
			{/if}
		</section>

		<section>
			<h2>scene</h2>
			<div class="row">
				<ToggleChip bind:checked={shaded} label="shaded details" disabled={render === 'pixel'} />
				{#if render === 'pixel'}<span class="chip-hint">canvas only</span>{/if}
			</div>
			<div class="row">
				<span class="rlabel">card</span>
				<input type="color" bind:value={cardColor} aria-label="card colour" />
			</div>
			<div class="row">
				<span class="rlabel">ink</span>
				<input type="color" bind:value={inkColor} aria-label="ink colour" />
			</div>
			<div class="row">
				<span class="rlabel">board</span>
				<input type="color" bind:value={boardColor} disabled={!frameOn} aria-label="board colour" />
			</div>
			<div class="row">
				<ToggleChip bind:checked={frameOn} label="frame" />
			</div>
			<div class="row">
				<span class="rlabel">backdrop</span>
				<input
					type="color"
					bind:value={backdrop}
					aria-label="backdrop colour"
					oninput={() => (backdropNamed = true)}
				/>
			</div>
		</section>
	</aside>
</div>

<style>
	.app {
		display: grid;
		grid-template-columns: 1fr 300px;
		grid-template-rows: auto 1fr;
		grid-template-areas:
			'header header'
			'stage panel';
		height: 100dvh;
	}

	header {
		grid-area: header;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 16px;
		padding: 8px 16px;
		background: var(--halo-bg-light);
	}
	.hdr-field {
		display: inline-flex;
		/* Never squeezed: a segmented control broken across two rows reads as a
		   mistake. The hint takes the hit instead: it wraps, and where it can't
		   fit at all (the chroma drum is up) it drops to a row of its own. */
		flex: none;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--halo-text-muted);
	}
	.hint {
		flex: 1 0 12em;
		text-align: right;
		font-size: 12px;
		color: var(--halo-text-muted);
	}
	.panel-toggle {
		display: none;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border: 1px solid var(--halo-border);
		border-radius: var(--halo-radius);
		background: var(--halo-bg-main);
		color: var(--halo-text-main);
		cursor: pointer;
	}

	.stage {
		grid-area: stage;
		position: relative;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		padding: 24px;
		transition: background var(--halo-d-fast) ease-out;
	}
	.board-wrap {
		width: min(100%, 900px);
	}
	.board-wrap.clickable {
		cursor: pointer;
	}
	.board-wrap.pixel {
		width: 100%;
		height: 100%;
	}
	.board-wrap.pixel.clickable {
		cursor: default;
	}
	.board-wrap.pixel.clickable :global(canvas) {
		cursor: pointer;
	}
	.board-wrap canvas {
		display: block;
		width: 100%;
		aspect-ratio: 2 / 1;
		border-radius: 6px;
	}

	.panel {
		grid-area: panel;
		overflow-y: auto;
		padding: 16px;
		background: var(--halo-bg-light);
		box-shadow: var(--halo-shadow);
	}
	.panel-head {
		display: none;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
		font-family: var(--halo-font-heading);
		font-size: 13px;
		color: var(--halo-text-main);
	}
	.sheet-close {
		display: inline-flex;
		border: none;
		background: none;
		color: var(--halo-text-muted);
		cursor: pointer;
	}
	section {
		padding: 14px 0;
	}
	section + section {
		border-top: 1px solid var(--halo-border);
	}
	section:first-of-type {
		padding-top: 2px;
	}
	h2 {
		margin: 0 0 12px;
		font-family: var(--halo-font-heading);
		font-weight: 500;
		font-size: 11px;
		letter-spacing: 0.04em;
		color: var(--halo-text-muted);
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 12px;
	}
	.rlabel {
		font-size: 13px;
		color: var(--halo-text-main);
	}
	.text-input {
		width: 100%;
		margin-bottom: 12px;
		padding: 6px 10px;
		border: 1px solid var(--halo-border);
		border-radius: var(--halo-radius);
		background: var(--halo-bg-main);
		color: var(--halo-text-main);
		font-size: 13px;
	}
	.text-input:focus-visible {
		outline: 2px solid var(--halo-accent);
		outline-offset: 1px;
	}

	.duo {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		border: 1px solid var(--halo-border);
		border-radius: var(--halo-radius);
		overflow: hidden;
	}
	.duo label {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 6px 8px;
	}
	.duo label + label {
		border-left: 1px solid var(--halo-border);
	}
	.duo span {
		font-size: 10px;
		color: var(--halo-text-muted);
	}
	.duo input {
		width: 100%;
		border: none;
		background: none;
		font: inherit;
		font-size: 14px;
		font-variant-numeric: tabular-nums;
		color: var(--halo-text-main);
		appearance: textfield;
		-moz-appearance: textfield;
	}
	.duo input::-webkit-outer-spin-button,
	.duo input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.duo input:focus-visible {
		outline: 2px solid var(--halo-accent);
		outline-offset: -1px;
	}
	.count {
		margin-top: 8px;
		text-align: right;
		font-family: var(--halo-font-heading);
		font-size: 13px;
		color: var(--halo-text-muted);
	}
	.count b {
		color: var(--halo-text-main);
	}
	.card-size {
		margin-top: 14px;
	}
	.chip-hint {
		font-size: 12px;
		color: var(--halo-text-muted);
	}

	.row input[type='color'] {
		width: 28px;
		height: 28px;
		padding: 0;
		border: 1px solid var(--halo-border);
		border-radius: var(--halo-radius);
		background: none;
		cursor: pointer;
	}
	.panel :global(.slider) {
		margin-bottom: 14px;
	}

	.scrim {
		display: none;
		border: none;
		padding: 0;
	}

	@media (max-width: 720px) {
		.app {
			grid-template-columns: minmax(0, 1fr);
			grid-template-areas:
				'header'
				'stage';
		}
		header {
			flex-wrap: wrap;
			gap: 6px 8px;
			padding: 8px 12px;
		}
		.hint {
			display: none;
		}
		/* Let the show field shrink so it never forces the column wider than the
		   viewport — every selector lives in the header ONLY. */
		.example-field {
			flex: 1 1 auto;
			min-width: 0;
			gap: 0;
		}
		.example-field .lbl {
			display: none;
		}
		.example-field :global(.field) {
			display: flex;
			flex: 1;
			min-width: 0;
		}
		.example-field :global(select) {
			width: 100%;
			min-width: 0;
		}
		.panel-toggle {
			display: inline-flex;
			flex: 0 0 auto;
			margin-left: auto;
		}
		.panel-head {
			display: flex;
		}
		.scrim {
			position: fixed;
			inset: 0;
			z-index: 1;
			background: color-mix(in srgb, var(--halo-bg-main) 55%, transparent);
			opacity: 0;
			pointer-events: none;
			transition: opacity var(--halo-d-fast) ease-out;
		}
		.scrim.open {
			display: block;
			opacity: 1;
			pointer-events: auto;
		}
		.panel {
			position: fixed;
			top: 0;
			right: 0;
			z-index: 2;
			width: min(320px, 90vw);
			height: 100dvh;
			transform: translateX(100%);
			transition: transform var(--halo-d-fast) ease-out;
		}
		.panel.open {
			transform: translateX(0);
		}
	}
</style>
