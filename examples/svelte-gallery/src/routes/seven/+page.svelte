<script lang="ts">
	// A seven-segment clock on @glowbox/seven-segment — HH:MM:SS with real colon
	// modules (narrow slots), one canvas each, driven framework-free.
	// The point of this page is the stuff a font can't do: flip the style to VFD,
	// watch digits cross-fade segment by segment, and drag the AGE slider to wear the
	// display out (dim segments, and past ~0.7 a dying one starts to flicker).
	import { createCrtScreen } from '@glowbox/crt';
	import {
		createSevenSegment,
		type SevenSegmentDisplay,
		type SevenSegmentStyle
	} from '@glowbox/seven-segment';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import X from '@lucide/svelte/icons/x';
	import { untrack } from 'svelte';

	import CoreNav from '$lib/components/CoreNav.svelte';
	import Segmented from '$lib/components/Segmented.svelte';
	import Slider from '$lib/components/Slider.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import ToggleChip from '$lib/components/ToggleChip.svelte';

	let style = $state<SevenSegmentStyle>('led');
	let glow = $state(0.7);
	let age = $state(0);
	let ghost = $state(true);
	// The window module: off is `bare` — segments alone on a transparent canvas.
	let windowOn = $state(true);
	let digitW = $state(76);
	let digitH = $state(130);
	let backdrop = $state('#0a0a0e');
	let panelOpen = $state(false);
	const onKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Escape' && panelOpen) panelOpen = false;
	};

	// HH:MM:SS as eight slots — the ':' separators are real colon modules (two stacked
	// dots in a narrower slot), the way actual clock faces do it.
	const pad = (n: number) => String(n).padStart(2, '0');
	const clockStr = () => {
		const t = new Date();
		return `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
	};
	let time = $state(clockStr());
	const slots = $derived(time.split(''));
	$effect(() => {
		const id = setInterval(() => (time = clockStr()), 250);
		return () => clearInterval(id);
	});

	// One display per canvas.
	let canvases = $state<(HTMLCanvasElement | undefined)[]>([]);
	let displays: (SevenSegmentDisplay | null)[] = [];
	$effect(() => {
		const els = canvases.filter(Boolean) as HTMLCanvasElement[];
		if (els.length < 8) return;
		displays = els.map((el, i) =>
			createSevenSegment(
				el,
				untrack(() => ({
					value: time[i],
					style,
					glow,
					age,
					ghost,
					bare: !windowOn
				}))
			)
		);
		return () => {
			for (const d of displays) d?.dispose();
			displays = [];
		};
	});
	$effect(() => {
		const patch = { style, glow, age, ghost, bare: !windowOn };
		for (const d of displays) d?.setOptions(patch);
	});

	// The composable @glowbox/crt layer over the WHOLE clock: element mode composites
	// all eight digit canvases at their layout spots onto one curved tube.
	let crtOn = $state(false);
	let clockEl = $state<HTMLDivElement>();
	$effect(() => {
		if (!crtOn || !clockEl) return;
		const crt = createCrtScreen(clockEl, { persistence: 0.45 });
		return () => crt?.dispose();
	});
	$effect(() => {
		for (let i = 0; i < displays.length; i++) displays[i]?.setValue(time[i]);
	});
</script>

<svelte:head>
	<title>glowbox — seven-segment clock</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<div class="app">
	<header>
		<CoreNav core="seven" />
		<label class="hdr-field style-field"
			>style
			<Segmented
				bind:value={style}
				ariaLabel="display style"
				options={[
					{ value: 'led', label: 'LED' },
					{ value: 'vfd', label: 'VFD' }
				]}
			/>
		</label>
		<span class="hint">per-segment fades · drag AGE to wear it out</span>
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
		<div class="clock" role="img" aria-label={time} bind:this={clockEl}>
			{#each slots as ch, i (i)}
				<canvas
					bind:this={canvases[i]}
					style="width: {ch === ':' ? Math.round(digitW * 0.38) : digitW}px; height: {digitH}px"
					aria-hidden="true"
				></canvas>
			{/each}
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

		<section>
			<h2>display</h2>
			<Slider bind:value={glow} label="glow" min={0} max={1} step={0.05} />
			<Slider
				bind:value={age}
				label="age"
				min={0}
				max={1}
				step={0.02}
				format={(v) =>
					v >= 0.95
						? `${Math.round(v * 100)}% · dead segment`
						: v > 0.7
							? `${Math.round(v * 100)}% · dying`
							: `${Math.round(v * 100)}%`}
			/>
			<div class="row">
				<ToggleChip bind:checked={ghost} label="segment ghosts" />
				<ToggleChip bind:checked={crtOn} label="CRT" />
			</div>
		</section>

		<section>
			<h2>size</h2>
			<Slider
				bind:value={digitW}
				label="width"
				min={36}
				max={120}
				step={2}
				format={(v) => `${v}px`}
			/>
			<Slider
				bind:value={digitH}
				label="height"
				min={60}
				max={220}
				step={2}
				format={(v) => `${v}px`}
			/>
		</section>

		<section>
			<h2>scene</h2>
			<div class="row">
				<ToggleChip bind:checked={windowOn} label="window module" />
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
	.clock {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		justify-content: center;
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
