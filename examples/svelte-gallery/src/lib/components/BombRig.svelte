<script lang="ts">
	// The prop around the countdown: a board somebody hacked together, taped to a
	// bundle of sticks with whatever wire was in the drawer. Everything here is
	// page decoration — the library ships displays, not props — and the digits are
	// the caller's canvases, mounted through the window cut in the board.
	//
	// Nothing in the drawing is centred, matched or clean on purpose: the tape is
	// torn, the chip sits crooked in its socket, a screw is missing and the wires
	// cross each other. A tidy bomb is a product; this one was made in a hurry.
	import {
		BOMB_LEADS,
		BOMB_WIRES,
		type BombCut,
		type BombLead,
		type BombState,
		type BombWire
	} from '$lib/examples/seven';

	let {
		state,
		cut,
		oncut,
		children
	}: {
		state: BombState;
		/** Wires and leads already cut — they hang in two pieces from then on. */
		cut: BombCut[];
		oncut: (wire: BombCut) => void;
		children: import('svelte').Snippet;
	} = $props();

	// The armed lamp ticks with the clock; a defused rig goes dark, a detonated
	// one latches red.
	const lamp = $derived(
		state === 'armed' ? 'var(--rig-armed)' : state === 'defused' ? '#33513c' : 'var(--rig-blown)'
	);

	const WIRE_COLORS: Record<BombWire, string> = {
		red: '#c23a2c',
		blue: '#3a72c4',
		yellow: '#d5ad38'
	};
	// Nobody dressed this loom: the wires cross on their way across the block, and
	// the paths are hand-set so each keeps a clear span to aim at either side of a
	// crossing. Every run is clamped at both ends rather than trailing off the
	// drawing — blue and yellow between the two terminal blocks, and RED up onto
	// the board's own screw terminal, which is what makes it the wire wired to the
	// timer rather than three wires wired to each other.
	const WIRE_PATH: Record<BombWire, string> = {
		red: 'M46 162 C 150 244, 300 214, 440 130',
		blue: 'M46 186 C 170 214, 320 254, 470 186',
		yellow: 'M46 210 C 180 266, 340 234, 470 210'
	};
	// Where the cut ends spring apart, as two pieces of the same run — still held
	// at their ends.
	const WIRE_CUT: Record<BombWire, [string, string]> = {
		red: ['M46 162 C 130 228, 200 224, 232 214', 'M288 206 C 340 200, 380 178, 440 130'],
		blue: ['M46 186 C 140 206, 200 230, 232 240', 'M288 250 C 360 250, 410 208, 470 186'],
		yellow: ['M46 210 C 150 254, 210 254, 242 250', 'M298 244 C 360 240, 410 220, 470 210']
	};
	/** The lug each wire leaves on the left-hand block. */
	const WIRE_LUG: Record<BombWire, number> = { red: 162, blue: 186, yellow: 210 };
	/** The wires that also land in a lug on the RIGHT-hand block; red does not. */
	const RIGHT_LUG: BombWire[] = ['blue', 'yellow'];

	// Insulation is a sleeve over copper, and a cut is where you see that: each
	// severed end shows a short stub of stranded conductor pointing into the gap.
	// [x, y, dx, dy] per end, in the same units as the paths above.
	const WIRE_COPPER: Record<BombWire, [number, number, number, number][]> = {
		red: [
			[232, 214, 1, -0.25],
			[288, 206, -1, 0.25]
		],
		blue: [
			[232, 240, 1, 0.2],
			[288, 250, -1, -0.05]
		],
		yellow: [
			[242, 250, 1, 0],
			[298, 244, -1, 0.1]
		]
	};
	const LEAD_COPPER: Record<BombLead, [number, number, number, number][]> = {
		detRed: [
			[76, 146, -0.85, -0.5],
			[66, 138, 0.85, 0.5]
		],
		detBlack: [
			[95, 150, -0.5, -0.85],
			[90, 142, 0.5, 0.85]
		]
	};

	// The detonator's own pair, out of the cap and up into the board. Spread wide
	// enough apart that each lead is separately aimable.
	const LEAD_COLORS: Record<BombLead, string> = { detRed: '#b34a3c', detBlack: '#2b2f36' };
	const LEAD_PATH: Record<BombLead, string> = {
		detRed: 'M92 168 C 88 150, 72 138, 56 130',
		detBlack: 'M99 168 C 101 150, 94 144, 86 138'
	};
	const LEAD_CUT: Record<BombLead, [string, string]> = {
		detRed: ['M92 168 C 90 158, 84 150, 76 146', 'M66 138 C 62 135, 60 132, 56 130'],
		detBlack: ['M99 168 C 100 160, 98 154, 95 150', 'M90 142 C 89 140, 88 139, 86 138']
	};
	const LEAD_LABEL: Record<BombLead, string> = {
		detRed: "the detonator's red lead",
		detBlack: "the detonator's black lead"
	};
</script>

<div class="rig" class:blown={state === 'detonated'} class:safe={state === 'defused'}>
	<svg class="board" viewBox="0 0 520 300" role="presentation" aria-hidden="true">
		<defs>
			<linearGradient id="pcb" x1="0" y1="0" x2="0.2" y2="1">
				<stop offset="0" stop-color="#22432f" />
				<stop offset="0.6" stop-color="#183020" />
				<stop offset="1" stop-color="#112317" />
			</linearGradient>
			<linearGradient id="putty" x1="0" y1="0" x2="0.1" y2="1">
				<stop offset="0" stop-color="#9c927a" />
				<stop offset="0.35" stop-color="#877e67" />
				<stop offset="0.8" stop-color="#665f4c" />
				<stop offset="1" stop-color="#4b463a" />
			</linearGradient>
			<linearGradient id="wrapper" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color="#4d5334" />
				<stop offset="1" stop-color="#333823" />
			</linearGradient>
			<linearGradient id="duct" x1="0" y1="0" x2="1" y2="0">
				<stop offset="0" stop-color="#33352f" />
				<stop offset="0.3" stop-color="#4a4d46" />
				<stop offset="0.72" stop-color="#3f423b" />
				<stop offset="1" stop-color="#2c2e29" />
			</linearGradient>
			<!-- Tape off a roll: the long edges are the roll's own, dead straight; only
			     the ends are torn. -->
			<clipPath id="tapeA">
				<path
					d="M146 141 L157 136 L168 141 L180 137 L191 141 L200 137 L200 289 L191 293
					   L180 289 L168 294 L157 289 L146 293 Z"
				/>
			</clipPath>
			<clipPath id="tapeB">
				<path
					d="M300 147 L311 142 L322 147 L334 143 L345 147 L354 143 L354 295 L345 299
					   L334 295 L322 300 L311 295 L300 299 Z"
				/>
			</clipPath>
			<!-- Everything printed on the block is clipped to the block itself, so the
			     wrapper band follows its rounded corners instead of squaring them off. -->
			<clipPath id="blockClip">
				<rect x="58" y="150" width="404" height="128" rx="7" />
			</clipPath>
			<!-- The grain that keeps fibreglass from reading as a flat swatch. -->
			<filter id="grain" x="0" y="0" width="100%" height="100%">
				<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
				<feColorMatrix type="saturate" values="0" />
			</filter>
		</defs>

		<!-- One block of plastic explosive: kneaded putty, not a bundle of sticks. -->
		<g>
			<rect x="58" y="150" width="404" height="128" rx="7" fill="url(#putty)" />
			<rect x="58" y="150" width="404" height="128" rx="7" filter="url(#grain)" opacity="0.09" />
			<g clip-path="url(#blockClip)">
				<!-- Thumbed-in creases and a dent where it was pressed onto the board. -->
				<g stroke="#4f4a3b" stroke-width="1.6" fill="none" opacity="0.45">
					<path d="M96 186 C 150 176, 210 198, 268 188" />
					<path d="M120 240 C 190 232, 250 250, 320 238" />
					<path d="M330 200 C 372 194, 410 208, 444 200" />
				</g>
				<ellipse cx="180" cy="212" rx="34" ry="16" fill="#c0b697" opacity="0.13" />
				<ellipse cx="392" cy="248" rx="26" ry="12" fill="#c0b697" opacity="0.09" />
				<!-- The mylar wrapper: a printed band round the block, torn along its top. -->
				<path
					d="M58 226 L98 223 L136 225 L180 221 L220 224 L262 220 L300 223 L344 219 L384 222
				   L422 220 L462 222 L462 278 L58 278 Z"
					fill="url(#wrapper)"
					opacity="0.95"
				/>
				<path
					d="M58 229 L98 226 L136 228 L180 224 L220 227 L262 223 L300 226 L344 222 L384 225
				   L422 223 L462 225"
					stroke="#6b7346"
					stroke-width="1.2"
					fill="none"
					opacity="0.45"
				/>
				<!-- Stencilled on the band, the way a demo block is marked. -->
				<text x="82" y="258" class="stencil">C-4</text>
				<text x="210" y="258" class="stencil small">COMP · 1.25 LB</text>
				<text x="392" y="258" class="stencil small">M112</text>
			</g>
			<!-- The detonator is BURIED in the putty — pushed in to the crimp, the way
			     it has to be to do anything. All that shows from the front is the hole
			     it went in through, the putty pushed up around it, and its two leads. -->
			<g>
				<ellipse cx="95" cy="171" rx="12" ry="7" fill="#5b543f" opacity="0.55" />
				<ellipse cx="95" cy="169" rx="9" ry="5" fill="#2a2618" />
				<!-- The lip of putty the cap shouldered aside going in. -->
				<path
					d="M83 169 C 85 160, 105 160, 107 169"
					stroke="#b3a98b"
					stroke-width="2"
					fill="none"
					opacity="0.5"
				/>
			</g>

			<!-- Two strips of silver duct tape, torn off the roll and slapped on askew:
			     the board is stuck to the block with what was in the bag. The scrim
			     shows through the vinyl, which is what makes duct tape read as duct
			     tape and not as grey paper. -->
			<g transform="rotate(-1.5 173 215)">
				<path
					d="M146 141 L157 136 L168 141 L180 137 L191 141 L200 137 L200 289 L191 293
					   L180 289 L168 294 L157 289 L146 293 Z"
					fill="url(#duct)"
					stroke="#22241f"
					stroke-width="0.8"
				/>
				<!-- The scrim weave under the vinyl. -->
				<g clip-path="url(#tapeA)" stroke="#4e514d" stroke-width="0.7" opacity="0.22" fill="none">
					{#each [150, 162, 174, 186, 198, 210, 222, 234, 246, 258, 270, 282] as ty (ty)}
						<path d="M146 {ty} h56" />
					{/each}
					{#each [152, 162, 172, 182, 192] as tx (tx)}
						<path d="M{tx} 136 v158" />
					{/each}
				</g>
				<!-- One highlight down the length, and the threads left at a torn end. -->
				<path
					d="M154 138 L156 291"
					stroke="#7d807a"
					stroke-width="1.6"
					opacity="0.28"
					fill="none"
				/>
				<g stroke="#8b8e89" stroke-width="0.7" opacity="0.4" fill="none">
					<path d="M162 137 l2 -5" />
					<path d="M176 138 l1 -6" />
					<path d="M188 292 l2 5" />
				</g>
			</g>
			<g transform="rotate(2.5 327 221)">
				<path
					d="M300 147 L311 142 L322 147 L334 143 L345 147 L354 143 L354 295 L345 299
					   L334 295 L322 300 L311 295 L300 299 Z"
					fill="url(#duct)"
					stroke="#1f211c"
					stroke-width="0.8"
				/>
				<g clip-path="url(#tapeB)" stroke="#4a4d49" stroke-width="0.7" opacity="0.2" fill="none">
					{#each [152, 164, 176, 188, 200, 212, 224, 236, 248, 260, 272, 284] as ty (ty)}
						<path d="M300 {ty} h56" />
					{/each}
					{#each [306, 316, 326, 336, 346] as tx (tx)}
						<path d="M{tx} 142 v158" />
					{/each}
				</g>
				<path
					d="M308 144 L310 297"
					stroke="#767973"
					stroke-width="1.6"
					opacity="0.24"
					fill="none"
				/>
				<g stroke="#868984" stroke-width="0.7" opacity="0.35" fill="none">
					<path d="M328 144 l2 -5" />
					<path d="M340 298 l1 5" />
				</g>
			</g>
		</g>

		<!-- The board, screwed on over the bundle. -->
		<rect x="34" y="16" width="452" height="126" rx="5" fill="url(#pcb)" stroke="#0b1710" />
		<rect x="34" y="16" width="452" height="126" rx="5" filter="url(#grain)" opacity="0.07" />
		<g stroke="#7fb894" stroke-width="0.9" opacity="0.16" fill="none">
			<path d="M60 128 l58 -9" />
			<path d="M300 26 l40 6" />
			<path d="M420 132 l34 -14" />
		</g>

		<!-- Traces, pads and a few solder blobs. -->
		<g stroke="#4a9a70" stroke-width="1.5" fill="none" opacity="0.45">
			<path d="M252 26h30v14h44" />
			<path d="M378 34h40v18h30" />
			<path d="M476 92h-38v18h-24" />
			<path d="M248 132h60v-10h40" />
			<path d="M382 128h44v-12h30" />
			<path d="M42 138h70v-8h44" />
		</g>
		<g fill="#c3bcae" opacity="0.6">
			{#each [46, 60, 74, 88] as px (px)}
				<rect x={px} y="130" width="8" height="4" rx="1" />
			{/each}
		</g>
		<g fill="#9aa2a8" opacity="0.8">
			<circle cx="252" cy="50" r="2.6" />
			<circle cx="380" cy="104" r="2.4" />
			<circle cx="466" cy="70" r="2.2" />
			<circle cx="121" cy="130" r="2.2" />
		</g>

		<!-- The window the display modules are mounted through — hacked out to the
		     left, close around the glass, because whoever cut it measured once. -->
		<rect x="44" y="26" width="196" height="110" rx="3" fill="#070f0b" stroke="#0a1610" />
		<rect x="44" y="26" width="196" height="110" rx="3" filter="url(#grain)" opacity="0.05" />
		<!-- A hacksaw wobble along the top edge of the cut. -->
		<path
			d="M44 26 l40 1.5 l38 -1 l44 1.5 l34 -1 l40 1"
			stroke="#2b4636"
			stroke-width="1.4"
			fill="none"
			opacity="0.7"
		/>

		<!-- The right-hand half: the lamp, two chips crooked in their sockets, the
		     fat caps, a trimmer nobody should turn. -->
		<circle cx="262" cy="34" r="9" fill={lamp} class="lamp" />
		<circle cx="262" cy="34" r="9" fill="none" stroke="#0b1710" />
		<circle cx="286" cy="34" r="4.5" fill="#a8862c" opacity="0.8" />
		<!-- Scrawled on with a marker, by someone in a hurry. -->
		<text x="298" y="39" class="scrawl">ARM</text>
		<g transform="rotate(-5 306 74)">
			<rect x="262" y="60" width="88" height="28" rx="2" fill="#15181d" stroke="#080a0d" />
			<!-- Pin-1 notch and dot, the way the package is oriented. -->
			<path d="M300 60 a 6 6 0 0 0 12 0" fill="#0c0f13" />
			<circle cx="270" cy="66" r="2" fill="#333a42" />
			<g fill="#5c6470">
				{#each [268, 286, 304, 322, 340] as px (px)}
					<rect x={px} y="88" width="6" height="7" rx="1" />
					<rect x={px} y="53" width="6" height="7" rx="1" />
				{/each}
			</g>
		</g>
		<g transform="rotate(3 424 68)">
			<rect x="398" y="56" width="56" height="24" rx="2" fill="#181c22" stroke="#090b0e" />
			<path d="M420 56 a 5 5 0 0 0 10 0" fill="#0c0f13" />
			<g fill="#5c6470">
				{#each [404, 421, 438] as px (px)}
					<rect x={px} y="80" width="6" height="6" rx="1" />
					<rect x={px} y="50" width="6" height="6" rx="1" />
				{/each}
			</g>
		</g>
		<circle cx="270" cy="116" r="16" fill="#282d35" stroke="#151920" />
		<circle cx="270" cy="116" r="5" fill="#3c434e" />
		<path d="M262 104 a 16 16 0 0 1 8 -4" stroke="#4d5661" stroke-width="2" fill="none" />
		<circle cx="312" cy="120" r="11" fill="#282d35" stroke="#151920" />
		<!-- A resistor and the trimmer, its slot left off-centre. -->
		<rect x="336" y="110" width="34" height="12" rx="2" fill="#3a3025" stroke="#241d15" />
		<g fill="#8e5a2c">
			{#each [341, 347, 353] as bx (bx)}
				<rect x={bx} y="110" width="3" height="12" />
			{/each}
		</g>
		<circle cx="404" cy="116" r="13" fill="#5d4a22" stroke="#2a2110" />
		<path d="M397 113 l14 6" stroke="#1d1709" stroke-width="2.5" fill="none" />
		<!-- A two-pin header with nothing plugged into it. -->
		<rect x="248" y="104" width="10" height="24" rx="1.5" fill="#1a1e24" stroke="#0a0d10" />
		<g fill="#8d8779" opacity="0.7">
			<rect x="251" y="108" width="4" height="4" />
			<rect x="251" y="118" width="4" height="4" />
		</g>

		<!-- Three screws and one empty hole. -->
		<g>
			{#each [[44, 26], [476, 26], [476, 132]] as [sx, sy] (sx + '-' + sy)}
				<circle cx={sx} cy={sy} r="4" fill="#8d8779" opacity="0.75" />
				<path
					d="M{sx - 3} {sy}h6"
					stroke="#4a463f"
					stroke-width="1.4"
					transform="rotate({sx % 7} {sx} {sy})"
				/>
			{/each}
			<circle cx="44" cy="132" r="4" fill="#0a120d" stroke="#2c3a31" stroke-width="0.8" />
		</g>

		<!-- The board's own screw terminal, where the timer's output leaves it. -->
		<rect x="428" y="114" width="36" height="26" rx="2" fill="#20242c" stroke="#0d1015" />
		<circle cx="440" cy="127" r="5" fill="#9b8b52" stroke="#5c5230" stroke-width="1" />
		<path d="M436.6 127h6.8" stroke="#3f3a22" stroke-width="1.6" />
		<circle cx="454" cy="127" r="4" fill="#3b424c" stroke="#0d1015" stroke-width="0.8" />

		<!-- Terminal blocks: three screw lugs a side, and the loom lands in them. -->
		{#each [46, 470] as tx (tx)}
			<rect x={tx - 15} y="142" width="30" height="88" rx="3" fill="#20242c" stroke="#0d1015" />
			<rect x={tx - 15} y="142" width="30" height="88" rx="3" filter="url(#grain)" opacity="0.06" />
			{#each [162, 186, 210] as ty (ty)}
				<rect
					x={tx - 11}
					y={ty - 9}
					width="22"
					height="18"
					rx="2"
					fill="#2b313a"
					stroke="#0f1216"
				/>
				<circle cx={tx} cy={ty} r="5" fill="#9b8b52" stroke="#5c5230" stroke-width="1" />
				<path d="M{tx - 3.4} {ty}h6.8" stroke="#3f3a22" stroke-width="1.6" />
			{/each}
		{/each}
	</svg>

	<!-- The display module: the caller's digit canvases, dropped into the window. -->
	<div class="cutout">
		{@render children()}
	</div>

	<!-- The wires. Three leave the block; one of them is the wrong one. -->
	<svg class="wires" viewBox="0 0 520 300" role="group" aria-label="wires">
		{#each BOMB_WIRES as wire (wire)}
			{@const isCut = cut.includes(wire)}
			<g class="wire" class:cut={isCut}>
				{#if isCut}
					<path d={WIRE_CUT[wire][0]} stroke={WIRE_COLORS[wire]} />
					<path d={WIRE_CUT[wire][1]} stroke={WIRE_COLORS[wire]} />
					{#each WIRE_COPPER[wire] as [cx, cy, dx, dy] (cx)}
						<g class="copper">
							<path d="M{cx} {cy} l{dx * 9} {dy * 9}" stroke-width="3" />
							<path d="M{cx} {cy} l{dx * 7 - dy * 2} {dy * 7 + dx * 2}" />
							<path d="M{cx} {cy} l{dx * 6 + dy * 2.5} {dy * 6 - dx * 2.5}" />
						</g>
					{/each}
				{:else}
					<path d={WIRE_PATH[wire]} stroke={WIRE_COLORS[wire]} />
					<!-- A sheen along the top of the insulation. -->
					<path class="sheen" d={WIRE_PATH[wire]} />
				{/if}
				<!-- The hit target is a fat invisible stroke over the wire's own path. -->
				<path
					class="grab"
					class:done={isCut}
					d={WIRE_PATH[wire]}
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
		<!-- The detonator's pair: thin, and the honest way to disarm the thing. -->
		{#each BOMB_LEADS as lead (lead)}
			{@const isCut = cut.includes(lead)}
			<g class="lead" class:cut={isCut}>
				{#if isCut}
					<path d={LEAD_CUT[lead][0]} stroke={LEAD_COLORS[lead]} />
					<path d={LEAD_CUT[lead][1]} stroke={LEAD_COLORS[lead]} />
					{#each LEAD_COPPER[lead] as [cx, cy, dx, dy] (cx)}
						<g class="copper thin">
							<path d="M{cx} {cy} l{dx * 5} {dy * 5}" stroke-width="1.4" />
							<path d="M{cx} {cy} l{dx * 4 - dy * 1.4} {dy * 4 + dx * 1.4}" />
						</g>
					{/each}
				{:else}
					<path d={LEAD_PATH[lead]} stroke={LEAD_COLORS[lead]} />
				{/if}
				<path
					class="grab"
					class:done={isCut}
					d={LEAD_PATH[lead]}
					role="button"
					tabindex={isCut ? -1 : 0}
					aria-label={isCut ? `${LEAD_LABEL[lead]}, cut` : `cut ${LEAD_LABEL[lead]}`}
					aria-disabled={isCut}
					onclick={() => !isCut && oncut(lead)}
					onkeydown={(e: KeyboardEvent) => {
						if (isCut) return;
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							oncut(lead);
						}
					}}
				/>
			</g>
		{/each}

		<!-- Stripped conductor going into each clamp, under the collars. -->
		{#each BOMB_WIRES as wire (wire + '-strip')}
			{@const y = WIRE_LUG[wire]}
			<path class="copper" d="M36 {y} h18" stroke-width="2.6" />
			{#if RIGHT_LUG.includes(wire)}
				<path class="copper" d="M462 {y} h18" stroke-width="2.6" />
			{/if}
		{/each}
		<path class="copper" d="M432 133 l12 -5" stroke-width="2.4" />

		<!-- The crimped collars where each run is screwed down. -->
		{#each BOMB_WIRES as wire (wire + '-lug')}
			{@const y = WIRE_LUG[wire]}
			<rect
				x="38"
				y={y - 5.5}
				width="16"
				height="11"
				rx="2"
				fill="#b3ad9e"
				stroke="#5f5a4e"
				stroke-width="0.8"
				opacity="0.9"
			/>
			{#if RIGHT_LUG.includes(wire)}
				<rect
					x="462"
					y={y - 5.5}
					width="16"
					height="11"
					rx="2"
					fill="#b3ad9e"
					stroke="#5f5a4e"
					stroke-width="0.8"
					opacity="0.9"
				/>
			{/if}
		{/each}
		<!-- Red's other end, clamped under the board's terminal screw. -->
		<rect
			x="433"
			y="124"
			width="14"
			height="10"
			rx="2"
			fill="#b3ad9e"
			stroke="#5f5a4e"
			stroke-width="0.8"
			opacity="0.9"
		/>
		<!-- A scrap of tape holding the yellow wire down to the block. Cut that wire
		     and it has nothing left to hold: it peels off and drops. -->
		<g class="scrap" class:fallen={cut.includes('yellow')} transform="rotate(-4 269 243)">
			<path
				d="M252 231 L262 228 L273 231 L284 228 L284 256 L273 259 L262 256 L252 259 Z"
				fill="url(#duct)"
				stroke="#6c6f6b"
				stroke-width="0.8"
			/>
			<path d="M256 229 L257 258" stroke="#9a9d98" stroke-width="1.2" opacity="0.28" fill="none" />
		</g>
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

	.stencil {
		font-family: 'DIN Condensed', 'Oswald', 'Arial Narrow', sans-serif;
		font-size: 15px;
		letter-spacing: 1.5px;
		fill: #d8d2b8;
		opacity: 0.5;
	}
	.stencil.small {
		font-size: 9px;
		letter-spacing: 1px;
		opacity: 0.4;
	}

	.scrawl {
		font-family: 'Bradley Hand', 'Segoe Print', 'Comic Sans MS', cursive;
		font-size: 13px;
		fill: #cbd8cd;
		opacity: 0.45;
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
		/* The window cut in the board: x 44..240, y 26..136 of the 520×300 board. */
		left: 8.5%;
		top: 8.7%;
		width: 37.7%;
		height: 36.7%;
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		justify-content: center;
		gap: 1.5%;
	}
	/* The modules are mounted through the window, so the window sizes them: each
	   digit takes an equal share of it and the colon slot a narrow one. That way
	   the row fits the prop at any screen width — the alternative, pixel sizes,
	   spills a phone-width rig straight out of its own board. */
	.cutout :global(.clock) {
		width: 100%;
		height: 100%;
		gap: 1.5%;
	}
	.cutout :global(canvas) {
		flex: 1 1 0;
		min-width: 0;
		height: 100%;
	}
	.cutout :global(canvas.colon) {
		flex: 0.4 1 0;
	}

	.wire path {
		fill: none;
		stroke-width: 8;
		stroke-linecap: round;
	}
	.lead path {
		fill: none;
		stroke-width: 2.6;
		stroke-linecap: round;
	}
	/* The pair is thin, so its targets are thin too — still wide enough to hit,
	   and narrow enough that the two leads stay separately aimable. */
	.lead .grab {
		stroke: transparent;
		stroke-width: 11;
		pointer-events: stroke;
		cursor: crosshair;
	}
	.lead .grab.done {
		cursor: default;
		pointer-events: none;
	}
	.lead .grab:focus-visible {
		stroke: color-mix(in srgb, var(--halo-accent) 70%, transparent);
		stroke-width: 7;
		outline: none;
	}
	.lead .grab.done:focus-visible {
		stroke: transparent;
	}
	/* The tape scrap: stuck down until the wire under it parts, then it goes. The
	   tilt lives here rather than in a transform attribute — setting a
	   transform-box re-anchors the attribute too, which moves the element. */
	.scrap {
		transform-box: fill-box;
		transform-origin: 50% 20%;
		transform: rotate(-4deg);
		transition:
			transform 700ms cubic-bezier(0.3, 0.9, 0.4, 1),
			opacity 700ms ease;
	}
	.scrap.fallen {
		transform: translate(6px, 46px) rotate(28deg);
		opacity: 0.8;
	}
	@media (prefers-reduced-motion: reduce) {
		.scrap {
			transition: none;
		}
	}

	/* Bare conductor: warm copper, thinner than the sleeve it came out of. */
	.copper path {
		fill: none;
		stroke: #c98a3c;
		stroke-width: 1.6;
		stroke-linecap: round;
	}
	.copper path:first-child {
		stroke: #e0a75c;
	}
	.copper.thin path {
		stroke: #bf823a;
	}
	.wire .sheen {
		stroke: #ffffff;
		stroke-width: 2;
		opacity: 0.16;
		transform: translateY(-1.5px);
	}
	.wire .grab {
		stroke: transparent;
		/* Narrow enough that neighbouring wires stay separately aimable — an
		   overlapping hit target cuts the wrong wire. */
		stroke-width: 18;
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
