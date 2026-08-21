<script lang="ts">
	// Demo gallery: pick an example program; the <LedGrid> display runs it. The
	// display is the installed library (@glowbox/svelte + @glowbox/led-grid); the
	// programs are demo drivers (src/lib/examples). A top header holds the two
	// decisions you change most (example + style); everything else lives in a
	// grouped, collapsible side panel — a working tour of the 1.0 customization API.
	import { createCrtScreen, type CrtScreen } from '@glowbox/crt';
	import type { LedDisplay, LedShape, LedStyle, Projection, RgbLayout } from '@glowbox/led-grid';
	import { LedGrid } from '@glowbox/svelte';
	import Blend from '@lucide/svelte/icons/blend';
	import Circle from '@lucide/svelte/icons/circle';
	import Grid2x2 from '@lucide/svelte/icons/grid-2x2';
	import Layers from '@lucide/svelte/icons/layers';
	import Music from '@lucide/svelte/icons/music';
	import Orbit from '@lucide/svelte/icons/orbit';
	import Palette from '@lucide/svelte/icons/palette';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Square from '@lucide/svelte/icons/square';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Tv from '@lucide/svelte/icons/tv';
	import X from '@lucide/svelte/icons/x';
	import ZoomIn from '@lucide/svelte/icons/zoom-in';
	import { untrack } from 'svelte';

	import CoreNav from '$lib/components/CoreNav.svelte';
	import Segmented from '$lib/components/Segmented.svelte';
	import Select from '$lib/components/Select.svelte';
	import Slider from '$lib/components/Slider.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import ToggleChip from '$lib/components/ToggleChip.svelte';
	import { makeAttractor } from '$lib/examples/attractor';
	import { makeGifDraw } from '$lib/examples/gif';
	import { makeXwing } from '$lib/examples/model';
	import { makeMusicViz } from '$lib/examples/music';
	import { makePacman } from '$lib/examples/pacman';
	import { makeRain } from '$lib/examples/rain';
	import { makeScroller } from '$lib/examples/scroller';
	import { makeSphere, SPHERE_SHOWS, type SphereShow } from '$lib/examples/sphere';
	import { makeTorusDraw } from '$lib/examples/torus';
	import { makeWave } from '$lib/examples/wave';
	import { makeWormhole } from '$lib/examples/wormhole';
	import { theme } from '$lib/theme.svelte';

	type Size = [number, number, number];
	// Optional per-example camera framing (e.g. the Wormhole flies POV down the tube).
	type View = {
		autoOrbit?: boolean;
		yaw?: number;
		pitch?: number;
		distance?: number;
		fov?: number;
	};
	type Example = {
		size: Size;
		// Programs adapt to the display size: the torus fills any grid; Pac-Man
		// builds a cube maze of the smallest dimension.
		make: (size: Size) => (d: LedDisplay, dt: number) => void;
		view?: View;
		// Source file under src/lib/examples — the panel links it (the examples are
		// the real tutorial).
		file: string;
	};
	// Ordered as a showcase: lead with the abstract, glow-forward pieces where the LED
	// bloom is the star, then the voxelized model + flat-content billboards, the ambient
	// motion, the POV fly-through, and finally 3D Pac-Man (a fun but special game case).
	const examples: Record<string, Example> = {
		'Spinning torus': { size: [16, 16, 16], make: () => makeTorusDraw(), file: 'torus.ts' },
		'Strange attractor': { size: [40, 48, 40], make: () => makeAttractor(), file: 'attractor.ts' },
		'X-wing (model)': { size: [56, 56, 56], make: () => makeXwing(), file: 'model.ts' },
		'Wave field': { size: [40, 20, 40], make: () => makeWave(), file: 'wave.ts' },
		'Music viz': {
			size: [32, 24, 16],
			make: () => makeMusicViz(() => musicSound),
			file: 'music.ts'
		},
		// The eye tracks your cursor — keep the ball still by default so it can.
		Sphere: {
			size: [40, 40, 40],
			make: () =>
				makeSphere(
					() => stagePointer,
					() => sphereShow
				),
			file: 'sphere.ts',
			view: { autoOrbit: false }
		},
		'GIF billboard': { size: [64, 48, 6], make: () => makeGifDraw(), file: 'gif.ts' },
		'Text scroller': { size: [64, 12, 6], make: () => makeScroller(), file: 'scroller.ts' },
		Rain: { size: [24, 40, 24], make: () => makeRain(), file: 'rain.ts' },
		// POV down the tube axis (+z), close in, wide FOV, no orbit — a fly-through.
		Wormhole: {
			size: [32, 32, 64],
			make: () => makeWormhole(),
			file: 'wormhole.ts',
			view: { autoOrbit: false, yaw: 0, pitch: 0.06, distance: 1.4, fov: 1.15 }
		},
		'3D Pac-Man': {
			size: [7, 7, 7],
			make: (s) => makePacman(Math.min(s[0], s[1], s[2])),
			file: 'pacman.ts'
		}
	};
	const exampleOptions = Object.keys(examples).map((k) => ({ value: k, label: k }));

	let name = $state('Spinning torus');

	// Resolution (nx × ny × nz), seeded from the example, then user-editable.
	const MAX_LEDS = 128 ** 3; // ~2.1M; caps the product so 1024³ (~1.07B) can't OOM the tab
	const clampDim = (v: number) => Math.max(1, Math.min(1024, Math.round(v) || 1));
	let nx = $state(16);
	let ny = $state(16);
	let nz = $state(16);
	// Reseed the fields from the example's natural size whenever it changes; also
	// adopt the example's default auto-orbit (the Wormhole flies POV, no orbit).
	$effect(() => {
		const ex = examples[name];
		untrack(() => {
			nx = ex.size[0];
			ny = ex.size[1];
			nz = ex.size[2];
			autoOrbit = ex.view?.autoOrbit ?? true;
		});
	});
	const view = $derived(examples[name].view ?? {});
	const size = $derived([clampDim(nx), clampDim(ny), clampDim(nz)] as Size);
	const ledCount = $derived(size[0] * size[1] * size[2]);
	const tooBig = $derived(ledCount > MAX_LEDS);
	// Fresh program on example/size change. A couple of examples read live demo
	// state via accessors (so those changes don't recreate/reset the program): the
	// scroller its text/font, the X-wing whether to self-spin (gated on auto-orbit).
	const draw = $derived.by(() => {
		if (name === 'Text scroller')
			return makeScroller(
				() => scrollText,
				() => scrollFont
			);
		if (name === 'X-wing (model)') return makeXwing(() => autoOrbit);
		// Comic preserves brightness, so the GIF needs ~unity gain there (vs a glow
		// boost for hologram) or its bright pixels blow to white. Pass gain as a getter
		// so a style toggle only nudges brightness live — it doesn't re-derive `draw`
		// (which would recreate the player and re-decode the GIF, flashing black).
		if (name === 'GIF billboard') return makeGifDraw(() => (style === 'comic' ? 1.1 : 2.6));
		return examples[name].make(size);
	});
	const fmtLeds = new Intl.NumberFormat('en-US');

	// Quick cube-resolution presets (the dropdown shows "custom" for non-cube sizes).
	const PRESETS = [2, 4, 8, 16, 32, 64, 128];
	const presetOptions = [
		{ value: 'custom', label: 'custom', disabled: true },
		...PRESETS.map((p) => ({ value: String(p), label: `${p}³` }))
	];
	// Writable derived: reflects the cube size (or "custom"); the Select can still
	// write it, and picking a preset sets all three dims (applyPreset), after which
	// this recomputes to the same value.
	let preset = $derived(nx === ny && ny === nz && PRESETS.includes(nx) ? String(nx) : 'custom');
	const applyPreset = () => {
		const n = Number(preset);
		if (Number.isFinite(n) && n > 0) nx = ny = nz = n;
	};

	// Live-customizable specs (bound to the controls below).
	let style = $state<LedStyle>('hologram');
	let shape = $state<LedShape>('round');
	let stagger = $state(false); // brick lattice (offset every other row half a cell)
	let vivid = $state(false); // comic: flat vivid pop-art vs cel-shade
	let rgb = $state(false); // render each LED as R/G/B sub-emitters
	let rgbLayout = $state<RgbLayout>('auto'); // sub-die packing (auto = triad/round, quad/square)
	const RGB_LAYOUTS = [
		{ value: 'auto', label: 'auto' },
		{ value: 'triad', label: 'triad' },
		{ value: 'quad', label: 'quad (RGGB)' },
		{ value: 'stripe', label: 'stripe' }
	];
	let outline = $state(0.25); // comic ink border thickness
	let autoOrbit = $state(true);
	let ledSize = $state(0.6);
	// led.glow is a falloff *exponent* (higher = tighter), so the slider is inverted:
	// higher "glow" → lower exponent → a bigger, softer glow.
	let glowAmount = $state(0.7);
	const glowExp = $derived(0.5 + (1 - glowAmount) * 5.5);
	let projection = $state<Projection>('perspective');
	let zoom = $state(true);
	let background = $state('#05050c'); // CSS string → Color, straight from <input type=color>
	// This page names both knobs the core's theme owns (the look and the ground),
	// because it has a control for each — so the switch moves the page's OWN knobs,
	// which is what the option bundles in one word. Pick either afterwards to keep it.
	$effect(() => {
		const light = theme.mode === 'light';
		style = light ? 'comic' : 'hologram';
		background = light ? '#ecebe4' : '#05050c';
	});
	// quality.alpha is fixed at context creation, so this toggle remounts the display
	// (the {#key} below). The stage shows a gradient behind it to make it visible.
	let transparent = $state(false);

	// CRT: the @glowbox/crt overlay — watch the display through a curved phosphor
	// screen. The effect canvas sits over the (hidden-but-laid-out) source; pointer +
	// wheel forward through, so drag-orbit/zoom still work. Rebinds on remount via
	// `display` (the wrap div and canvas are recreated inside the {#key}).
	let crtOn = $state(false);
	let gridWrap = $state<HTMLDivElement>();
	// The knobs (package defaults), shown as sliders while the CRT is on.
	let crtCurvature = $state(0.35);
	let crtScanlines = $state(0.45);
	let crtMask = $state(0.2);
	let crtVignette = $state(0.4);
	let crtConvergence = $state(0.35);
	let crtPersistence = $state(0.3);
	let crtFlicker = $state(0.15);
	let crtBand = $state(0.12);
	let crtNoise = $state(0.08);
	const crtKnobs = () => ({
		curvature: crtCurvature,
		scanlines: crtScanlines,
		mask: crtMask,
		vignette: crtVignette,
		convergence: crtConvergence,
		persistence: crtPersistence,
		flicker: crtFlicker,
		band: crtBand,
		noise: crtNoise
	});
	let crt = $state.raw<CrtScreen | null>(null);
	$effect(() => {
		void display; // rebind when the display (and its canvas) is recreated
		if (!crtOn || !gridWrap) return;
		// Element mode: the screen mounts itself over the wrap, hides the canvas
		// underneath, and forwards pointer/wheel — drag-orbit works through the tube.
		const screen = createCrtScreen(gridWrap, untrack(crtKnobs));
		if (!screen) return;
		crt = screen;
		return () => {
			screen.dispose();
			if (crt === screen) crt = null;
		};
	});
	// Live-tune the knobs into the running screen.
	$effect(() => {
		crt?.setOptions(crtKnobs());
	});

	// Optional render-loop cap (0 = uncapped). A power/cadence knob, not a speed-up.
	let fpsCap = $state('off');
	const FPS_OPTIONS = [
		{ value: 'off', label: 'uncapped' },
		{ value: '60', label: '60' },
		{ value: '30', label: '30' },
		{ value: '15', label: '15' }
	];
	const fpsCapNum = $derived(fpsCap === 'off' ? 0 : Number(fpsCap));

	// Text-scroller-specific controls (shown only for that example).
	let scrollText = $state('GLOWBOX · ');
	let scrollFont = $state('bitmap');

	// Music-viz-specific: real synth audio (needs the click — WebAudio autoplay policy);
	// off = the simulated groove. Reset when leaving the example so sound never lingers.
	let musicSound = $state(false);
	$effect(() => {
		if (name !== 'Music viz') musicSound = false;
	});

	// Sphere-specific: pin one show or rotate through them all ('auto'); and the eye
	// follows the cursor over the stage (-1..1 from centre; null until the first move
	// so the unattended eye wanders instead of staring).
	let sphereShow = $state<SphereShow>('auto');
	const SPHERE_SHOW_OPTIONS = [
		{ value: 'auto', label: 'auto (rotate)' },
		...SPHERE_SHOWS.map((s) => ({ value: s, label: s }))
	];
	let stagePointer: [number, number] | null = null;
	const onStageMove = (e: PointerEvent) => {
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		stagePointer = [
			((e.clientX - r.left) / r.width) * 2 - 1,
			((e.clientY - r.top) / r.height) * 2 - 1
		];
	};
	const FONTS = [
		{ value: 'bitmap', label: '5×7 bitmap (built-in)' },
		{ value: "'Space Grotesk', sans-serif", label: 'Space Grotesk' },
		{ value: "'Inter', sans-serif", label: 'Inter' },
		{ value: "ui-monospace, 'Courier New', monospace", label: 'Mono' },
		{ value: "Georgia, 'Times New Roman', serif", label: 'Serif' },
		{ value: "Impact, 'Arial Black', sans-serif", label: 'Display' }
	];

	// Panel: a static right column on desktop; an off-canvas sheet on mobile.
	let panelOpen = $state(false);
	// Escape closes the mobile sheet (matches the scrim / close button).
	const onKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Escape' && panelOpen) panelOpen = false;
	};

	// Perf HUD — sample the display's rolling stats a few times a second.
	let display = $state.raw<LedDisplay | null>(null);
	let fps = $state(0);
	let drawMs = $state(0);
	let renderMs = $state(0);
	$effect(() => {
		const id = setInterval(() => {
			const s = display?.stats;
			if (s) {
				fps = s.fps;
				drawMs = s.drawMs;
				renderMs = s.renderMs;
			}
		}, 250);
		return () => clearInterval(id);
	});
</script>

<svelte:head>
	<title>glowbox — LED-grid playground</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<div class="app">
	<header>
		<CoreNav core="led" />
		<label class="hdr-field example-field">
			<span class="lbl">example</span>
			<Select bind:value={name} options={exampleOptions} ariaLabel="example" />
		</label>
		<label class="hdr-field style-field"
			>style
			<Segmented
				bind:value={style}
				ariaLabel="style"
				options={[
					{ value: 'hologram', label: 'hologram' },
					{ value: 'comic', label: 'comic' }
				]}
			/>
		</label>
		<span class="hint">drag to orbit{zoom ? ' · scroll to zoom' : ''}</span>
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

	<div class="stage" class:transparent onpointermove={onStageMove} role="presentation">
		{#if tooBig}
			<div class="toobig">
				<TriangleAlert size={20} />
				{fmtLeds.format(ledCount)} LEDs is over the {fmtLeds.format(MAX_LEDS)} demo cap — lower the resolution.
			</div>
		{:else}
			<!-- Keyed on the example so switching programs remounts a fresh canvas; the
			     control props update live via setOptions, and size resizes in place.
			     (Also keyed on `transparent`: quality.alpha is fixed at creation.) -->
			{#key name + (transparent ? ' (transparent)' : '')}
				<!-- The CRT overlay needs a positioned box around the display canvas; the
				     wrapper is inside the key so remounts rebind the effect to the fresh canvas. -->
				<div class="crt-wrap" bind:this={gridWrap}>
					<LedGrid
						{size}
						{draw}
						led={{
							style,
							shape,
							stagger,
							rgb,
							rgbLayout,
							vivid,
							outline,
							glow: glowExp,
							size: ledSize
						}}
						camera={{
							autoOrbit,
							projection,
							yaw: view.yaw,
							pitch: view.pitch,
							distance: view.distance,
							fov: view.fov
						}}
						interaction={{ zoom, zoomLimits: [0.35, 12] }}
						color={{ background }}
						theme={theme.mode}
						quality={{ fps: fpsCapNum, alpha: transparent }}
						oncreate={(d) => (display = d)}
					/>
				</div>
			{/key}
			<div class="stats" aria-hidden="true">
				<span><b>{Math.round(fps)}</b> fps</span>
				<span>draw <b>{drawMs.toFixed(1)}</b></span>
				<span>render <b>{renderMs.toFixed(1)}</b> ms</span>
			</div>
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

		{#if name === 'Text scroller'}
			<section>
				<h2>text</h2>
				<input
					class="text-input"
					type="text"
					bind:value={scrollText}
					aria-label="scroller text"
					placeholder="type a message…"
				/>
				<div class="row">
					<span class="rlabel">font</span>
					<Select bind:value={scrollFont} options={FONTS} ariaLabel="font" />
				</div>
			</section>
		{/if}

		{#if name === 'Sphere'}
			<section>
				<h2>show</h2>
				<div class="row">
					<span class="rlabel">shape</span>
					<Select bind:value={sphereShow} options={SPHERE_SHOW_OPTIONS} ariaLabel="sphere show" />
				</div>
			</section>
		{/if}

		{#if name === 'Music viz'}
			<section>
				<h2>sound</h2>
				<div class="row">
					<span class="rlabel">synth audio</span>
					<ToggleChip bind:checked={musicSound} label="play" icon={Music} />
				</div>
			</section>
		{/if}

		<section>
			<h2>look</h2>
			<div class="row">
				<span class="rlabel">shape</span>
				<Segmented
					bind:value={shape}
					ariaLabel="shape"
					options={[
						{ value: 'round', icon: Circle },
						{ value: 'square', icon: Square }
					]}
				/>
			</div>
			<div class="chips">
				<ToggleChip bind:checked={stagger} label="stagger" icon={Grid2x2} />
				<ToggleChip bind:checked={rgb} label="rgb" icon={Blend} />
				<ToggleChip bind:checked={transparent} label="transparent" icon={Layers} />
				<ToggleChip bind:checked={crtOn} label="CRT" icon={Tv} />
				{#if style === 'comic'}
					<ToggleChip bind:checked={vivid} label="vivid" icon={Sparkles} />
				{/if}
			</div>
			{#if rgb}
				<div class="row">
					<span class="rlabel">rgb layout</span>
					<Select bind:value={rgbLayout} options={RGB_LAYOUTS} ariaLabel="rgb layout" />
				</div>
			{/if}
			<Slider label="LED size" bind:value={ledSize} min={0.2} max={1.5} step={0.05} />
			<Slider
				label="glow"
				bind:value={glowAmount}
				min={0}
				max={1}
				step={0.05}
				disabled={style !== 'hologram'}
				hint={style !== 'hologram' ? 'only in hologram' : undefined}
			/>
			<Slider
				label="outline"
				bind:value={outline}
				min={0}
				max={0.6}
				step={0.05}
				disabled={style !== 'comic'}
				hint={style !== 'comic' ? 'only in comic' : undefined}
			/>
		</section>

		{#if crtOn}
			<section>
				<h2>crt</h2>
				<Slider bind:value={crtCurvature} label="curvature" min={0} max={1} step={0.05} />
				<Slider bind:value={crtScanlines} label="scanlines" min={0} max={1} step={0.05} />
				<Slider bind:value={crtMask} label="phosphor mask" min={0} max={1} step={0.05} />
				<Slider bind:value={crtPersistence} label="persistence" min={0} max={1} step={0.05} />
				<Slider bind:value={crtConvergence} label="convergence" min={0} max={1} step={0.05} />
				<Slider bind:value={crtVignette} label="vignette" min={0} max={1} step={0.05} />
				<Slider bind:value={crtFlicker} label="flicker" min={0} max={1} step={0.05} />
				<Slider bind:value={crtBand} label="refresh band" min={0} max={1} step={0.05} />
				<Slider bind:value={crtNoise} label="noise" min={0} max={1} step={0.05} />
			</section>
		{/if}

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
			<div class="trio">
				<label>
					<span>nx</span>
					<input type="number" min="1" max="1024" bind:value={nx} aria-label="nx" />
				</label>
				<label>
					<span>ny</span>
					<input type="number" min="1" max="1024" bind:value={ny} aria-label="ny" />
				</label>
				<label>
					<span>nz</span>
					<input type="number" min="1" max="1024" bind:value={nz} aria-label="nz" />
				</label>
			</div>
			<div class="count" class:over={tooBig}>
				{#if tooBig}<TriangleAlert size={15} />{/if}
				<b>{fmtLeds.format(ledCount)}</b> leds
			</div>
		</section>

		<section>
			<h2>camera</h2>
			<div class="row">
				<span class="rlabel">projection</span>
				<Select
					bind:value={projection}
					ariaLabel="projection"
					options={[
						{ value: 'perspective', label: 'perspective' },
						{ value: 'orthographic', label: 'orthographic' }
					]}
				/>
			</div>
			<div class="chips">
				<ToggleChip bind:checked={autoOrbit} label="auto-orbit" icon={Orbit} />
				<ToggleChip bind:checked={zoom} label="zoom" icon={ZoomIn} />
			</div>
			<div class="row">
				<span class="rlabel">fps cap</span>
				<Select bind:value={fpsCap} options={FPS_OPTIONS} ariaLabel="fps cap" />
			</div>
		</section>

		<section>
			<h2>scene</h2>
			<div class="row">
				<span class="rlabel">background</span>
				<span class="swatch">
					<Palette size={16} />
					<input type="color" bind:value={background} aria-label="background" />
					<code>{background}</code>
				</span>
			</div>
		</section>

		<!-- The example files are the real tutorial — link the one on screen. -->
		<section>
			<h2>example</h2>
			<a
				class="src-link"
				href="https://github.com/eetu/glowbox/blob/main/examples/svelte-gallery/src/lib/examples/{examples[
					name
				].file}"
				target="_blank"
				rel="noreferrer"
			>
				view source — <code>{examples[name].file}</code>
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
		background: var(--halo-bg-main);
	}
	/* The CRT overlay positions against this box; it fills the stage like the canvas. */
	.crt-wrap {
		position: relative;
		width: 100%;
		height: 100%;
	}

	/* With quality.alpha on, the canvas is see-through — put something behind it so
	   the transparency is visible (the "widget floating over your page" promise). */
	.stage.transparent {
		background:
			radial-gradient(ellipse at 30% 20%, #2b1a4d 0%, transparent 55%),
			radial-gradient(ellipse at 75% 75%, #143a3a 0%, transparent 60%),
			repeating-linear-gradient(45deg, #101018 0 24px, #16161f 24px 48px);
	}
	.toobig {
		display: grid;
		place-items: center;
		gap: 10px;
		height: 100%;
		padding: 24px;
		text-align: center;
		color: var(--halo-text-muted);
	}
	.stats {
		position: absolute;
		top: 12px;
		left: 12px;
		display: flex;
		gap: 10px;
		padding: 6px 10px;
		border-radius: var(--halo-radius);
		background: color-mix(in srgb, var(--halo-bg-light) 85%, transparent);
		box-shadow: var(--halo-shadow);
		font-size: 11px;
		font-variant-numeric: tabular-nums;
		color: var(--halo-text-muted);
		pointer-events: none;
	}
	.stats b {
		color: var(--halo-text-main);
		font-weight: 600;
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
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 12px;
	}
	/* Sliders sit in a column with breathing room. */
	.panel :global(.slider) {
		margin-bottom: 14px;
	}

	.trio {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		border: 1px solid var(--halo-border);
		border-radius: var(--halo-radius);
		overflow: hidden;
	}
	.trio label {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 6px 8px;
	}
	.trio label + label {
		border-left: 1px solid var(--halo-border);
	}
	.trio span {
		font-size: 10px;
		color: var(--halo-text-muted);
	}
	.trio input {
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
	.trio input::-webkit-outer-spin-button,
	.trio input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.trio input:focus-visible {
		outline: 2px solid var(--halo-accent);
		outline-offset: -1px;
	}
	.count {
		margin-top: 8px;
		text-align: right;
		font-family: var(--halo-font-heading);
		font-size: 15px;
		color: var(--halo-text-muted);
	}
	.count b {
		color: var(--halo-accent);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.count.over {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 6px;
		color: var(--halo-text-main);
	}
	.count.over b {
		color: var(--halo-text-main);
	}

	.swatch {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		color: var(--halo-text-muted);
	}
	.swatch input[type='color'] {
		width: 28px;
		height: 28px;
		padding: 0;
		border: 1px solid var(--halo-border);
		border-radius: var(--halo-radius);
		background: none;
		cursor: pointer;
	}
	.swatch code {
		font-size: 12px;
		color: var(--halo-text-muted);
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

	.text-input {
		width: 100%;
		margin-bottom: 12px;
		height: 32px;
		padding: 0 10px;
		border: 1px solid var(--halo-border);
		border-radius: var(--halo-radius);
		background: var(--halo-bg-main);
		font: inherit;
		font-size: 13px;
		color: var(--halo-text-main);
		transition: border-color var(--halo-d-fast) ease-out;
	}
	.text-input:hover {
		border-color: var(--halo-text-muted);
	}
	.text-input:focus-visible {
		outline: 2px solid var(--halo-accent);
		outline-offset: 1px;
	}

	.scrim {
		display: none;
		border: none;
		padding: 0;
	}

	/* --- mobile: panel becomes an off-canvas sheet --- */
	@media (max-width: 720px) {
		.app {
			grid-template-columns: minmax(0, 1fr);
			grid-template-areas:
				'header'
				'stage';
		}
		.hint {
			display: none;
		}
		/* Tighten the header, let it wrap (style takes the second row — every
		   selector lives in the header ONLY, no panel duplicates), and let the
		   example field shrink so it never forces the grid column (and canvas)
		   wider than the viewport. */
		header {
			flex-wrap: wrap;
			gap: 6px 8px;
			padding: 8px 12px;
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
