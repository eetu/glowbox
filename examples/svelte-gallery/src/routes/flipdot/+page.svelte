<script lang="ts">
	// A flip-dot board on @glowbox/flip-dot — one canvas, driven framework-free.
	// The point of this page is the electromechanics a static dot grid can't do:
	// watch a frame change sweep down the board row by row, discs foreshortening
	// through edge-on mid-flip — and turn SOUND on for the solenoid rattle.
	import { createCrtScreen } from '@glowbox/crt';
	import {
		createFlipDots,
		type DitherMode,
		type FlipDotBoard,
		type FlipDotShape,
		type FlipDotStagger
	} from '@glowbox/flip-dot';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import X from '@lucide/svelte/icons/x';
	import { untrack } from 'svelte';

	import CoreNav from '$lib/components/CoreNav.svelte';
	import Segmented from '$lib/components/Segmented.svelte';
	import Select from '$lib/components/Select.svelte';
	import Slider from '$lib/components/Slider.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import ToggleChip from '$lib/components/ToggleChip.svelte';
	import { FLIP_SHOWS, type FlipShow } from '$lib/examples/flipdot';
	import { theme } from '$lib/theme.svelte';

	let show = $state<FlipShow>('clock');
	let soundOn = $state(false);
	let volume = $state(0.5);
	let shape = $state<FlipDotShape>('disc');
	let shaded = $state(false);
	let flipMs = $state(70);
	let axis = $state(135);
	let stagger = $state<FlipDotStagger>('scan');
	let scanMs = $state(150);
	let dither = $state<DitherMode>('threshold');
	let marqueeText = $state('GLOWBOX FLIP-DOT');

	// Panel resolution (cols × rows), preset-seeded and user-editable — the same
	// contract as the LED and split-flap pages. Presets tile the classic 28×14
	// panel; square dots want cols ≈ 2 × rows at the stage's 2:1.
	const clampDim = (v: number, max: number) => Math.max(2, Math.min(max, Math.round(v) || 2));
	let cols = $state(56);
	let rows = $state(28);
	const PRESETS: [number, number][] = [
		[14, 7],
		[28, 14],
		[56, 28],
		[84, 42],
		[112, 56]
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
	let onColor = $state('#d5e138');
	let offColor = $state('#17181a');
	let boardColor = $state('#101114');
	// The panel behind the discs: off is `board: null` — bare discs on the page.
	let panelOn = $state(true);
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
		onColor = light ? '#1b1c20' : '#d5e138';
		offColor = light ? '#ded9cd' : '#17181a';
		boardColor = light ? '#eeebe3' : '#101114';
	});
	$effect(() => {
		if (!backdropNamed) backdrop = scheme === 'light' ? '#e9e7e1' : '#0a0a0e';
	});
	let crtOn = $state(false);
	let panelOpen = $state(false);
	const onKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Escape' && panelOpen) panelOpen = false;
	};

	// The board: 56×28 = a 2×2 tile of the classic 28×14 panels.
	let canvas = $state<HTMLCanvasElement>();
	let board = $state.raw<FlipDotBoard | null>(null);
	$effect(() => {
		if (!canvas) return;
		const c = clampDim(cols, 128);
		const r = clampDim(rows, 64);
		const b = createFlipDots(
			canvas,
			untrack(() => ({
				cols: c,
				rows: r,
				shape,
				shaded,
				flipMs,
				axis,
				stagger,
				scanMs,
				sound: soundOn ? volume : 0,
				onColor,
				offColor,
				board: panelOn ? boardColor : null,
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
			shape,
			shaded,
			flipMs,
			axis,
			stagger,
			scanMs,
			// The GIF show plays the tune with the click voice itself — the board's
			// own rattle sits out so the melody isn't buried.
			sound: soundOn && show !== 'gif' ? volume : 0,
			onColor,
			offColor,
			board: panelOn ? boardColor : null,
			theme: theme.mode
		});
	});

	// One show at a time; each returns its stop(). The knobs are getters so live
	// edits (dither mode, marquee text) apply without restarting the show.
	$effect(() => {
		const b = board;
		if (!b) return;
		return FLIP_SHOWS[show](b, {
			dither: () => dither,
			text: () => marqueeText,
			sound: () => (soundOn ? volume : 0),
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
	<title>glowbox — flip-dot board</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<div class="app">
	<header>
		<CoreNav core="flipdot" />
		<label class="hdr-field example-field">
			<span class="lbl">show</span>
			<Select
				bind:value={show}
				ariaLabel="show"
				options={[
					{ value: 'clock', label: 'Clock' },
					{ value: 'gif', label: 'GIF' },
					{ value: 'plasma', label: 'Plasma' },
					{ value: 'marquee', label: 'Text' },
					{ value: 'counter', label: 'Counter' }
				]}
			/>
		</label>
		<label class="hdr-field style-field"
			>dots
			<Segmented
				bind:value={shape}
				ariaLabel="dot shape"
				options={[
					{ value: 'disc', label: 'disc' },
					{ value: 'square', label: 'square' }
				]}
			/>
		</label>
		<span class="hint">watch the scan wave · turn SOUND on</span>
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
		<div class="board-wrap" class:clickable={show === 'counter'} bind:this={stageWrap}>
			<canvas bind:this={canvas} aria-label="flip-dot display"></canvas>
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

		{#if show === 'marquee' || show === 'gif' || show === 'plasma'}
			<section>
				<h2>show</h2>
				{#if show === 'marquee'}
					<input
						class="text-input"
						type="text"
						bind:value={marqueeText}
						placeholder="GLOWBOX FLIP-DOT"
						aria-label="marquee text"
						maxlength="80"
					/>
				{/if}
				{#if show === 'gif' || show === 'plasma'}
					<div class="row">
						<span class="rlabel">dither</span>
						<Segmented
							bind:value={dither}
							ariaLabel="dither mode"
							options={[
								{ value: 'bayer', label: 'Bayer' },
								{ value: 'floyd', label: 'Floyd' },
								{ value: 'threshold', label: 'Cut' }
							]}
						/>
					</div>
				{/if}
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
				label="flip time"
				min={0}
				max={240}
				step={10}
				format={(v) => (v === 0 ? 'instant' : `${v}ms`)}
			/>
			<Slider
				bind:value={axis}
				label="pivot axis"
				min={0}
				max={180}
				step={5}
				format={(v) => `${v}°`}
			/>
			<div class="row">
				<span class="rlabel">stagger</span>
				<Segmented
					bind:value={stagger}
					ariaLabel="stagger"
					options={[
						{ value: 'scan', label: 'Scan' },
						{ value: 'random', label: 'Random' },
						{ value: 'none', label: 'Off' }
					]}
				/>
			</div>
			<Slider
				bind:value={scanMs}
				label="sweep"
				min={0}
				max={800}
				step={25}
				format={(v) => `${v}ms`}
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
					<input type="number" min="2" max="128" bind:value={cols} aria-label="cols" />
				</label>
				<label>
					<span>rows</span>
					<input type="number" min="2" max="64" bind:value={rows} aria-label="rows" />
				</label>
			</div>
			<div class="count"><b>{clampDim(cols, 128) * clampDim(rows, 64)}</b> dots</div>
		</section>

		<section>
			<h2>scene</h2>
			<div class="row">
				<ToggleChip bind:checked={shaded} label="shaded details" />
			</div>
			<div class="row">
				<span class="rlabel">dot colour</span>
				<input type="color" bind:value={onColor} aria-label="dot colour" />
			</div>
			<div class="row">
				<span class="rlabel">dot backside</span>
				<input type="color" bind:value={offColor} aria-label="dot backside colour" />
			</div>
			<div class="row">
				<span class="rlabel">board</span>
				<input type="color" bind:value={boardColor} disabled={!panelOn} aria-label="board colour" />
			</div>
			<div class="row">
				<ToggleChip bind:checked={panelOn} label="panel" />
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
		width: min(100%, 840px);
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
		   viewport (same treatment as the LED page's example field); dots wrap to
		   the second row — every selector lives in the header ONLY. */
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
