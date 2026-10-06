<script lang="ts">
	// A nixie-tube clock on @glowbox/nixie's createNixieRow — the framework-free row
	// helper drives the whole 2D clock from one call (one tube per char, narrow ':'
	// slots, container-fitted sizing). Mirrors the LED-grid demo's shell: shared CoreNav
	// header + a right-hand control drawer (an off-canvas sheet on mobile), so the two
	// cores read as one app.
	import {
		createNixieRow,
		DEAD_AT,
		FLICKER_FROM,
		nixieLevels,
		nixiePixelText,
		type NixieRow,
		type NixieStyle
	} from '@glowbox/nixie';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import X from '@lucide/svelte/icons/x';
	import { untrack } from 'svelte';

	import CoreNav from '$lib/components/CoreNav.svelte';
	import NixieScene3D from '$lib/components/NixieScene3D.svelte';
	import PixelStage, { mixHex, type PixelPaint } from '$lib/components/PixelStage.svelte';
	import Segmented from '$lib/components/Segmented.svelte';
	import Slider from '$lib/components/Slider.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import ToggleChip from '$lib/components/ToggleChip.svelte';
	import { theme } from '$lib/theme.svelte';

	let style = $state<NixieStyle>('classic');
	let color = $state('#ff6a12'); // glow / lit-numeral colour
	let glass = $state('#08080c'); // the tube's own glass — the glow needs it dark to bloom
	let filament = $state('#85858f'); // the unlit cathode wires behind the glass
	let backdrop = $state('#0a0806'); // the stage behind the tubes (they sit on any bg)
	// Does the hardware follow the page's theme toggle, or is it pinned? The
	// stage follows the display, because dark ink on a dark stage is invisible.
	let backdropNamed = false;
	const scheme = $derived(theme.mode);
	$effect(() => {
		if (!backdropNamed) backdrop = scheme === 'light' ? '#e9e7e1' : '#0a0806';
	});
	// The glass module: off is `bare` — numerals alone on a transparent canvas.
	let glassOn = $state(true);
	// 2D = flat <NixieTube> canvases; 3D = real bent-wire cathodes in refractive glass
	// tubes (three.js), extruded from the same glyph paths via @glowbox/nixie's glyphPath.
	let mode = $state<'2d' | '3d'>('2d');
	// Canvas is the component; pixel is the same tubes as data (`nixiePixelText`), painted the
	// way a game would into its own raster and scaled up by a whole number. Pixel shows the
	// 2D row only.
	let render = $state<'canvas' | 'pixel'>('canvas');
	const threeD = $derived(render === 'canvas' && mode === '3d');
	let pixelH = $state(20);
	let glow = $state(0.7);
	let ghost = $state(true);
	let age = $state(0);
	// Tube dimensions (px) — the row turns them into a digit aspect + container height
	// and handles separator widths + shrink-to-fit itself.
	let tubeW = $state(84);
	let tubeH = $state(150);
	let panelOpen = $state(false);
	// Escape closes the mobile sheet (matches the scrim / close button).
	const onKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Escape' && panelOpen) panelOpen = false;
	};

	// The current time (HH:MM:SS) — the whole string goes to the row; the 3D scene still
	// takes it as slot chars.
	const pad = (n: number) => String(n).padStart(2, '0');
	const clockStr = () => {
		const t = new Date();
		return `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
	};
	let time = $state(clockStr());
	const digits = $derived(time.split(''));
	$effect(() => {
		const id = setInterval(() => (time = clockStr()), 250);
		return () => clearInterval(id);
	});

	// The 2D clock: one createNixieRow on a plain div. Created when the 2D stage mounts
	// (options snapshot untracked so tweaks don't recreate it); the follow-up effects
	// push option/value changes into the live row.
	let rowEl = $state<HTMLDivElement>();
	let row: NixieRow | null = null;
	$effect(() => {
		if (!rowEl) return;
		row = createNixieRow(
			rowEl,
			untrack(() => ({
				value: time,
				style,
				color,
				background: glass,
				wire: filament,
				glow,
				ghost,
				bare: !glassOn,
				theme: theme.mode,
				digitAspect: tubeW / tubeH
			}))
		);
		return () => {
			row?.dispose();
			row = null;
		};
	});
	$effect(() => {
		row?.setOptions({
			style,
			color,
			background: glass,
			wire: filament,
			glow,
			ghost,
			bare: !glassOn,
			theme: theme.mode,
			digitAspect: tubeW / tubeH
		});
	});
	$effect(() => {
		row?.setValue(time);
	});

	// The pixel render: the row on whole pixels, each tube its ten cathodes. The ghosts are
	// the filament over the glass, fainter the farther back, as the canvas strokes them; the
	// lit cathode is the glow colour, dimmed by its wear. Seed 3 wears out the seconds
	// tube's 5, then hands its dips to the colon before the seconds.
	const PAD = 2;
	const pixelRow = $derived(nixiePixelText(time, { height: pixelH }));
	const pixelFace = $derived(glassOn ? glass : backdrop);
	const ghostInk = $derived(
		Array.from({ length: 10 }, (_, depth) => mixHex(pixelFace, filament, 0.3 - (depth / 9) * 0.19))
	);
	const pixelPaint: PixelPaint = (fill, t) => {
		const levels = nixieLevels(pixelRow, { age, seed: 3, t });
		pixelRow.parts.forEach((p, i) => {
			const on = levels[i] > 0;
			if (!on && !ghost) return;
			const dim = ghostInk[p.depth];
			const colour = on ? mixHex(dim, color, levels[i]) : dim;
			for (const r of p.rects) fill(colour, r.x + PAD, r.y + PAD, r.w, r.h, on);
		});
	};
</script>

<svelte:head>
	<title>glowbox — nixie clock</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<div class="app">
	<header>
		<CoreNav core="nixie" />
		<div class="hdr-field" class:off={render === 'pixel'} inert={render === 'pixel'}>
			mode
			<Segmented
				bind:value={mode}
				ariaLabel="2D or 3D"
				options={[
					{ value: '2d', label: '2D' },
					{ value: '3d', label: '3D' }
				]}
			/>
		</div>
		<div class="hdr-field style-field" class:off={render === 'pixel'} inert={render === 'pixel'}>
			style
			<Segmented
				bind:value={style}
				ariaLabel="tube style"
				options={[
					{ value: 'classic', label: 'classic' },
					{ value: 'slim', label: 'slim' },
					{ value: 'tall', label: 'tall' }
				]}
			/>
		</div>
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
		<span class="hint"
			>{render === 'pixel'
				? 'nixiePixelText · mode, style: canvas only'
				: mode === '3d'
					? 'bent-wire cathodes in refractive glass · drag to orbit'
					: 'one createNixieRow call · one tube per char'}</span
		>
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
		{#if render === 'pixel'}
			<div class="clock pixel">
				<PixelStage
					width={pixelRow.width + 2 * PAD}
					height={pixelRow.height + 2 * PAD}
					paint={pixelPaint}
					{glow}
					background={pixelFace}
					maxScale={16}
					label={time}
				/>
			</div>
		{:else if mode === '3d'}
			<NixieScene3D {digits} {color} {glass} wire={filament} {backdrop} {style} />
		{:else}
			<div class="clock" bind:this={rowEl} style="height: {tubeH}px"></div>
		{/if}
	</div>

	<!-- scrim (mobile only) closes the sheet -->
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

		<section>
			<h2>tube</h2>
			<!-- The 3D scene builds its own tube geometry and sizes itself to the stage;
			     width/height drive the 2D canvas slots only. -->
			{#if render === 'pixel'}
				<Slider
					bind:value={pixelH}
					label="tube height"
					min={11}
					max={40}
					step={1}
					format={(v) => `${v} px`}
					hint="in the display's own pixels; the stage scales them up whole"
				/>
			{/if}
			<Slider
				bind:value={tubeW}
				label="width"
				min={40}
				max={140}
				step={2}
				disabled={render === 'pixel' || mode === '3d'}
				hint={render === 'pixel' ? 'canvas only' : mode === '3d' ? '2D mode only' : undefined}
				format={(v) => `${v}px`}
			/>
			<Slider
				bind:value={tubeH}
				label="height"
				min={80}
				max={280}
				step={2}
				disabled={render === 'pixel' || mode === '3d'}
				hint={render === 'pixel' ? 'canvas only' : mode === '3d' ? '2D mode only' : undefined}
				format={(v) => `${v}px`}
			/>
		</section>

		<section>
			<h2>display</h2>
			<Slider
				bind:value={glow}
				label="glow"
				min={0}
				max={1}
				step={0.05}
				disabled={threeD}
				hint={threeD ? '2D mode only' : undefined}
			/>
			{#if render === 'pixel'}
				<Slider
					bind:value={age}
					label="age"
					min={0}
					max={1}
					step={0.02}
					format={(v) =>
						v >= DEAD_AT
							? `${Math.round(v * 100)}% · dead cathode`
							: v > FLICKER_FROM
								? `${Math.round(v * 100)}% · dying`
								: `${Math.round(v * 100)}%`}
				/>
			{/if}
			<div class="row">
				<ToggleChip bind:checked={ghost} label="cathode ghosts" disabled={threeD} />
			</div>
		</section>

		<section>
			<h2>colour</h2>
			<div class="row">
				<span class="rlabel">glow</span>
				<input type="color" bind:value={color} aria-label="glow colour" />
			</div>
			<div class="row">
				<span class="rlabel">glass</span>
				<input
					type="color"
					bind:value={glass}
					disabled={!glassOn && !threeD}
					aria-label="tube glass colour"
				/>
			</div>
			<div class="row">
				<ToggleChip bind:checked={glassOn} label="glass module" disabled={threeD} />
			</div>
			<div class="row">
				<span class="rlabel">filament</span>
				<input type="color" bind:value={filament} aria-label="filament colour" />
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

		<section>
			<h2>example</h2>
			<a
				class="src-link"
				href="https://github.com/eetu/glowbox/blob/main/examples/svelte-gallery/src/routes/nixie/+page.svelte"
				target="_blank"
				rel="noreferrer"
			>
				view source — <code>nixie/+page.svelte</code>
			</a>
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
		   mistake. The hint takes the hit instead: it wraps, or drops to a row of
		   its own. */
		flex: none;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--halo-text-muted);
	}
	/* A header field the current render doesn't use: greyed and inert. */
	.hdr-field.off {
		opacity: 0.45;
	}
	.hint {
		flex: 1 0 12em;
		text-align: right;
		font-size: 12px;
		color: var(--halo-text-muted);
	}
	.panel-toggle {
		display: none; /* mobile only */
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
		/* colour set inline from the `backdrop` control (defaults to a warm near-black) */
		padding: 24px;
		transition: background var(--halo-d-fast) ease-out;
	}
	/* The row helper owns everything inside: slot widths, separator slots, shrink-to-fit.
	   The div just gives it a box — full stage width, slider-driven height. */
	.clock {
		width: 100%;
	}
	.clock.pixel {
		height: 100%;
	}
	/* The 3D scene fills the stage regardless of the flex centring used for the 2D row. */
	.stage :global(.scene3d) {
		position: absolute;
		inset: 0;
	}

	.panel {
		grid-area: panel;
		overflow-y: auto;
		padding: 16px;
		background: var(--halo-bg-light);
		box-shadow: var(--halo-shadow);
	}
	.panel-head {
		display: none; /* only shown as a sheet on mobile */
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
	.row input[type='color'] {
		width: 28px;
		height: 28px;
		padding: 0;
		border: 1px solid var(--halo-border);
		border-radius: var(--halo-radius);
		background: none;
		cursor: pointer;
	}
	.src-link {
		font-size: 12px;
		color: var(--halo-text-muted);
		text-decoration: none;
	}
	.src-link:hover {
		color: var(--halo-text-main);
		text-decoration: underline;
	}
	.src-link code {
		font-size: 12px;
	}
	/* Sliders sit in a column with breathing room. */
	.panel :global(.slider) {
		margin-bottom: 14px;
	}

	.scrim {
		display: none;
		border: none;
		padding: 0;
	}

	/* --- mobile: drawer becomes an off-canvas sheet --- */
	@media (max-width: 720px) {
		.app {
			grid-template-columns: minmax(0, 1fr);
			grid-template-areas:
				'header'
				'stage';
		}
		/* Tighten the header so the mode toggle + theme + panel button all fit a phone; wrap
		   as a safety net on very narrow screens rather than overflowing. */
		header {
			flex-wrap: wrap;
			gap: 6px 8px;
			padding: 8px 8px;
		}
		.hint {
			display: none;
		}
		.panel-toggle {
			display: inline-flex;
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
