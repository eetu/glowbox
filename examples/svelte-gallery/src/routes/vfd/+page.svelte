<script lang="ts">
	// A mini-system faceplate on @glowbox/vfd — one vacuum envelope holding a 14-segment
	// character field, word annunciators, a spectrum grid with peak caps, transport icons
	// and a tuning dial on a silkscreen scale, all sharing the panel's physics.
	// The point of this page is the stuff a div grid and a green webfont can't do: drag
	// PERSISTENCE and watch the analyser smear, work the DIMMER the way the button on the
	// front of a receiver worked, hit SELF-TEST for the power-on flash, and pull AGE up
	// until a multiplex grid gives out and bands a whole column of the face.
	import {
		createVfdPanel,
		type FilterName,
		type PhosphorName,
		type VfdGlyphs,
		type VfdPanel
	} from '@glowbox/vfd';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import X from '@lucide/svelte/icons/x';
	import Zap from '@lucide/svelte/icons/zap';
	import { untrack } from 'svelte';

	import CoreNav from '$lib/components/CoreNav.svelte';
	import Segmented from '$lib/components/Segmented.svelte';
	import Slider from '$lib/components/Slider.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import ToggleChip from '$lib/components/ToggleChip.svelte';
	import {
		ANALYSER_FRAME,
		analyserLayout,
		createAnalyserShow,
		createSceneClock,
		createStereoShow,
		STEREO_FRAME,
		STEREO_ZONES,
		stereoLayout,
		type StereoSource
	} from '$lib/examples/vfd';

	let source = $state<StereoSource>('auto');
	// The bench mode's text. Read every frame by the show, so typing lands live.
	let typed = $state('ABCDEFGH');
	// ONE clock for the chassis, read by both panels — they have to agree on the scene, since
	// the analyser strip stops being an analyser on the GIF source. Two shows each timing from
	// their own first frame would drift apart.
	const clock = createSceneClock(() => source);
	// The main field's repertoire. Changing it re-compiles the envelope (the anodes really
	// are different hardware) — the shown value survives, because state is carried by name.
	let mainGlyphs = $state<VfdGlyphs>('14seg');
	let phosphor = $state<PhosphorName>('zn-o');
	let filter = $state<FilterName>('green');
	let brightness = $state(1);
	// The core's own default, and deliberately low — no real VFD trailed the way a high
	// setting does.
	let persistence = $state(0.05);
	let age = $state(0);
	let glow = $state(0.72);
	let filament = $state(true);
	let grid = $state(true);
	let on = $state(true);
	let panelWidth = $state(680);
	let panelOpen = $state(false);
	// Which element the last tap landed on — the geometry contract, with the page (not
	// the library) owning the listener.
	let tapped = $state<string | null>(null);

	const onKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Escape' && panelOpen) panelOpen = false;
	};

	// The three DIMMER positions the button on a real receiver actually had.
	const DIM_STEPS = [1, 0.55, 0.25, 0];
	const cycleDimmer = () => {
		const i = DIM_STEPS.findIndex((v) => Math.abs(v - brightness) < 0.01);
		brightness = DIM_STEPS[(i + 1) % DIM_STEPS.length];
	};

	// The panel is created once for the canvas; the show drives it through the handle,
	// which is what an analyser at frame rate wants (a reactive prop per frame would
	// re-render the page 60 times a second to say the same thing).
	let canvas = $state<HTMLCanvasElement>();
	let panel = $state.raw<VfdPanel | null>(null);
	const layout = $derived(stereoLayout(mainGlyphs));

	$effect(() => {
		const el = canvas;
		if (!el) return;
		const p = untrack(() =>
			createVfdPanel(el, {
				frame: STEREO_FRAME,
				layout,
				phosphor,
				filter,
				zones: STEREO_ZONES,
				brightness,
				persistence,
				age,
				glow,
				filament,
				grid,
				on,
				label: 'mini-system display panel'
			})
		);
		if (!p) return;
		panel = p;
		const show = createStereoShow(p, clock, () => typed);
		return () => {
			show.stop();
			p.dispose();
			if (panel === p) panel = null;
		};
	});

	// Live appearance. `setOptions` doesn't take hardware, so a slider tick cannot re-compile.
	$effect(() => {
		panel?.setOptions({ phosphor, filter, brightness, persistence, age, glow, filament, grid, on });
	});

	// The hardware, on its own effect and its own call: swapping the main field's repertoire
	// really does re-compile the envelope. Drive state survives, because it is carried by name.
	$effect(() => {
		panel?.setLayout(layout);
	});

	// The second piece of glass in the same chassis: the analyser strip, which is spectrum + EQ
	// on every source but the GIF one, where the same field becomes a graphic display. Its own
	// envelope, because it is its own window on a real stack — but it shares every envelope
	// OPTION with the faceplate, so one dimmer press, one filter swap or one turn of the age
	// slider reaches both at once, the way a shared supply would.
	const envelope = $derived({
		phosphor,
		filter,
		brightness,
		persistence,
		age,
		glow,
		filament,
		grid,
		on
	});

	let analyserCanvas = $state<HTMLCanvasElement>();
	const analyserParts = analyserLayout();
	$effect(() => {
		const el = analyserCanvas;
		if (!el) return;
		const p = untrack(() =>
			createVfdPanel(el, {
				frame: ANALYSER_FRAME,
				layout: analyserParts,
				...envelope,
				selfTest: false,
				label: 'spectrum analyser and equaliser'
			})
		);
		if (!p) return;
		const show = createAnalyserShow(p, clock);
		analyserPanel = p;
		return () => {
			show.stop();
			p.dispose();
			if (analyserPanel === p) analyserPanel = null;
		};
	});
	let analyserPanel = $state.raw<VfdPanel | null>(null);
	$effect(() => {
		analyserPanel?.setOptions(envelope);
	});

	function onStageClick(e: MouseEvent) {
		tapped = panel?.elementAt(e.clientX, e.clientY) ?? null;
	}
</script>

<svelte:head>
	<title>glowbox — VFD stereo panel</title>
	<meta
		name="description"
		content="A vacuum-fluorescent mini-system faceplate: segment fields, word annunciators, a spectrum analyser with peak hold, phosphor persistence and a real dimmer."
	/>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<div class="app">
	<header>
		<CoreNav core="vfd" />
		<label class="hdr-field"
			>source
			<Segmented
				bind:value={source}
				ariaLabel="source"
				options={[
					{ value: 'auto', label: 'Auto' },
					{ value: 'tuner', label: 'Tuner' },
					{ value: 'cd', label: 'CD' },
					{ value: 'tape', label: 'Tape' },
					{ value: 'gif', label: 'GIF' },
					{ value: 'type', label: 'Type' }
				]}
			/>
		</label>
		<span class="hint">one envelope · drag PERSISTENCE to smear it</span>
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

	<div class="stage">
		<!-- The core attaches no listeners; the page owns the click and asks the panel
		     for geometry. Same contract as split-flap's cellAt and neon's sectionAt. -->
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div class="unit" style="width: {panelWidth}px" onclick={onStageClick}>
			<canvas
				class="face"
				bind:this={canvas}
				style="aspect-ratio: {STEREO_FRAME[0]} / {STEREO_FRAME[1]}"
			></canvas>
			<div class="hw">
				<button class="dimmer" onclick={(e) => (e.stopPropagation(), cycleDimmer())}>
					DISPLAY
					<span class="pips">
						{#each DIM_STEPS.slice(0, 3) as step, i (i)}
							<span class="pip" class:lit={brightness >= step - 0.01}></span>
						{/each}
					</span>
				</button>
				<span class="tapped">{tapped ? `tapped: ${tapped}` : 'tap the glass'}</span>
				<button
					class="power"
					class:off={!on}
					onclick={(e) => (e.stopPropagation(), (on = !on))}
					aria-pressed={on}
				>
					<Zap size={13} />
					{on ? 'ON' : 'STANDBY'}
				</button>
			</div>

			{#if source === 'type'}
				<!-- The bench. The same string lands in the segment field and on the 5×7 ticker,
				     so a repertoire can be read against the dot grid that renders it honestly. -->
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
				<div class="bench" onclick={(e) => e.stopPropagation()}>
					<!-- svelte-ignore a11y_autofocus -->
					<input
						bind:value={typed}
						autofocus
						spellcheck="false"
						autocomplete="off"
						aria-label="text to display"
						placeholder="type here"
					/>
					<div class="presets">
						{#each ['ABCDEFGH', 'IJKLMNOP', 'QRSTUVWX', 'YZ 0123', '456789.:', 'VERY WXY'] as p (p)}
							<button onclick={() => (typed = p)}>{p.trim()}</button>
						{/each}
					</div>
				</div>
			{/if}

			<!-- The analyser strip, on its own glass directly under the faceplate: spectrum and
			     EQ, or the graphic display on the GIF source — one window, whichever job. -->
			<canvas
				class="analyser"
				bind:this={analyserCanvas}
				style="aspect-ratio: {ANALYSER_FRAME[0]} / {ANALYSER_FRAME[1]}"
			></canvas>
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
			<h2>the envelope</h2>
			<!-- step 0.01 so the 5% default is reachable again once dragged off. The bands name what
			     each range looks like: 5% is where hardware sat, and the smear everyone remembers is
			     already an exaggeration of it. -->
			<Slider
				bind:value={persistence}
				label="persistence"
				min={0}
				max={1}
				step={0.01}
				format={(v) =>
					v <= 0.01
						? 'none · snaps'
						: v <= 0.12
							? `${Math.round(v * 100)}% · like hardware`
							: v > 0.45
								? `${Math.round(v * 100)}% · text ghosts`
								: `${Math.round(v * 100)}% · smear`}
			/>
			<Slider
				bind:value={brightness}
				label="dimmer"
				min={0}
				max={1}
				step={0.05}
				format={(v) => (v < 0.02 ? 'display off' : `${Math.round(v * 100)}%`)}
			/>
			<Slider bind:value={glow} label="glow" min={0} max={1} step={0.05} />
			<Slider
				bind:value={age}
				label="age"
				min={0}
				max={1}
				step={0.02}
				format={(v) =>
					v >= 0.95
						? `${Math.round(v * 100)}% · dead anode`
						: v >= 0.85
							? `${Math.round(v * 100)}% · two grids weak`
							: v > 0.7
								? `${Math.round(v * 100)}% · flickering`
								: v >= 0.6
									? `${Math.round(v * 100)}% · grid banding`
									: `${Math.round(v * 100)}%`}
			/>
			<div class="row">
				<ToggleChip bind:checked={filament} label="filament" />
				<ToggleChip bind:checked={grid} label="grid mesh" />
			</div>
			<button class="wide" onclick={() => panel?.selfTest()}>run self-test</button>
		</section>

		<section>
			<h2>the character field</h2>
			<label class="field"
				>repertoire
				<Segmented
					bind:value={mainGlyphs}
					ariaLabel="main field repertoire"
					options={[
						{ value: '7seg', label: '7' },
						{ value: '14seg', label: '14' },
						{ value: '16seg', label: '16' },
						{ value: 'matrix', label: '5×7' }
					]}
				/>
			</label>
			<p class="note">
				The same eight cells, four different sets of anodes. 7 is the numeric classic; 14 and 16 are
				the starbursts that can spell (16 splits the top and bottom bars, so letters get cleaner
				corners); 5×7 is the dot matrix, which the title strip along the bottom runs permanently.
				Numerals use the same strokes in all three segment modes, so a frequency reads identically
				whichever one a panel mixes in.
			</p>
		</section>

		<section>
			<h2>the glass</h2>
			<label class="field"
				>phosphor
				<Segmented
					bind:value={phosphor}
					ariaLabel="phosphor"
					options={[
						{ value: 'zn-o', label: 'ZnO' },
						{ value: 'blue', label: 'Blue' },
						{ value: 'amber', label: 'Amber' },
						{ value: 'white', label: 'White' }
					]}
				/>
			</label>
			<label class="field"
				>filter
				<Segmented
					bind:value={filter}
					ariaLabel="filter glass"
					options={[
						{ value: 'green', label: 'Green' },
						{ value: 'smoke', label: 'Smoke' },
						{ value: 'amber', label: 'Amber' },
						{ value: 'none', label: 'None' }
					]}
				/>
			</label>
			<p class="note">
				No filter leaves the undriven anodes visible as ghosts behind the glass — which is exactly
				what a filterless panel looks like, and why they were fitted.
			</p>
		</section>

		<section>
			<h2>size</h2>
			<Slider
				bind:value={panelWidth}
				label="width"
				min={320}
				max={960}
				step={10}
				format={(v) => `${v}px`}
			/>
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
		/* Never squeezed: five sources wrap onto a second line the moment this can shrink,
		   and a source selector broken across two rows reads as a mistake. The hint takes
		   the hit instead — it is prose, and prose is allowed to wrap. */
		flex: none;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--halo-text-muted);
	}
	.hint {
		min-width: 0;
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
		overflow: auto;
		padding: 24px;
		background: #17181b;
	}

	/* The panel is a piece of hardware, so it gets a front panel to sit in — brushed
	   dark plastic with a dimmer button and a power lamp, like the unit it came off. */
	.unit {
		max-width: 100%;
		padding: 14px;
		border: 1px solid #2c2e33;
		border-radius: 6px;
		background: linear-gradient(#2a2c31, #202226);
		box-shadow:
			0 1px 0 rgb(255 255 255 / 6%) inset,
			0 12px 30px rgb(0 0 0 / 45%);
		cursor: crosshair;
	}
	.unit > canvas {
		display: block;
		width: 100%;
	}
	.hw {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 12px;
		font-family: var(--halo-font-heading);
		font-size: 10px;
		letter-spacing: 0.08em;
		color: #8b9096;
	}
	.hw button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 9px;
		border: 1px solid #3a3d43;
		border-radius: 3px;
		background: #24262a;
		font: inherit;
		color: #b7bcc2;
		cursor: pointer;
	}
	.hw button:hover {
		border-color: #4c5057;
		color: #e2e6ea;
	}
	.pips {
		display: inline-flex;
		gap: 3px;
	}
	.pip {
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: #3d4046;
	}
	.pip.lit {
		background: #6fe3c4;
		box-shadow: 0 0 4px #6fe3c4;
	}
	.power.off {
		color: #71767c;
	}
	.analyser {
		display: block;
		width: 100%;
		margin-top: 10px;
	}

	/* The bench row — chassis furniture, so it reads as part of the unit. */
	.bench {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
		margin-top: 10px;
	}
	.bench input {
		flex: 1 1 200px;
		min-width: 0;
		padding: 7px 10px;
		font-family: var(--halo-font-mono, monospace);
		font-size: 13px;
		letter-spacing: 0.08em;
		color: #d6dbe0;
		background: #15171a;
		border: 1px solid #33363c;
		border-radius: var(--halo-radius);
	}
	.bench input:focus-visible {
		border-color: #6d757e;
		outline: none;
	}
	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.presets button {
		padding: 6px 8px;
		font-family: var(--halo-font-mono, monospace);
		font-size: 11px;
		letter-spacing: 0.06em;
		color: #9aa1a8;
		background: #15171a;
		border: 1px solid #33363c;
		border-radius: var(--halo-radius);
		cursor: pointer;
	}
	.presets button:hover {
		color: #d6dbe0;
		border-color: #6d757e;
	}
	.tapped {
		margin-left: auto;
		font-variant-numeric: tabular-nums;
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
	.field {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 12px;
		font-size: 13px;
		color: var(--halo-text-main);
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 12px;
	}
	.note {
		margin: 4px 0 0;
		font-size: 12px;
		line-height: 1.45;
		color: var(--halo-text-muted);
	}
	.wide {
		width: 100%;
		padding: 7px;
		border: 1px solid var(--halo-border);
		border-radius: var(--halo-radius);
		background: var(--halo-bg-main);
		font-family: var(--halo-font-body);
		font-size: 13px;
		color: var(--halo-text-main);
		cursor: pointer;
	}
	.wide:hover {
		border-color: var(--halo-accent);
		color: var(--halo-accent);
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
		.stage {
			padding: 12px;
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
