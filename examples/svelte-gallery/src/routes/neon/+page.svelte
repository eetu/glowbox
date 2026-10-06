<script lang="ts">
	// A neon sign on @glowbox/neon — one canvas, driven framework-free. The point
	// of this page is the glass a text-shadow can't do: tubes visible unlit,
	// electrode strikes, a dying letter — and turn SOUND on for the transformer hum.
	import { createCrtScreen } from '@glowbox/crt';
	import {
		type Color,
		createNeonSign,
		GASES,
		type GasName,
		type GasSpec,
		neonLevels,
		type NeonPixelPart,
		neonPixels,
		type NeonSign,
		type NeonSignOptions,
		type NeonSwitch,
		parseColor,
		type RGB
	} from '@glowbox/neon';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import X from '@lucide/svelte/icons/x';
	import { untrack } from 'svelte';

	import CoreNav from '$lib/components/CoreNav.svelte';
	import PixelStage, { mixHex, type PixelPaint } from '$lib/components/PixelStage.svelte';
	import Segmented from '$lib/components/Segmented.svelte';
	import Select from '$lib/components/Select.svelte';
	import Slider from '$lib/components/Slider.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import ToggleChip from '$lib/components/ToggleChip.svelte';
	import { NEON_SHOWS, type NeonShow, type NeonShowTarget } from '$lib/examples/neon';
	import { theme } from '$lib/theme.svelte';

	let show = $state<NeonShow>('cocktails');
	// Canvas is the component; pixel is the same sign as data (`neonPixels`), painted the way
	// a game would into its own raster and scaled up by a whole number.
	let render = $state<'canvas' | 'pixel'>('canvas');
	// A capital's height in the display's own pixels, kept per letterform: script needs about
	// twice the rows sans does to read.
	let capHeight = $state({ sans: 12, script: 20 });

	let soundOn = $state(false);
	let volume = $state(0.5);
	let glow = $state(0.7);
	let strikeMs = $state(900);
	let speed = $state(1);
	let wallColor = $state('#0b0b0e');
	// The wall itself: off is `wall: null` — tubes on a transparent canvas. An
	// absorbing sign inks a wall, so it has to have one; the switch is emit-only.
	let wallOn = $state(true);
	let backdrop = $state('#0a0a0e');
	// Does the hardware follow the page's theme toggle, or is it pinned? This page owns
	// controls for BOTH knobs the core's `theme` owns — the polarity and the wall — and
	// a colour the consumer names stops being the theme's, so the switch moves these
	// controls instead of the option: the same result, visible in the panel.
	const scheme = $derived(theme.mode);
	// The invented element: tubes that ink a pale wall instead of lighting a dark
	// one. Flipping it drags the scene colours along — dark ink on a dark wall is
	// invisible, and that trap isn't worth making the visitor discover. It starts from
	// the display switch and stays wherever the visitor puts it.
	let polarity = $derived<'emit' | 'absorb'>(scheme === 'light' ? 'absorb' : 'emit');
	// On a phone the sign is bound by canvas width, so the 8% margin is the
	// difference between a small sign and a legible one.
	// (The gallery is ssr: false, so matchMedia is safe here.)
	const padding = matchMedia('(max-width: 720px)').matches ? 0.04 : 0.08;
	let lastPolarity = 'emit';
	$effect(() => {
		if (polarity === lastPolarity) return;
		lastPolarity = polarity;
		const pale = polarity === 'absorb';
		wallColor = pale ? '#f3f2ef' : '#0b0b0e';
		backdrop = pale ? '#e9e8e3' : '#0a0a0e';
	});
	let crtOn = $state(false);
	let panelOpen = $state(false);
	const onKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Escape' && panelOpen) panelOpen = false;
	};

	// The free-text show's tinker set — the full option surface to play with.
	let freeText = $state('Glow\nbox');
	let tinkerFont = $state<'script' | 'sans'>('script');
	let tinkerGas = $state<GasName>('neon');
	let tinkerAge = $state(0);
	let tinkerFlicker = $state(0);
	let tinkerTired = $state(false);
	let tinkerProgram = $state<'steady' | 'flash' | 'chase' | 'reveal'>('steady');
	// Circuit granularity: auto wires per word; glyph cuts to channel letters.
	let tinkerTubes = $state<'auto' | 'glyph' | 'line'>('auto');

	// The sign — created once for the canvas; appearance updates go through
	// setOptions, content through the shows.
	let canvas = $state<HTMLCanvasElement>();
	let sign = $state.raw<NeonSign | null>(null);
	$effect(() => {
		if (!canvas) return;
		const s = createNeonSign(
			canvas,
			untrack(() => ({
				glow,
				strikeMs,
				speed,
				padding,
				wall: wallOn || polarity === 'absorb' ? wallColor : null,
				polarity,
				sound: soundOn ? volume : 0
			}))
		);
		sign = s;
		return () => {
			s?.dispose();
			sign = null;
		};
	});

	// The pixel render runs the same shows on a stand-in for the sign that keeps what they
	// set: the look, the text, and when the power and each circuit last came on, which is
	// where a strike starts. A fresh one each time pixel mode opens, so the sign strikes.
	type NeonLook = Partial<NeonSignOptions>;
	// What bends the glass; the rest is read off the stand every frame.
	const SHAPE: (keyof NeonLook)[] = [
		'font',
		'art',
		'tubes',
		'align',
		'lineSpacing',
		'letterSpacing',
		'tilt',
		'lineScale'
	];
	const clock = () => performance.now() / 1000;
	const switched = (was: NeonSwitch[], next: boolean[]): NeonSwitch[] =>
		next.map((v, i) => (!v ? false : was[i] === false ? clock() : (was[i] ?? true)));
	const createStand = () => {
		let text = $state('');
		let shape = $state.raw<NeonLook>({});
		let look: NeonLook = {};
		let on: NeonSwitch = true;
		let lineOn: NeonSwitch[] = [];
		let wordOn: NeonSwitch[] = [];
		const power = (v: boolean) => {
			if (v !== (on !== false)) on = v ? clock() : false;
		};
		return {
			power,
			setText: (next: string) => {
				// Untracked: shows call this from effects, which must not come to depend on it.
				if (next === untrack(() => text)) return;
				text = next;
				if (on !== false) on = clock();
			},
			setOptions: (patch: NeonLook) => {
				if (patch.on != null) power(patch.on);
				if (patch.lineOn) lineOn = switched(lineOn, patch.lineOn);
				if (patch.wordOn) wordOn = switched(wordOn, patch.wordOn);
				look = { ...look, ...patch };
				if (SHAPE.some((k) => k in patch)) shape = look;
			},
			get text() {
				return text;
			},
			get shape() {
				return shape;
			},
			get look() {
				return look;
			},
			get on() {
				return on;
			},
			get lineOn() {
				return lineOn;
			},
			get wordOn() {
				return wordOn;
			}
		};
	};
	let stand = $state.raw<ReturnType<typeof createStand> | null>(null);
	$effect(() => {
		if (render !== 'pixel') return;
		stand = createStand();
		return () => {
			stand = null;
		};
	});
	// Whichever is up takes the shows and the panel.
	const target = $derived<NeonShowTarget | null>(stand ?? sign);

	$effect(() => {
		target?.setOptions({
			glow,
			strikeMs,
			speed,
			wall: wallOn || polarity === 'absorb' ? wallColor : null,
			polarity,
			sound: soundOn ? volume : 0
		});
	});

	// One show at a time; each returns its stop(). Shows own the look (font, gas,
	// wear, program); the panel owns the mechanics above.
	$effect(() => {
		const s = target;
		if (!s) return;
		return NEON_SHOWS[show](s, { text: () => untrack(() => freeText) });
	});

	// The motel's NO circuit (word 1: HOTEL 0, NO 1, VACANCY 2) — the visitor
	// fills and empties the motel. The VACANCY never goes out; the NO strikes in
	// and cuts out beside it while its glass stays on the wall.
	let vacancyFull = $state(true);
	$effect(() => {
		if (show === 'vacancy') target?.setOptions({ wordOn: [true, vacancyFull, true] });
	});

	// The text show's live edits: content re-glasses, the tinker options apply on top.
	$effect(() => {
		if (show === 'text') target?.setText(freeText);
	});
	$effect(() => {
		if (show !== 'text') return;
		target?.setOptions({
			font: tinkerFont,
			gas: tinkerGas,
			age: tinkerAge,
			flicker: tinkerFlicker,
			tired: tinkerTired,
			program: tinkerProgram,
			tubes: tinkerTubes
		});
	});

	// Tap a tube to rap the glass. The sign attaches nothing itself — it answers
	// `sectionAt`, the page owns the listener (the split-flap contract).
	function rap(e: PointerEvent) {
		const s = sign;
		if (!s) return;
		const tube = s.sectionAt(e.clientX, e.clientY);
		if (tube != null) s.jolt(tube);
	}

	// The composable @glowbox/crt layer over the whole sign.
	let stageWrap = $state<HTMLDivElement>();
	$effect(() => {
		if (!crtOn || !stageWrap) return;
		const crt = createCrtScreen(stageWrap, { persistence: 0.35 });
		return () => crt?.dispose();
	});

	// The pixel render: the glass laid out on whole pixels from what the show set, lit each
	// frame from the stand's switches.
	const PAD = 4;
	const pxFont = $derived(stand?.shape.font === 'sans' ? 'sans' : 'script');
	const pixelSign = $derived.by(() => {
		if (!stand) return null;
		const { shape, text } = stand;
		const cap = capHeight[pxFont];
		return neonPixels(text, {
			capHeight: cap,
			font: pxFont,
			art: shape.art,
			tubes: shape.tubes,
			align: shape.align,
			lineSpacing: shape.lineSpacing,
			lineScale: shape.lineScale,
			tilt: shape.tilt,
			// Sans capitals weld together without a pixel of tracking.
			letterSpacing: Math.max(shape.letterSpacing ?? 0, pxFont === 'sans' ? 1 / (cap - 1) : 0)
		});
	});
	const wallBg = $derived(wallOn || polarity === 'absorb' ? wallColor : backdrop);

	const WHITE: RGB = [1, 1, 1];
	const BLACK: RGB = [0, 0, 0];
	const mixRgb = (a: RGB, b: RGB, k: number): RGB => [
		a[0] + (b[0] - a[0]) * k,
		a[1] + (b[1] - a[1]) * k,
		a[2] + (b[2] - a[2]) * k
	];
	const hex = (c: RGB) =>
		`#${c
			.map((v) =>
				Math.round(Math.max(0, Math.min(1, v)) * 255)
					.toString(16)
					.padStart(2, '0')
			)
			.join('')}`;
	// The canvas sign's tube colours: a named colour keeps its gas preset's coating and is its
	// own ink (pale inks faintly); art takes its own fill or the sign's single colour, never a
	// per-line one; a word's colour beats its line's.
	const pigment = (c: RGB): RGB => {
		const p = c.map((v) => v ** 1.4) as RGB;
		const top = Math.max(...p);
		return top > 0.88 ? (p.map((v) => (v * 0.88) / top) as RGB) : p;
	};
	const named = (c: Color, base: GasSpec): GasSpec => {
		const rgb = parseColor(c);
		return { ...base, color: rgb, ink: pigment(rgb), unlit: mixRgb(rgb, [0.5, 0.5, 0.55], 0.55) };
	};
	const single = (c: NeonLook['color']): Color | null =>
		c == null ? null : !Array.isArray(c) || typeof c[0] === 'number' ? (c as Color) : null;
	const specOf = (p: NeonPixelPart, look: NeonLook): GasSpec => {
		const gas = look.gas ?? 'neon';
		const art = p.art != null ? look.art?.[p.art] : undefined;
		if (art) {
			const own = art.color ?? single(look.color);
			return own != null ? named(own, GASES[art.gas ?? gas]) : GASES[art.gas ?? gas];
		}
		const lines = single(look.color) == null ? (look.color as Color[] | null | undefined) : null;
		const own =
			(p.word != null ? look.wordColor?.[p.word] : null) ??
			single(look.color) ??
			lines?.[p.line % lines.length];
		return own != null ? named(own, GASES[gas]) : GASES[gas];
	};
	// Glass at rest is the canvas's two passes over the wall, a neutral one and the gas's tint,
	// both stronger: a 1 px tube has no width to read by. Lit, an emitting tube is its gas
	// running a little hot; an absorbing one is its ink multiplied into the wall.
	const inkOf = (spec: GasSpec, wall: RGB, pale: boolean, emit: boolean) => {
		const glass = mixRgb(wall, pale ? [0.26, 0.27, 0.3] : [0.62, 0.64, 0.69], pale ? 0.3 : 0.16);
		const tint = pale ? mixRgb(spec.unlit, BLACK, 0.35) : spec.unlit;
		const ghost = mixRgb(glass, tint, spec.coated ? 0.3 : 0.2);
		const lit = emit
			? mixRgb(spec.color, WHITE, spec.core * 0.3)
			: (spec.ink.map((v, i) => v * wall[i]) as RGB);
		return { ghost: hex(ghost), lit: hex(lit) };
	};
	const METAL = { dark: '#4a4c53', pale: '#8c8f96' };

	// The tired transformer the way a game's world would run it, through the wall switch: once
	// in each 6 s it drops out for 0.3–1.2 s, then strikes again from there.
	const hash = (k: number, n: number) =>
		Math.abs(Math.sin(k * 12.9898 + n * 78.233) * 43758.5453) % 1;
	const dropout = (k: number) => {
		const from = k * 6 + 1 + 2.5 * hash(k, 1);
		return [from, from + 0.3 + 0.9 * hash(k, 2)];
	};
	const tiredSwitch = (t: number): NeonSwitch => {
		const k = Math.floor(t / 6);
		const [from, to] = dropout(k);
		return t < from ? dropout(k - 1)[1] : t < to ? false : to;
	};
	// Two switches in series: closed when both are, struck from whichever closed last.
	const series = (a: NeonSwitch, b: NeonSwitch): NeonSwitch =>
		a === false || b === false ? false : a === true ? b : b === true ? a : Math.max(a, b);

	const pixelPaint: PixelPaint = (fill, t) => {
		const s = stand;
		const layout = pixelSign;
		if (!s || !layout) return;
		const look = s.look;
		// The stand keeps switch times on the page clock; the levels run on the stage's.
		const shift = clock() - t;
		const at = (v: NeonSwitch): NeonSwitch => (typeof v === 'number' ? v - shift : v);
		const on = at(s.on);
		const levels = neonLevels(layout, t, {
			seed: 7,
			age: look.age,
			program: look.program,
			speed: look.speed,
			strikeMs: look.strikeMs,
			on: look.tired ? series(on, tiredSwitch(t)) : on,
			lineOn: s.lineOn.map(at),
			wordOn: s.wordOn.map(at)
		});
		const wall = parseColor(wallBg);
		const pale = 0.2126 * wall[0] + 0.7152 * wall[1] + 0.0722 * wall[2] > 0.5;
		const metal = pale ? METAL.pale : METAL.dark;
		layout.parts.forEach((p, i) => {
			const emit =
				((p.art != null ? look.art?.[p.art]?.polarity : undefined) ?? polarity) === 'emit';
			const ink = inkOf(specOf(p, look), wall, pale, emit);
			const level = levels[i];
			// Past 1 is the strike's overshoot: a lit tube runs hotter, towards white.
			const colour =
				level <= 0
					? ink.ghost
					: emit && level > 1
						? mixHex(ink.lit, '#ffffff', (level - 1) * 2)
						: mixHex(ink.ghost, ink.lit, level);
			for (const r of p.rects) fill(colour, r.x + PAD, r.y + PAD, r.w, r.h, emit && level > 0);
			for (const r of p.ends) fill(metal, r.x + PAD, r.y + PAD, r.w, r.h);
		});
	};
</script>

<svelte:head>
	<title>glowbox — neon sign</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<div class="app">
	<header>
		<CoreNav core="neon" />
		<div class="hdr-field example-field">
			<span class="lbl">show</span>
			<Select
				bind:value={show}
				ariaLabel="show"
				options={[
					{ value: 'cocktails', label: 'Cocktails' },
					{ value: 'dice', label: 'Dice' },
					{ value: 'rick', label: 'Never gonna' },
					{ value: 'vacancy', label: 'No vacancy' },
					{ value: 'open', label: 'Open' },
					{ value: 'marquee', label: 'Marquee' },
					{ value: 'gastour', label: 'Gas tour' },
					{ value: 'tired', label: 'Tired sign' },
					{ value: 'text', label: 'Text' }
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
		<span class="hint">
			{render === 'pixel' ? '1 px glass · drag CAP HEIGHT' : 'tap a tube · turn SOUND on'}
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
		{#if render === 'pixel'}
			<div class="pixel-wrap" bind:this={stageWrap}>
				{#if pixelSign}
					<PixelStage
						width={pixelSign.width + 2 * PAD}
						height={pixelSign.height + 2 * PAD}
						paint={pixelPaint}
						glow={polarity === 'absorb' ? 0 : glow}
						background={wallBg}
						maxScale={16}
						label={stand?.text.replace(/\n/g, ' ')}
					/>
				{/if}
			</div>
		{:else}
			<!-- Presentational wrapper: rapping the glass is decoration, not an action;
			     the canvas keeps the sign's own role="img" + label. -->
			<div class="sign-wrap" bind:this={stageWrap} role="presentation" onpointerdown={rap}>
				<canvas bind:this={canvas} aria-label="neon sign"></canvas>
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

		{#if show === 'vacancy'}
			<section>
				<h2>show</h2>
				<div class="row">
					<ToggleChip bind:checked={vacancyFull} label="hotel full" />
				</div>
			</section>
		{/if}

		{#if show === 'text'}
			<section>
				<h2>show</h2>
				<input
					class="text-input"
					type="text"
					bind:value={freeText}
					placeholder="GLOW BOX"
					aria-label="sign text"
					maxlength="60"
				/>
				<div class="row">
					<span class="rlabel">bend</span>
					<Segmented
						bind:value={tinkerFont}
						ariaLabel="letterform"
						options={[
							{ value: 'script', label: 'Script' },
							{ value: 'sans', label: 'Block' }
						]}
					/>
				</div>
				<div class="row">
					<span class="rlabel">gas</span>
					<Select
						bind:value={tinkerGas}
						ariaLabel="gas"
						options={[
							{ value: 'neon', label: 'Neon' },
							{ value: 'argon', label: 'Argon' },
							{ value: 'helium', label: 'Helium' },
							{ value: 'co2', label: 'CO₂' },
							{ value: 'green', label: 'Green phosphor' },
							{ value: 'gold', label: 'Gold phosphor' },
							{ value: 'rose', label: 'Rose phosphor' }
						]}
					/>
				</div>
				<div class="row">
					<span class="rlabel">program</span>
					<Select
						bind:value={tinkerProgram}
						ariaLabel="program"
						options={[
							{ value: 'steady', label: 'Steady' },
							{ value: 'flash', label: 'Flash' },
							{ value: 'chase', label: 'Chase' },
							{ value: 'reveal', label: 'Reveal' }
						]}
					/>
				</div>
				<Slider bind:value={tinkerAge} label="wear" min={0} max={1} step={0.01} />
				<Slider
					bind:value={tinkerFlicker}
					label="flicker"
					min={0}
					max={1}
					step={0.01}
					disabled={render === 'pixel'}
					hint={render === 'pixel' ? 'canvas only' : undefined}
				/>
				<div class="row">
					<ToggleChip bind:checked={tinkerTired} label="tired transformer" />
				</div>
			</section>
		{/if}

		<section>
			<h2>electrics</h2>
			<div class="row">
				<ToggleChip bind:checked={soundOn} label="sound" disabled={render === 'pixel'} />
				<ToggleChip bind:checked={crtOn} label="CRT" />
			</div>
			{#if render === 'pixel'}
				<p class="note">sound: canvas only</p>
			{:else if soundOn}
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
				bind:value={glow}
				label="glow"
				min={0}
				max={1}
				step={0.05}
				disabled={render === 'pixel' && polarity === 'absorb'}
				hint={render === 'pixel' && polarity === 'absorb' ? 'ink gives no light' : undefined}
			/>
			<Slider
				bind:value={strikeMs}
				label="strike"
				min={0}
				max={2400}
				step={100}
				format={(v) => (v === 0 ? 'instant' : `${v}ms`)}
			/>
			<Slider
				bind:value={speed}
				label="cam speed"
				min={0.25}
				max={4}
				step={0.25}
				format={(v) => `${v}×`}
			/>
		</section>

		{#if render === 'pixel'}
			<section>
				<h2>size</h2>
				<Slider
					bind:value={capHeight[pxFont]}
					label={pxFont === 'sans' ? 'cap height · block' : 'cap height · script'}
					min={7}
					max={32}
					step={1}
					format={(v) => `${v} px`}
					hint="in the display's own pixels; the stage scales them up whole"
				/>
			</section>
		{/if}

		<section>
			<h2>scene</h2>
			<div class="row">
				<span class="rlabel">tubes</span>
				<Segmented
					bind:value={polarity}
					ariaLabel="polarity"
					options={[
						{ value: 'emit', label: 'Shine' },
						{ value: 'absorb', label: 'Ink' }
					]}
				/>
			</div>
			<div class="row">
				<span class="rlabel">wall</span>
				<input
					type="color"
					bind:value={wallColor}
					disabled={!wallOn && polarity === 'emit'}
					aria-label="wall colour"
				/>
			</div>
			{#if polarity === 'emit'}
				<div class="row">
					<ToggleChip bind:checked={wallOn} label="wall" />
				</div>
			{/if}
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
	.sign-wrap {
		width: min(100%, 900px);
		cursor: pointer;
	}
	.sign-wrap canvas {
		display: block;
		width: 100%;
		aspect-ratio: 2 / 1;
		border-radius: 6px;
	}
	.pixel-wrap {
		width: 100%;
		height: 100%;
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
	.note {
		margin: -4px 0 12px;
		font-size: 12px;
		color: var(--halo-text-muted);
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
		/* A phone screen is tall and narrow: a 2:1 canvas floating in the middle
		   reads as a small letterboxed strip. Let the wall fill the stage instead —
		   the sign still fits by width, but it sits on a wall, not in a band. */
		.stage {
			padding: 6px;
		}
		.sign-wrap {
			width: 100%;
			height: 100%;
		}
		.sign-wrap canvas {
			height: 100%;
			aspect-ratio: auto;
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
