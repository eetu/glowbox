<script lang="ts">
	// The prop around the countdown: a scavenged board taped to a bundle of
	// sticks, wired up with whatever was in the drawer. Everything here is page
	// decoration — the library ships displays, not props — and the digits are the
	// caller's canvases, mounted through the window cut in the board.
	import { BOMB_WIRES, type BombState, type BombWire } from '$lib/examples/seven';

	let {
		state,
		cut,
		oncut,
		children
	}: {
		state: BombState;
		/** Wires already cut — they hang in two pieces from then on. */
		cut: BombWire[];
		oncut: (wire: BombWire) => void;
		children: import('svelte').Snippet;
	} = $props();

	// The armed lamp ticks with the clock; a defused rig goes dark, a detonated
	// one latches red.
	const lamp = $derived(
		state === 'armed' ? 'var(--rig-armed)' : state === 'defused' ? '#2f4f3a' : 'var(--rig-blown)'
	);

	const WIRE_COLORS: Record<BombWire, string> = {
		red: '#c8392f',
		blue: '#3a72c4',
		yellow: '#d8b13a'
	};
	// Each wire leaves the board's left terminal block, sags across the bundle and
	// climbs back into the right one. Cutting one splits it at the sag.
	const WIRE_Y: Record<BombWire, number> = { red: 164, blue: 192, yellow: 220 };
</script>

<div class="rig" class:blown={state === 'detonated'} class:safe={state === 'defused'}>
	<svg class="board" viewBox="0 0 520 300" role="presentation" aria-hidden="true">
		<defs>
			<linearGradient id="pcb" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color="#20402e" />
				<stop offset="1" stop-color="#132419" />
			</linearGradient>
			<linearGradient id="stick" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color="#8a5a3c" />
				<stop offset="0.45" stop-color="#6d442c" />
				<stop offset="1" stop-color="#4a2c1c" />
			</linearGradient>
		</defs>

		<!-- The bundle: three sticks, banded with tape. Nobody labels these. -->
		<g>
			{#each [156, 196, 236] as sy (sy)}
				<rect x="58" y={sy} width="404" height="38" rx="19" fill="url(#stick)" />
				<rect
					x="58"
					y={sy}
					width="404"
					height="38"
					rx="19"
					fill="none"
					stroke="#331d12"
					stroke-width="1.5"
				/>
				<ellipse cx="72" cy={sy + 19} rx="7" ry="15" fill="#3d2417" opacity="0.85" />
				<ellipse cx="448" cy={sy + 19} rx="7" ry="15" fill="#3d2417" opacity="0.85" />
			{/each}
			<!-- Two wraps of tape holding the lot together. -->
			{#each [148, 330] as tx (tx)}
				<rect x={tx} y="148" width="46" height="134" rx="3" fill="#2c2a26" />
				<rect x={tx} y="148" width="46" height="134" rx="3" fill="none" stroke="#1b1a17" />
				<rect x={tx + 6} y="148" width="3" height="134" fill="#3a3733" opacity="0.7" />
			{/each}
		</g>

		<!-- The circuit board, screwed on over the bundle. -->
		<rect x="40" y="18" width="440" height="128" rx="6" fill="url(#pcb)" stroke="#0c1a12" />

		<!-- Traces + pads in the strip beside and under the window. -->
		<g stroke="#48916a" stroke-width="1.6" fill="none" opacity="0.5">
			<path d="M372 34h30v18h44" />
			<path d="M372 60h18v46h56" />
			<path d="M468 92h-42v18h-30" />
			<path d="M64 142h84v-8h46" />
			<path d="M250 142h60v-8h44" />
		</g>
		<g fill="#c3bcae" opacity="0.65">
			{#each [70, 86, 102, 118] as px (px)}
				<rect x={px} y="138" width="9" height="4" rx="1" />
			{/each}
		</g>

		<!-- The window the display modules are mounted through. -->
		<rect x="60" y="26" width="304" height="112" rx="4" fill="#08120d" stroke="#0b1912" />

		<!-- The right-hand strip: lamp, the chip nobody can identify, two fat caps. -->
		<circle cx="394" cy="44" r="10" fill={lamp} class="lamp" />
		<circle cx="394" cy="44" r="10" fill="none" stroke="#0c1a12" />
		<circle cx="424" cy="44" r="5" fill="#b8912f" opacity="0.85" />
		<rect x="376" y="66" width="86" height="26" rx="3" fill="#171a20" stroke="#0a0c10" />
		<g fill="#5c6470">
			{#each [382, 396, 410, 424, 438, 452] as px (px)}
				<rect x={px} y="92" width="5" height="6" />
			{/each}
		</g>
		<circle cx="398" cy="120" r="15" fill="#2a2f38" stroke="#171b21" />
		<circle cx="398" cy="120" r="5" fill="#3d444f" />
		<circle cx="442" cy="122" r="11" fill="#2a2f38" stroke="#171b21" />

		<!-- Terminal blocks the wires screw into. -->
		{#each [[52, 150], [468, 150]] as [tx, ty] (tx)}
			<rect x={tx - 14} y={ty - 14} width="28" height="76" rx="4" fill="#20242b" stroke="#0e1116" />
		{/each}

		<!-- The screws holding the whole idea together. -->
		<g fill="#8d8779" opacity="0.75">
			{#each [[52, 30], [468, 30], [52, 134], [468, 134]] as [sx, sy] (sx + '-' + sy)}
				<circle cx={sx} cy={sy} r="4" />
			{/each}
		</g>
	</svg>

	<!-- The display module: the caller's digit canvases, dropped into the window. -->
	<div class="cutout">
		{@render children()}
	</div>

	<!-- The wires. Three leave the terminal block; one of them is the wrong one. -->
	<svg class="wires" viewBox="0 0 520 300" role="group" aria-label="wires">
		{#each BOMB_WIRES as wire (wire)}
			{@const y = WIRE_Y[wire]}
			{@const isCut = cut.includes(wire)}
			<g class="wire" class:cut={isCut}>
				{#if isCut}
					<!-- Cut: two dead ends, sprung apart. -->
					<path d="M54 {y} C 120 {y + 40}, 180 {y + 48}, 232 {y + 40}" stroke={WIRE_COLORS[wire]} />
					<path
						d="M288 {y + 42} C 340 {y + 50}, 400 {y + 42}, 466 {y}"
						stroke={WIRE_COLORS[wire]}
					/>
				{:else}
					<path d="M54 {y} C 150 {y + 52}, 370 {y + 52}, 466 {y}" stroke={WIRE_COLORS[wire]} />
				{/if}
				<!-- The hit target is a fat invisible stroke over the wire's own path. -->
				<path
					class="grab"
					class:done={isCut}
					d="M54 {y} C 150 {y + 52}, 370 {y + 52}, 466 {y}"
					role="button"
					tabindex={isCut ? -1 : 0}
					aria-label={isCut ? `${wire} wire, cut` : `cut the ${wire} wire`}
					aria-disabled={isCut}
					onclick={() => !isCut && oncut(wire)}
					onkeydown={(e: KeyboardEvent) => {
						if (isCut) return;
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							oncut(wire);
						}
					}}
				/>
			</g>
		{/each}
	</svg>
</div>

<style>
	.rig {
		--rig-armed: #e04a2f;
		--rig-blown: #7a1d12;
		position: relative;
		width: min(820px, 94vw);
		aspect-ratio: 520 / 300;
		filter: drop-shadow(0 18px 30px rgb(0 0 0 / 0.45));
	}

	.board,
	.wires {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.wires {
		/* Only the wire strokes take the pointer; the rest is scenery. */
		pointer-events: none;
	}

	.lamp {
		filter: drop-shadow(0 0 7px var(--rig-armed));
	}
	.rig.safe .lamp {
		filter: none;
	}
	/* The armed rig's lamp ticks along with the clock; a still page leaves it lit. */
	@media (prefers-reduced-motion: no-preference) {
		.rig:not(.safe):not(.blown) .lamp {
			animation: pulse 1s steps(2, end) infinite;
		}
	}
	@keyframes pulse {
		0% {
			opacity: 1;
		}
		50% {
			opacity: 0.3;
		}
	}

	.cutout {
		position: absolute;
		/* The window cut in the board: x 60..364, y 26..138 of the 520×300 board. */
		left: 11.5%;
		top: 8.7%;
		width: 58.5%;
		height: 37.3%;
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		justify-content: center;
		gap: 3px;
	}

	.wire path {
		fill: none;
		stroke-width: 8;
		stroke-linecap: round;
	}
	.wire .grab {
		stroke: transparent;
		stroke-width: 24;
		/* Never wider than the 28-unit gap between wires: a hit target that
		   overlapped its neighbour would cut the wrong wire. */
		pointer-events: stroke;
		cursor: crosshair;
	}
	.wire .grab.done {
		cursor: default;
		pointer-events: none;
	}
	/* A ring on the wire itself, not a slab the width of the hit area — and a
	   wire already cut is done, so it stops advertising. */
	.wire .grab:focus-visible {
		stroke: color-mix(in srgb, var(--halo-accent) 70%, transparent);
		stroke-width: 13;
		outline: none;
	}
	.wire .grab.done:focus-visible {
		stroke: transparent;
	}
</style>
