<script lang="ts">
	// A neon sign on @glowbox/neon — one canvas, driven framework-free. The point
	// of this page is the glass a text-shadow can't do: tubes visible unlit,
	// electrode strikes, a dying letter — and turn SOUND on for the transformer hum.
	import { createCrtScreen } from '@glowbox/crt';
	import { createNeonSign, type GasName, type NeonSign } from '@glowbox/neon';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import X from '@lucide/svelte/icons/x';
	import { untrack } from 'svelte';

	import CoreNav from '$lib/components/CoreNav.svelte';
	import Segmented from '$lib/components/Segmented.svelte';
	import Select from '$lib/components/Select.svelte';
	import Slider from '$lib/components/Slider.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import ToggleChip from '$lib/components/ToggleChip.svelte';
	import { NEON_SHOWS, type NeonShow } from '$lib/examples/neon';

	let show = $state<NeonShow>('cocktails');

	let soundOn = $state(false);
	let volume = $state(0.5);
	let glow = $state(0.7);
	let strikeMs = $state(900);
	let speed = $state(1);
	let wallColor = $state('#0b0b0e');
	let backdrop = $state('#0a0a0e');
	// The invented element: tubes that ink a pale wall instead of lighting a dark
	// one. Flipping it drags the scene colours along — dark ink on a dark wall is
	// invisible, and that trap isn't worth making the visitor discover.
	let polarity = $state<'emit' | 'absorb'>('emit');
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
				wall: wallColor,
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
	$effect(() => {
		sign?.setOptions({
			glow,
			strikeMs,
			speed,
			wall: wallColor,
			polarity,
			sound: soundOn ? volume : 0
		});
	});

	// One show at a time; each returns its stop(). Shows own the look (font, gas,
	// wear, program); the panel owns the mechanics above.
	$effect(() => {
		const s = sign;
		if (!s) return;
		return NEON_SHOWS[show](s, { text: () => untrack(() => freeText) });
	});

	// The text show's live edits: content re-glasses, the tinker options apply on top.
	$effect(() => {
		if (show === 'text') sign?.setText(freeText);
	});
	$effect(() => {
		if (show !== 'text') return;
		sign?.setOptions({
			font: tinkerFont,
			gas: tinkerGas,
			age: tinkerAge,
			flicker: tinkerFlicker,
			tired: tinkerTired,
			program: tinkerProgram
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
</script>

<svelte:head>
	<title>glowbox — neon sign</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<div class="app">
	<header>
		<CoreNav core="neon" />
		<label class="hdr-field example-field">
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
		</label>
		<span class="hint">tap a tube · turn SOUND on</span>
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
		<!-- Presentational wrapper: rapping the glass is decoration, not an action;
		     the canvas keeps the sign's own role="img" + label. -->
		<div class="sign-wrap" bind:this={stageWrap} role="presentation" onpointerdown={rap}>
			<canvas bind:this={canvas} aria-label="neon sign"></canvas>
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
				<Slider bind:value={tinkerFlicker} label="flicker" min={0} max={1} step={0.01} />
				<div class="row">
					<ToggleChip bind:checked={tinkerTired} label="tired transformer" />
				</div>
			</section>
		{/if}

		<section>
			<h2>electrics</h2>
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
			<Slider bind:value={glow} label="glow" min={0} max={1} step={0.05} />
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
				<input type="color" bind:value={wallColor} aria-label="wall colour" />
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
			grid-template-columns: 1fr;
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
