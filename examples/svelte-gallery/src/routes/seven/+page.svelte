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

	import BombRig from '$lib/components/BombRig.svelte';
	import CoreNav from '$lib/components/CoreNav.svelte';
	import Segmented from '$lib/components/Segmented.svelte';
	import Select from '$lib/components/Select.svelte';
	import Slider from '$lib/components/Slider.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import ToggleChip from '$lib/components/ToggleChip.svelte';
	import {
		type BombRig as BombRigHandle,
		type BombSnapshot,
		type BombWire,
		createBombRig
	} from '$lib/examples/seven';
	import { theme } from '$lib/theme.svelte';

	type Show = 'clock' | 'bomb';
	let show = $state<Show>('clock');
	let style = $state<SevenSegmentStyle>('led');
	let glow = $state(0.7);
	let age = $state(0);
	let ghost = $state(true);
	// The window module: off is `bare` — segments alone on a transparent canvas.
	let windowOn = $state(true);
	let digitW = $state(76);
	let digitH = $state(130);
	let backdrop = $state('#0a0a0e');
	// Does the hardware follow the page's theme toggle, or is it pinned? The
	// stage follows the display, because dark ink on a dark stage is invisible.
	let backdropNamed = false;
	const scheme = $derived(theme.mode);
	$effect(() => {
		if (!backdropNamed) backdrop = scheme === 'light' ? '#e9e7e1' : '#0a0a0e';
	});
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
	$effect(() => {
		if (show !== 'clock') return;
		const id = setInterval(() => (time = clockStr()), 250);
		return () => clearInterval(id);
	});

	// The rig: a countdown, a piezo and three wires. It runs itself; the page
	// mirrors its snapshot and pushes the digits, the way every show here does.
	let bombSound = $state(false);
	let bomb = $state<BombSnapshot>({ state: 'armed', remaining: 30, display: '00:30', cut: [] });
	let rig = $state.raw<BombRigHandle | null>(null);
	$effect(() => {
		if (show !== 'bomb') return;
		const r = createBombRig({
			seconds: 30,
			sound: untrack(() => bombSound),
			onChange: (snap) => (bomb = snap)
		});
		rig = r;
		bomb = r.snapshot();
		return () => {
			r.stop();
			rig = null;
		};
	});
	$effect(() => rig?.setSound(bombSound));
	const cutWire = (wire: BombWire) => rig?.cut(wire);
	const bombLabel = $derived(
		bomb.state === 'armed'
			? `countdown ${bomb.display}`
			: bomb.state === 'defused'
				? 'countdown defused'
				: 'countdown expired'
	);

	// Each show opens at its own module size — the rig runs scavenged little
	// displays, the clock a full-size face. Dragging the size sliders holds until
	// the next show change.
	$effect(() => {
		digitW = show === 'bomb' ? 58 : 76;
		digitH = show === 'bomb' ? 96 : 130;
	});

	// What the digits show: the wall clock, or the rig's own five slots.
	const shown = $derived(show === 'bomb' ? bomb.display : time);
	const slots = $derived(shown.split(''));
	// A detonated rig shows nothing at all — dead display, live buzzer.
	const values = $derived(
		show === 'bomb' && bomb.state === 'detonated' ? slots.map(() => null) : slots
	);

	// One display per canvas.
	let canvases = $state<(HTMLCanvasElement | undefined)[]>([]);
	let displays: (SevenSegmentDisplay | null)[] = [];
	$effect(() => {
		const want = slots.length;
		const els = (canvases.filter(Boolean) as HTMLCanvasElement[]).slice(0, want);
		if (els.length < want) return;
		displays = els.map((el, i) =>
			createSevenSegment(
				el,
				untrack(() => ({
					value: values[i],
					style,
					glow,
					age,
					ghost,
					bare: !windowOn,
					theme: theme.mode
				}))
			)
		);
		return () => {
			for (const d of displays) d?.dispose();
			displays = [];
		};
	});
	$effect(() => {
		const patch = { style, glow, age, ghost, bare: !windowOn, theme: theme.mode };
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
		for (let i = 0; i < displays.length; i++) displays[i]?.setValue(values[i]);
	});
</script>

<svelte:head>
	<title>glowbox — seven-segment clock</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<div class="app">
	<header>
		<CoreNav core="seven" />
		<label class="hdr-field example-field">
			<span class="lbl">show</span>
			<Select
				bind:value={show}
				ariaLabel="show"
				options={[
					{ value: 'clock', label: 'Clock' },
					{ value: 'bomb', label: 'Countdown' }
				]}
			/>
		</label>
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
		<span class="hint">
			{show === 'bomb' ? 'don’t cut the red wire' : 'per-segment fades · drag AGE to wear it out'}
		</span>
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
		{#if show === 'bomb'}
			<BombRig state={bomb.state} cut={bomb.cut} oncut={cutWire}>
				<div class="clock" role="img" aria-label={bombLabel} bind:this={clockEl}>
					{#each slots as ch, i (i)}
						<canvas
							bind:this={canvases[i]}
							style="width: {ch === ':' ? Math.round(digitW * 0.38) : digitW}px; height: {digitH}px"
							aria-hidden="true"
						></canvas>
					{/each}
				</div>
			</BombRig>
		{:else}
			<div class="clock" role="img" aria-label={time} bind:this={clockEl}>
				{#each slots as ch, i (i)}
					<canvas
						bind:this={canvases[i]}
						style="width: {ch === ':' ? Math.round(digitW * 0.38) : digitW}px; height: {digitH}px"
						aria-hidden="true"
					></canvas>
				{/each}
			</div>
		{/if}
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

		{#if show === 'bomb'}
			<section>
				<h2>rig</h2>
				<div class="row">
					<span class="rlabel">state</span>
					<span class="readout" class:blown={bomb.state === 'detonated'}>
						{bomb.state === 'armed'
							? `armed · ${bomb.display}`
							: bomb.state === 'defused'
								? 'defused'
								: 'detonated'}
					</span>
				</div>
				<div class="row">
					<ToggleChip bind:checked={bombSound} label="piezo" />
				</div>
				<div class="row">
					<button class="rearm" onclick={() => rig?.rearm()}>re-arm</button>
				</div>
			</section>
		{/if}

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
	.readout {
		margin-left: auto;
		font-variant-numeric: tabular-nums;
		font-size: 13px;
		color: var(--halo-text);
	}
	.readout.blown {
		color: #d8452f;
	}
	.rearm {
		width: 100%;
		padding: 8px 10px;
		border: 1px solid var(--halo-border);
		border-radius: var(--halo-radius);
		background: var(--halo-bg);
		color: var(--halo-text);
		font: inherit;
		font-size: 13px;
		cursor: pointer;
	}
	.rearm:hover {
		border-color: var(--halo-accent);
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
