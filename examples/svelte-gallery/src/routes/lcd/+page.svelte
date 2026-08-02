<script lang="ts">
	// A 16×2 character LCD on @glowbox/lcd — the family's first reflective display,
	// shown on a LIGHT stage on purpose. The attract loop cycles the physics a webfont
	// can't fake: typing under a blinking block cursor, a CGRAM bar meter (the custom-
	// glyph party trick), a scrolling line dragging its crystal ghost, and a power
	// cycle through the uninitialised row of boot boxes. Tap the glass to park the
	// cursor on a cell (cellAt — the module answers geometry; the page owns the tap).
	import { createLcdModule, type LcdModule, type PanelName } from '@glowbox/lcd';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import X from '@lucide/svelte/icons/x';
	import { untrack } from 'svelte';

	import CoreNav from '$lib/components/CoreNav.svelte';
	import Segmented from '$lib/components/Segmented.svelte';
	import Slider from '$lib/components/Slider.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import ToggleChip from '$lib/components/ToggleChip.svelte';

	let panel = $state<PanelName>('green');
	let backlight = $state(1);
	let contrast = $state(0.8);
	let response = $state(0.4);
	let ghost = $state(true);
	let age = $state(0);
	let moduleW = $state(480);
	let moduleH = $state(150);
	// Reflective glass belongs on a light wall — the opposite default to every
	// emissive sibling's near-black stage.
	let backdrop = $state('#e9e7e1');
	let panelOpen = $state(false);
	const onKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Escape' && panelOpen) panelOpen = false;
	};

	let canvas = $state<HTMLCanvasElement>();
	let lcd: LcdModule | null = null;

	// --- the attract loop: one scene clock, four scenes -------------------------
	const TYPED = ['GLOWBOX LCD 16X2', 'READY>'];
	const SCROLL = 'THE CRYSTALS ARE SLOW AND THAT IS THE POINT - WATCH THE TRAIL...   ';
	let timer: ReturnType<typeof setInterval> | undefined;
	function startProgram(m: LcdModule) {
		// CGRAM: eight bar glyphs, slot n = n+1 rows of ink from the floor.
		for (let slot = 0; slot < 8; slot++) {
			const rows = Array.from({ length: 8 }, (_, r) => (r >= 7 - slot ? 0b11111 : 0));
			m.setGlyph(slot, rows);
		}
		let tick = 0;
		let scene = 0; // 0 type · 1 meter · 2 scroll · 3 power cycle
		let sceneT = 0;
		clearInterval(timer);
		timer = setInterval(() => {
			tick++;
			sceneT++;
			if (scene === 0) {
				// Typing: the block cursor leads, the crystals chase.
				const n = Math.min(sceneT, TYPED[0].length + TYPED[1].length);
				const l0 = TYPED[0].slice(0, n);
				const l1 = n > TYPED[0].length ? TYPED[1].slice(0, n - TYPED[0].length) : '';
				m.setText([l0, l1]);
				const done = n >= TYPED[0].length + TYPED[1].length;
				m.setOptions({ cursor: 'block' });
				m.setCursor(done ? l1.length : Math.min(15, (l1 ? l1 : l0).length), l1 || done ? 1 : 0);
				if (sceneT > 55) {
					scene = 1;
					sceneT = 0;
					m.setOptions({ cursor: 'none' });
				}
			} else if (scene === 1) {
				// The CGRAM meter: sixteen bar columns breathing on a sine field.
				let bars = '';
				for (let x = 0; x < 16; x++) {
					const level = 0.5 + 0.5 * Math.sin(tick * 0.35 + x * 0.55) * Math.sin(tick * 0.11 + x);
					bars += String.fromCharCode(Math.max(0, Math.min(7, Math.round(level * 7))));
				}
				m.setText(['INPUT LEVEL', bars]);
				if (sceneT > 70) {
					scene = 2;
					sceneT = 0;
				}
			} else if (scene === 2) {
				// The scroll: motion is where the response smear lives.
				const win = (SCROLL + SCROLL).slice(sceneT % SCROLL.length, (sceneT % SCROLL.length) + 16);
				m.setText([win, 'CRYSTAL SPEED >>']);
				if (sceneT > 70) {
					scene = 3;
					sceneT = 0;
					m.power(false);
				}
			} else if (sceneT === 18) {
				m.power(true); // the boot row plays on its own
			} else if (sceneT > 40) {
				scene = 0;
				sceneT = 0;
			}
		}, 100);
	}

	$effect(() => {
		const el = canvas;
		if (!el) return;
		const m = untrack(() =>
			createLcdModule(el, { panel, backlight, contrast, response, ghost, age })
		);
		if (!m) return;
		lcd = m;
		untrack(() => startProgram(m));
		return () => {
			clearInterval(timer);
			m.dispose();
			lcd = null;
		};
	});

	// Live-update the envelope; the program owns text/cursor/power.
	$effect(() => {
		lcd?.setOptions({ panel, backlight, contrast, response, ghost, age });
	});
	$effect(() => {
		void moduleW;
		void moduleH;
		lcd?.resize();
	});

	// Tap the glass: park the cursor on the cell under the finger.
	function onTap(e: MouseEvent) {
		const cell = lcd?.cellAt(e.clientX, e.clientY);
		if (!cell) return;
		lcd?.setOptions({ cursor: 'block' });
		lcd?.setCursor(cell.x, cell.y);
	}
</script>

<svelte:head>
	<title>glowbox — character LCD</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<div class="app">
	<header>
		<CoreNav core="lcd" />
		<label class="hdr-field"
			>glass
			<Segmented
				bind:value={panel}
				ariaLabel="panel glass"
				options={[
					{ value: 'green', label: 'STN green' },
					{ value: 'blue', label: 'STN blue' },
					{ value: 'white', label: 'FSTN' }
				]}
			/>
		</label>
		<span class="hint">slow crystals · twist CONTRAST past 0.85 · tap to park the cursor</span>
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
		<canvas bind:this={canvas} style="width: {moduleW}px; height: {moduleH}px" onclick={onTap}
		></canvas>
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
			<h2>glass</h2>
			<Slider
				bind:value={contrast}
				label="contrast"
				min={0}
				max={1}
				step={0.01}
				format={(v) =>
					v > 0.85 ? `${Math.round(v * 100)}% · overdriven` : `${Math.round(v * 100)}%`}
			/>
			<Slider
				bind:value={response}
				label="response"
				min={0}
				max={1}
				step={0.02}
				format={(v) => `${Math.round((0.015 + v * 0.32) * 750)} ms`}
			/>
			<Slider bind:value={backlight} label="backlight" min={0} max={1} step={0.05} />
			<Slider
				bind:value={age}
				label="age"
				min={0}
				max={1}
				step={0.02}
				format={(v) =>
					v >= 0.95
						? `${Math.round(v * 100)}% · dead column`
						: v > 0.7
							? `${Math.round(v * 100)}% · dying`
							: `${Math.round(v * 100)}%`}
			/>
			<div class="row">
				<ToggleChip bind:checked={ghost} label="dot lattice" />
			</div>
		</section>

		<section>
			<h2>size</h2>
			<Slider
				bind:value={moduleW}
				label="width"
				min={240}
				max={720}
				step={10}
				format={(v) => `${v}px`}
			/>
			<Slider
				bind:value={moduleH}
				label="height"
				min={80}
				max={260}
				step={5}
				format={(v) => `${v}px`}
			/>
		</section>

		<section>
			<h2>scene</h2>
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
	.stage canvas {
		cursor: pointer;
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
