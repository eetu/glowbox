<script lang="ts">
	// A character LCD on @glowbox/lcd — the family's first reflective display,
	// shown on a LIGHT stage on purpose. The attract loop cycles the physics a webfont
	// can't fake: typing under a blinking block cursor, a CGRAM bar meter (the custom-
	// glyph party trick), a scrolling line dragging its crystal ghost, and a power
	// cycle through the uninitialised row of boot boxes. Type mode hands the module
	// over: one input per row where the caret IS the cursor (selectionStart →
	// setCursor), and a tap on the glass parks the caret on that cell (cellAt —
	// the module answers geometry; the page owns the tap).
	import {
		createLcdModule,
		LATIN_5X7,
		type LcdCursor,
		type LcdModule,
		type PanelName,
		repertoire5x7
	} from '@glowbox/lcd';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import X from '@lucide/svelte/icons/x';
	import { tick, untrack } from 'svelte';

	import CoreNav from '$lib/components/CoreNav.svelte';
	import Segmented from '$lib/components/Segmented.svelte';
	import Slider from '$lib/components/Slider.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import ToggleChip from '$lib/components/ToggleChip.svelte';

	let mode = $state<'attract' | 'type'>('attract');
	let panel = $state<PanelName>('green');
	let backlight = $state(1);
	let contrast = $state(0.8);
	let response = $state(0.4);
	let ghost = $state(true);
	let age = $state(0);
	let on = $state(true);
	let cursorStyle = $state<LcdCursor>('block');
	let moduleW = $state(480);
	let moduleH = $state(150);
	// The module's plastic frame: colour, thickness in dot pitches, or none at all
	// (`bezel: null` — bare glass, to compose the module into hardware of your own).
	let bezelOn = $state(true);
	let bezelColor = $state('#14161a');
	let bezelWidth = $state(3);
	// Reflective glass belongs on a light wall — the opposite default to every
	// emissive sibling's near-black stage.
	let backdrop = $state('#e9e7e1');
	let panelOpen = $state(false);
	const onKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Escape' && panelOpen) panelOpen = false;
	};

	// The catalogue module sizes — cols/rows regrid the same glass via setOptions.
	type ModuleSize = '8x1' | '16x2' | '20x4';
	const DIMS: Record<ModuleSize, [number, number]> = {
		'8x1': [8, 1],
		'16x2': [16, 2],
		'20x4': [20, 4]
	};
	const MAX_ROWS = 4;
	let dims = $state<ModuleSize>('16x2');
	const modCols = $derived(DIMS[dims][0]);
	const modRows = $derived(DIMS[dims][1]);

	let canvas = $state<HTMLCanvasElement>();
	let lcd = $state.raw<LcdModule | null>(null);

	// CGRAM: eight bar glyphs, slot n = n+1 rows of ink from the floor — programmed
	// once at creation, so the attract meter and typed code points 0–7 read the same
	// slots.
	function programGlyphs(m: LcdModule) {
		for (let slot = 0; slot < 8; slot++) {
			const rows = Array.from({ length: 8 }, (_, r) => (r >= 7 - slot ? 0b11111 : 0));
			m.setGlyph(slot, rows);
		}
	}

	// --- the attract loop: one scene clock, five scenes -------------------------
	const TYPED = ['GLOWBOX LCD 16X2', 'READY>'];
	const SCROLL = 'THE CRYSTALS ARE SLOW AND THAT IS THE POINT - WATCH THE TRAIL...   ';
	// The font showcase: everything the face can draw — the vendored ASCII
	// repertoire plus the injected Latin/Nordic extension table.
	const CHARSET = [...repertoire5x7().filter((c) => c !== ' '), ...Object.keys(LATIN_5X7)].join('');
	let timer: ReturnType<typeof setInterval> | undefined;
	function startProgram(m: LcdModule) {
		let tick = 0;
		let scene = 0; // 0 type · 1 meter · 2 charset · 3 scroll · 4 power cycle
		let sceneT = 0;
		clearInterval(timer);
		timer = setInterval(() => {
			tick++;
			sceneT++;
			// Read the width live: a regrid mid-programme just narrows the scenes.
			const cols = m.cols;
			if (scene === 0) {
				// Typing: the block cursor leads, the crystals chase.
				const n = Math.min(sceneT, TYPED[0].length + TYPED[1].length);
				const l0 = TYPED[0].slice(0, n);
				const l1 = n > TYPED[0].length ? TYPED[1].slice(0, n - TYPED[0].length) : '';
				m.setText([l0, l1]);
				const done = n >= TYPED[0].length + TYPED[1].length;
				m.setOptions({ cursor: 'block' });
				m.setCursor(
					Math.min(cols - 1, done ? l1.length : (l1 ? l1 : l0).length),
					l1 || done ? 1 : 0
				);
				if (sceneT > 55) {
					scene = 1;
					sceneT = 0;
					m.setOptions({ cursor: 'none' });
				}
			} else if (scene === 1) {
				// The CGRAM meter: bar columns breathing on a sine field.
				let bars = '';
				for (let x = 0; x < cols; x++) {
					const level = 0.5 + 0.5 * Math.sin(tick * 0.35 + x * 0.55) * Math.sin(tick * 0.11 + x);
					bars += String.fromCharCode(Math.max(0, Math.min(7, Math.round(level * 7))));
				}
				m.setText(['INPUT LEVEL', bars]);
				if (sceneT > 70) {
					scene = 2;
					sceneT = 0;
				}
			} else if (scene === 2) {
				// The font showcase: march the repertoire across the glass, page by page.
				const perPage = cols * m.rows;
				const start = Math.floor(sceneT / 22) * perPage;
				if (start >= CHARSET.length) {
					scene = 3;
					sceneT = 0;
				} else {
					const page: string[] = [];
					for (let r = 0; r < m.rows; r++)
						page.push(CHARSET.slice(start + r * cols, start + (r + 1) * cols));
					m.setText(page);
				}
			} else if (scene === 3) {
				// The scroll: motion is where the response smear lives.
				const win = (SCROLL + SCROLL).slice(
					sceneT % SCROLL.length,
					(sceneT % SCROLL.length) + cols
				);
				m.setText([win, 'CRYSTAL SPEED >>']);
				if (sceneT > 70) {
					scene = 4;
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
			createLcdModule(el, {
				panel,
				backlight,
				contrast,
				response,
				ghost,
				age,
				on,
				bezel: bezelOn ? bezelColor : null,
				bezelWidth,
				cols: modCols,
				rows: modRows,
				// The Latin/Nordic extension face, injected the opt-in way (import + option).
				glyphs: LATIN_5X7
			})
		);
		if (!m) return;
		programGlyphs(m);
		lcd = m;
		return () => {
			m.dispose();
			lcd = null;
		};
	});

	// Live-update the envelope (a cols/rows change regrids the same glass).
	$effect(() => {
		lcd?.setOptions({
			panel,
			backlight,
			contrast,
			response,
			ghost,
			age,
			bezel: bezelOn ? bezelColor : null,
			bezelWidth,
			cols: modCols,
			rows: modRows
		});
	});
	// The power switch on its own effect: the attract loop's power-cycle scene flips
	// the module internally, and folding `on` into the envelope patch would fight it.
	$effect(() => {
		lcd?.power(on);
	});
	$effect(() => {
		void moduleW;
		void moduleH;
		lcd?.resize();
	});

	// The attract programme runs only while it owns the glass — type mode and
	// STANDBY both take the wheel.
	$effect(() => {
		const m = lcd;
		if (!m || mode !== 'attract' || !on) return;
		untrack(() => startProgram(m));
		return () => clearInterval(timer);
	});

	// --- type mode: the bench --------------------------------------------------
	// One string per possible row (a geometry change never loses text); the module
	// shows the first `rows` of them.
	let typedLines = $state(['', '', '', '']);
	const lineEls: (HTMLInputElement | null)[] = [];

	// CGRAM at the bench: the inputs hold printable block elements (control
	// characters render as tofu in a text field) and this seam translates them to
	// the code points 0–7 that address the CGRAM slots on the glass. One code unit
	// each, so caret positions stay 1:1.
	const CGRAM_KEYS = '▁▂▃▄▅▆▇█';
	const toModule = (line: string) =>
		Array.from(line, (ch) => {
			const slot = CGRAM_KEYS.indexOf(ch);
			return slot >= 0 ? String.fromCharCode(slot) : ch;
		}).join('');

	$effect(() => {
		const m = lcd;
		if (!m || mode !== 'type') return;
		m.setOptions({ cursor: cursorStyle });
		m.setText(typedLines.slice(0, modRows).map(toModule));
	});

	// The input caret is the module cursor — HD44780 semantics for free.
	function syncCaret(r: number) {
		const el = lineEls[r];
		if (!el) return;
		lcd?.setCursor(Math.min(el.selectionStart ?? 0, modCols - 1), r);
	}

	// The preset ramp: bars up and back down, in the printable form.
	const RAMP = CGRAM_KEYS + [...CGRAM_KEYS].reverse().join('');
	const PRESETS: { label: string; lines: string[] }[] = [
		{ label: 'HELLO, WORLD', lines: ['HELLO, WORLD'] },
		{
			label: 'CGRAM ▁▃▅█',
			lines: ['INPUT LEVEL', RAMP]
		},
		{ label: 'DISK ERROR', lines: ['DISK B: READ ERR', 'RETRY?  >YES  NO'] },
		{ label: 'ÄÄKKÖSET', lines: ['ÄÄKKÖSET ÅÄÖ åäö', 'øæß üé çñ 21.5°C'] },
		{ label: 'clear', lines: [] }
	];
	async function applyPreset(lines: string[]) {
		typedLines = Array.from({ length: MAX_ROWS }, (_, r) => (lines[r] ?? '').slice(0, modCols));
		await tick(); // the caret can only land once the bound values have flushed
		const el = lineEls[0];
		el?.focus();
		el?.setSelectionRange(typedLines[0].length, typedLines[0].length);
		syncCaret(0);
	}

	// Tap the glass: park the caret on the cell under the finger. In type mode the
	// row is padded out to the tapped column — DDRAM addressing doesn't care that
	// nothing was written on the way there.
	async function onTap(e: MouseEvent) {
		const m = lcd;
		const cell = m?.cellAt(e.clientX, e.clientY);
		if (!m || !cell) return;
		if (mode === 'type') {
			const el = lineEls[cell.y];
			if (!el) return;
			if (typedLines[cell.y].length < cell.x)
				typedLines[cell.y] = typedLines[cell.y].padEnd(cell.x, ' ');
			// setSelectionRange clamps to the input's CURRENT value — the padding has
			// to flush into the DOM first, or the caret (and the glass cursor synced
			// from it) snaps back to the old end of the text.
			await tick();
			el.focus();
			el.setSelectionRange(cell.x, cell.x);
			syncCaret(cell.y);
		} else {
			m.setOptions({ cursor: 'block' });
			m.setCursor(cell.x, cell.y);
		}
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
			>mode
			<Segmented
				bind:value={mode}
				ariaLabel="mode"
				options={[
					{ value: 'attract', label: 'Attract' },
					{ value: 'type', label: 'Type' }
				]}
			/>
		</label>
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
		<div class="module">
			<canvas bind:this={canvas} style="width: {moduleW}px; height: {moduleH}px" onclick={onTap}
			></canvas>
			{#if mode === 'type'}
				<div class="bench" style="width: {moduleW}px">
					{#each typedLines.slice(0, modRows) as _, r (r)}
						<!-- svelte-ignore a11y_autofocus -->
						<input
							bind:this={lineEls[r]}
							bind:value={typedLines[r]}
							maxlength={modCols}
							autofocus={r === 0}
							spellcheck="false"
							autocomplete="off"
							aria-label={`module row ${r + 1}`}
							placeholder={r === 0 ? 'type here' : ''}
							oninput={() => syncCaret(r)}
							onkeyup={() => syncCaret(r)}
							onclick={() => syncCaret(r)}
							onfocus={() => syncCaret(r)}
						/>
					{/each}
					<div class="bench-row">
						<div class="presets">
							{#each PRESETS as p (p.label)}
								<button onclick={() => applyPreset(p.lines)}>{p.label}</button>
							{/each}
						</div>
						<Segmented
							bind:value={cursorStyle}
							ariaLabel="cursor style"
							options={[
								{ value: 'line', label: 'line' },
								{ value: 'block', label: 'block' }
							]}
						/>
					</div>
				</div>
			{/if}
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
				<ToggleChip bind:checked={on} label="power" />
			</div>
		</section>

		<section>
			<h2>size</h2>
			<label class="field"
				>module
				<Segmented
					bind:value={dims}
					ariaLabel="module size"
					options={[
						{ value: '8x1', label: '8×1' },
						{ value: '16x2', label: '16×2' },
						{ value: '20x4', label: '20×4' }
					]}
				/>
			</label>
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
			<Slider
				bind:value={bezelWidth}
				label="bezel"
				min={0}
				max={10}
				step={1}
				disabled={!bezelOn}
				hint={bezelOn ? undefined : 'no plastic — the glass has the canvas'}
				format={(v) => `${v} dots`}
			/>
			<div class="row">
				<ToggleChip bind:checked={bezelOn} label="plastic" />
				<input type="color" bind:value={bezelColor} disabled={!bezelOn} aria-label="bezel colour" />
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
		/* Never squeezed: a segmented control broken across two rows reads as a
		   mistake. The hint takes the hit instead — prose is allowed to wrap. */
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
		overflow: hidden;
		padding: 24px;
		transition: background var(--halo-d-fast) ease-out;
	}
	.stage canvas {
		cursor: pointer;
	}
	.module {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		min-width: 0;
		max-width: 100%;
	}

	/* The bench row — the inputs sit under the glass like a keypad ribbon cable. */
	.bench {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-width: 100%;
	}
	.bench input {
		padding: 7px 10px;
		font-family: var(--halo-font-mono, monospace);
		font-size: 13px;
		letter-spacing: 0.08em;
		color: var(--halo-text-main);
		background: var(--halo-bg-main);
		border: 1px solid var(--halo-border);
		border-radius: var(--halo-radius);
	}
	.bench input:focus-visible {
		border-color: var(--halo-accent);
		outline: none;
	}
	.bench-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
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
		color: var(--halo-text-muted);
		background: var(--halo-bg-main);
		border: 1px solid var(--halo-border);
		border-radius: var(--halo-radius);
		cursor: pointer;
	}
	.presets button:hover {
		color: var(--halo-text-main);
		border-color: var(--halo-accent);
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
	.row input[type='color']:disabled {
		opacity: 0.35;
		cursor: default;
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
