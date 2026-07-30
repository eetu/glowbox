<script lang="ts">
	// A split-flap board on @glowbox/split-flap — one canvas, driven framework-free.
	// The point of this page is the mechanism a text cross-fade can't do: cards
	// falling from the drum about the hinge line, forward-only wrap-through
	// cascades — and turn SOUND on for the card-slap clatter.
	import { createCrtScreen } from '@glowbox/crt';
	import { createSplitFlap, type SplitFlapBoard } from '@glowbox/split-flap';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import X from '@lucide/svelte/icons/x';
	import { untrack } from 'svelte';

	import CoreNav from '$lib/components/CoreNav.svelte';
	import Segmented from '$lib/components/Segmented.svelte';
	import Select from '$lib/components/Select.svelte';
	import Slider from '$lib/components/Slider.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import ToggleChip from '$lib/components/ToggleChip.svelte';
	import { type ChromaKind, FLAP_SHOWS, type FlapShow } from '$lib/examples/splitflap';

	let show = $state<FlapShow>('departures');
	let chromaKind = $state<ChromaKind>('rich');
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
	let backdrop = $state('#0a0a0e');
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
				board: boardColor
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
			board: boardColor
		});
	});

	// One show at a time; each returns its stop(). The knobs are getters so live
	// edits (the text field) apply without restarting the show.
	$effect(() => {
		const b = board;
		if (!b) return;
		return FLAP_SHOWS[show](b, {
			text: () => freeText,
			chroma: () => chromaKind,
			stage: () => stageWrap
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
			<label class="hdr-field style-field"
				>drum
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
			</label>
		{/if}
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
		<div class="board-wrap" class:clickable={interactive} bind:this={stageWrap}>
			<canvas bind:this={canvas} aria-label="split-flap display"></canvas>
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
		</section>

		<section>
			<h2>scene</h2>
			<div class="row">
				<ToggleChip bind:checked={shaded} label="shaded details" />
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
				<input type="color" bind:value={boardColor} aria-label="board colour" />
			</div>
			<div class="row">
				<span class="rlabel">backdrop</span>
				<input type="color" bind:value={backdrop} aria-label="backdrop colour" />
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
		align-items: center;
		gap: 16px;
		padding: 8px 16px;
		background: var(--halo-bg-light);
	}
	.hdr-field {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--halo-text-muted);
	}
	.hint {
		margin-left: auto;
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
