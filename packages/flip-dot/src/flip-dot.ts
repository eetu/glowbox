// @glowbox/flip-dot — an electromechanical flip-dot board *component*, a sibling
// rendering core to the nixie tube and the seven-segment digit. The bar for existing
// at all (a grid of circles is a trivial canvas exercise) is the electromechanics —
// everything a static dot grid can't do:
//   • The flip is *physical*: each dot is a painted disc rotating about its pivot
//     axis — diagonal by default, the way the real pivot pins sit — mid-flip you see
//     it foreshorten to an edge-on sliver with a specular glint, then the other face
//     swings in. Not a cross-fade; a rotation.
//   • The scan wave: a frame change doesn't happen at once — rows flip in a driver
//     sweep (or per-dot random scatter), the signature ripple of the real boards.
//   • The board is a physical object: the unlit face is a dark disc distinct from
//     the board, with the mechanism notch bitten out of the rim — an off board
//     still reads as hardware. Flat matte by default (the way the boards
//     photograph); `shaded: true` adds the full lighting story.
//   • Optional solenoid click (`sound`) via `createMechSound` — flips *rattle*.
// Content is binary by nature; `ditherFrame` turns grayscale into the on/off frame.
// Give it a canvas; drive it with set/setFrame/setOptions. Import-safe under
// node/SSR (no browser globals at module scope).
import { type Color, parseColor, type RGB } from './color';
import { createMechSound, type MechSound } from './sound';

/** How a frame change spreads across the board. */
export type FlipDotStagger = 'scan' | 'random' | 'none';

/** Dot geometry: 'disc' is the classic round dot (two stop posts at ±90° to the
 *  pivot axis, the rim hole wrapping one of them); 'square' is the octagonal
 *  Brose/BUSE bus-sign vane on a central axle. */
export type FlipDotShape = 'disc' | 'square';

export interface FlipDotsOptions {
	/** Grid size (default 28×14 — one classic Alfa-Zeta panel). */
	cols?: number;
	rows?: number;
	/** Lit disc face (default the fluorescent yellow-green of the real boards). */
	onColor?: Color;
	/** Dark disc face (default near-black with a sheen). */
	offColor?: Color;
	/** Board plastic behind the discs (default '#101114'). */
	board?: Color;
	/** Gap around each disc as a fraction of the cell, 0..0.45 (default 0.14). */
	gap?: number;
	/** Dot geometry (default 'disc'). */
	shape?: FlipDotShape;
	/** Add the lighting story: face gradients + sheen, recessed socket wells, axle
	 *  dimples, and the edge-on glint. Default false — the real boards are matte
	 *  fluorescent paint and photograph flat; flat IS the authentic look. */
	shaded?: boolean;
	/** One disc's flip duration, ms (default 70; 0 = instant — also forced under
	 *  `prefers-reduced-motion`). */
	flipMs?: number;
	/** Pivot-axis angle in degrees (default 135; the two stop posts sit at ±90°
	 *  to the axis and the rim hole mirrors between them per face.
	 *  0 = horizontal axis, 90 = vertical). */
	axis?: number;
	/** 'scan' sweeps rows top→bottom like the driver electronics (default),
	 *  'random' scatters, 'none' flips everything at once. */
	stagger?: FlipDotStagger;
	/** Total stagger spread, ms (default 150). */
	scanMs?: number;
	/** Solenoid click: true (= 0.5) or a 0..1 volume. Default off. Sound starts on
	 *  the first user gesture (autoplay policy); nothing to wire up. */
	sound?: boolean | number;
	/** Cap on devicePixelRatio (default 2). */
	pixelRatio?: number;
	/** Accessible name (default 'flip-dot display'; '' hides from the a11y tree). */
	label?: string;
}

export interface FlipDotBoard {
	readonly cols: number;
	readonly rows: number;
	/** Flip one dot. */
	set(x: number, y: number, on: boolean): void;
	/** A dot's *target* state (what it is flipping toward). */
	get(x: number, y: number): boolean;
	/** Replace the whole frame: a row-major 0/1 array (`ditherFrame` output fits), or
	 *  a function of (x, y). Only dots that actually change flip — and rattle. */
	setFrame(frame: ArrayLike<number> | ((x: number, y: number) => number | boolean)): void;
	clear(): void;
	fill(): void;
	setOptions(patch: Partial<FlipDotsOptions>): void;
	resize(): void;
	snapshot(): string;
	dispose(): void;
}

const c255 = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
const rgba = (c: RGB, a: number) => `rgba(${c255(c[0])},${c255(c[1])},${c255(c[2])},${a})`;
const mix = (a: RGB, b: RGB, t: number): RGB => [
	a[0] + (b[0] - a[0]) * t,
	a[1] + (b[1] - a[1]) * t,
	a[2] + (b[2] - a[2]) * t
];
const WHITE: RGB = [1, 1, 1];
const BLACK: RGB = [0, 0, 0];

/** Create a flip-dot board on a 2D canvas. Returns null if 2D is unavailable. */
export function createFlipDots(
	canvas: HTMLCanvasElement,
	opts: FlipDotsOptions = {}
): FlipDotBoard | null {
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;

	let cols = Math.max(1, Math.floor(opts.cols ?? 28));
	let rows = Math.max(1, Math.floor(opts.rows ?? 14));
	let onColor = parseColor(opts.onColor ?? '#d5e138');
	let offColor = parseColor(opts.offColor ?? '#17181a');
	let board = parseColor(opts.board ?? '#101114');
	let gap = Math.max(0, Math.min(0.45, opts.gap ?? 0.14));
	let shape: FlipDotShape = opts.shape ?? 'disc';
	let shaded = opts.shaded ?? false;
	let flipMs = opts.flipMs ?? 70;
	let axis = opts.axis ?? 135;
	let stagger: FlipDotStagger = opts.stagger ?? 'scan';
	let scanMs = opts.scanMs ?? 150;
	let volume = opts.sound === true ? 0.5 : Math.max(0, Math.min(1, Number(opts.sound) || 0));
	let pixelRatio = opts.pixelRatio ?? 2;
	let label = opts.label ?? 'flip-dot display';
	let w = 0;
	let h = 0;
	let dpr = 1;

	const reduced =
		typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	// Per-dot state: the flip is progress 0 (off face) → 1 (on face); a pending flip
	// waits out its stagger `delay` first. `jit` is each dot's mechanical character —
	// solenoids are not identical — reused for timing, pitch and glint variance.
	let n = cols * rows;
	let target = new Uint8Array(n);
	let cur = new Float32Array(n);
	let delay = new Float32Array(n);
	let jit = new Float32Array(n);
	const seedJit = () => {
		for (let i = 0; i < n; i++) jit[i] = Math.random();
	};
	seedJit();

	let raf = 0;
	let lastT = 0;
	let snd: MechSound | null = null;
	const sound = (): MechSound | null => {
		if (volume > 0 && !snd) snd = createMechSound({ volume });
		return volume > 0 ? snd : null;
	};
	// Click budget: bursty sweeps rattle freely, but a continuously-flipping board
	// (a GIF, a plasma) settles to a sparse tick-over instead of a 240/s buzz —
	// kinder on the ear AND on the audio graph (every click is a few nodes).
	const CLICKS_PER_S = 70;
	let clickBudget = CLICKS_PER_S;

	// --- baked layers -----------------------------------------------------------
	// The board (sockets) and the two disc faces are pre-rendered once per resize /
	// appearance change; per-frame work is then pure drawImage — a 56×28 board
	// animates as blits, not as thousands of gradient fills.
	let cell = 0; // CSS px per grid cell
	let dot = 0; // disc diameter, CSS px
	let ox = 0; // board origin (grid centred in the canvas)
	let oy = 0;
	let micro = false; // too small for physics — flat rects, no sprites
	let boardLayer: HTMLCanvasElement | null = null;
	let onSprite: HTMLCanvasElement | null = null;
	let offSprite: HTMLCanvasElement | null = null;
	// The square style is ONE triangular flap folding across the diagonal hinge over
	// two fixed painted base halves. One sprite per face×half.
	let halfOn: [HTMLCanvasElement, HTMLCanvasElement] | null = null;
	let halfOff: [HTMLCanvasElement, HTMLCanvasElement] | null = null;
	// Dense boards trade the per-dot squash transform for a pre-squashed sprite
	// atlas: 32 foreshortening steps per moving face, so a mid-flip dot is ONE
	// plain drawImage instead of setTransform+draw+setTransform (3× fewer canvas
	// calls — the whole cost at 10k+ dots). Sparse boards keep the live transform:
	// few dots, big discs, where analog squash looks better and costs nothing.
	const ATLAS_STEPS = 32;
	const ATLAS_MIN_DOTS = 512;
	let atlasA: HTMLCanvasElement[] | null = null; // face shown while k > 0
	let atlasB: HTMLCanvasElement[] | null = null; // face shown while k < 0

	function bake() {
		cell = Math.min(w / cols, h / rows);
		dot = cell * (1 - gap);
		ox = (w - cell * cols) / 2;
		oy = (h - cell * rows) / 2;
		micro = cell * dpr < 4;
		if (micro) {
			boardLayer = onSprite = offSprite = null;
			halfOn = halfOff = null;
			atlasA = atlasB = null;
			return;
		}

		// Octagon path for the square style — the Brose/BUSE vane, a square with
		// clipped corners on a central axle.
		const octagon = (g: CanvasRenderingContext2D, cx: number, cy: number, half: number) => {
			const k = half * 0.42; // corner clip
			g.beginPath();
			g.moveTo(cx - half + k, cy - half);
			g.lineTo(cx + half - k, cy - half);
			g.lineTo(cx + half, cy - half + k);
			g.lineTo(cx + half, cy + half - k);
			g.lineTo(cx + half - k, cy + half);
			g.lineTo(cx - half + k, cy + half);
			g.lineTo(cx - half, cy + half - k);
			g.lineTo(cx - half, cy - half + k);
			g.closePath();
		};

		// `mirror` picks which mechanism details each face carries. DISC: mechanisms
		// vary by manufacturer, but all of them stop the disc against one of TWO
		// posts, and the posts sit at ±90° to the pivot axis (the disc swings
		// between them — it cannot rotate through its own stops). The rim hole
		// wraps the post the current face rests against; a 180° flip mirrors it
		// across the axis to the other post (the free post's head peeks past the
		// rim — see the board layer). SQUARE: the hole sits in the FIXED base under
		// the flap — hidden when blank, revealed when open — so `notch` is off for
		// the square's dark face.
		const face = (fill: RGB, sheen: number, mirror: 1 | -1, notch: boolean): HTMLCanvasElement => {
			const s = Math.max(2, Math.ceil(dot * dpr));
			const c = document.createElement('canvas');
			c.width = s;
			c.height = s;
			const g = c.getContext('2d')!;
			const r = s / 2;
			if (!shaded) {
				// Default: flat matte paint, the way the boards photograph.
				g.fillStyle = rgba(fill, 1);
			} else {
				// Painted face lit from above: a highlight toward the upper edge, the
				// base colour through the middle, a darker rim where it curves away.
				const grad = g.createRadialGradient(r, r * 0.75, r * 0.15, r, r, r);
				grad.addColorStop(0, rgba(mix(fill, WHITE, sheen), 1));
				grad.addColorStop(0.55, rgba(fill, 1));
				grad.addColorStop(1, rgba(mix(fill, BLACK, 0.32), 1));
				g.fillStyle = grad;
			}
			if (shape === 'square') octagon(g, r, r, r);
			else {
				g.beginPath();
				g.arc(r, r, r, 0, Math.PI * 2);
			}
			g.fill();
			if (shaded) {
				// The rim highlight: the edge catching the light.
				g.save();
				g.clip();
				g.strokeStyle = rgba(mix(fill, WHITE, 0.25), 0.35);
				g.lineWidth = Math.max(1, s * 0.03);
				g.beginPath();
				g.arc(r, r, r - g.lineWidth / 2, -Math.PI * 0.9, -Math.PI * 0.1);
				g.stroke();
				g.restore();
			}
			const rad = (axis * Math.PI) / 180;
			// Where a ray from the centre exits the shape — r for the disc, the
			// square/clip constraints for the octagon.
			const boundary = (dca: number, dsa: number): number => {
				if (shape !== 'square') return r;
				const a = Math.abs(dca);
				const b = Math.abs(dsa);
				return Math.min(r / Math.max(a, b), (2 * r - r * 0.42) / (a + b));
			};
			if (shape === 'square' && shaded) {
				// Central axle (the square vanes pivot through the middle): two small
				// axle dimples where the axis actually exits the octagon — along the
				// default diagonal that's the clipped corner, which is exactly the
				// room the corner clip makes for the axle.
				const d = boundary(Math.cos(rad), Math.sin(rad)) * 0.9;
				g.save();
				octagon(g, r, r, r);
				g.clip();
				g.fillStyle = 'rgba(0,0,0,0.4)';
				for (const dir of [1, -1]) {
					g.beginPath();
					g.arc(
						r + Math.cos(rad) * d * dir,
						r + Math.sin(rad) * d * dir,
						s * 0.055,
						0,
						Math.PI * 2
					);
					g.fill();
				}
				g.restore();
			}
			// The mechanism notch: a bite clearing the stop post, which stands at 90°
			// to the pivot axis/hinge. Disc: the hole is in the MOVING disc, so both
			// faces carry it (mirrored — the post pair straddles the axis and the
			// flip hands the hole from one post to the other). Square: the hole is in
			// the FIXED base half, so only the lit face carries it.
			if (notch) {
				// The hole wraps the stop post the face rests against — at ±90° to the
				// axis, mirrored across it per face (the square's base hole matches).
				const na = rad + (mirror * Math.PI) / 2;
				const nb = boundary(Math.cos(na), Math.sin(na));
				const nx = r + Math.cos(na) * nb * 0.98;
				const ny = r + Math.sin(na) * nb * 0.98;
				g.globalCompositeOperation = 'destination-out';
				g.beginPath();
				g.arc(nx, ny, r * 0.28, 0, Math.PI * 2);
				g.fill();
				g.globalCompositeOperation = 'source-over';
				if (shaded) {
					// The post the hole wraps, poking through the bite — matte dark
					// metal, barely catching light (the heads don't shine).
					g.fillStyle = '#3c3e43';
					g.beginPath();
					g.arc(nx, ny, r * 0.13, 0, Math.PI * 2);
					g.fill();
					g.fillStyle = 'rgba(255,255,255,0.12)';
					g.beginPath();
					g.arc(nx - r * 0.03, ny - r * 0.05, r * 0.05, 0, Math.PI * 2);
					g.fill();
				}
			}
			return c;
		};
		onSprite = face(onColor, 0.32, -1, true); // lit face: hole at lower-right…
		// …disc's dark face wraps the opposite pole; the square's dark state has NO
		// visible hole — the flap covers the base that carries it.
		offSprite = face(offColor, 0.1, 1, shape !== 'square');

		if (shape === 'square') {
			// Slice each face along the hinge into its two flap sprites.
			const rad = (axis * Math.PI) / 180;
			const ca = Math.cos(rad);
			const sa = Math.sin(rad);
			const slice = (full: HTMLCanvasElement, side: 1 | -1): HTMLCanvasElement => {
				const s = full.width;
				const c = document.createElement('canvas');
				c.width = s;
				c.height = s;
				const g = c.getContext('2d')!;
				const r = s / 2;
				const L = s * 2;
				// Half-plane clip on one side of the hinge line through the centre.
				g.beginPath();
				g.moveTo(r - ca * L, r - sa * L);
				g.lineTo(r + ca * L, r + sa * L);
				g.lineTo(r + ca * L - sa * L * side, r + sa * L + ca * L * side);
				g.lineTo(r - ca * L - sa * L * side, r - sa * L + ca * L * side);
				g.closePath();
				g.clip();
				g.drawImage(full, 0, 0);
				return c;
			};
			halfOn = [slice(onSprite, 1), slice(onSprite, -1)];
			halfOff = [slice(offSprite, 1), slice(offSprite, -1)];
		} else {
			halfOn = halfOff = null;
		}

		// The squash atlas (dense boards only — see the declaration above). The
		// moving faces are the disc's two faces, or the square's two flap faces.
		if (n >= ATLAS_MIN_DOTS) {
			const rad2 = (axis * Math.PI) / 180;
			const ca = Math.cos(rad2);
			const sa = Math.sin(rad2);
			const squashSet = (full: HTMLCanvasElement): HTMLCanvasElement[] => {
				const s = full.width;
				const r = s / 2;
				const out: HTMLCanvasElement[] = [];
				for (let q = 0; q < ATLAS_STEPS; q++) {
					const ak = q / (ATLAS_STEPS - 1);
					const c = document.createElement('canvas');
					c.width = s;
					c.height = s;
					const g = c.getContext('2d')!;
					const m00 = ca * ca + ak * sa * sa;
					const m11 = sa * sa + ak * ca * ca;
					const m01 = sa * ca * (1 - ak);
					// The squash about the sprite centre: p → M(p−r)+r.
					g.setTransform(m00, m01, m01, m11, r - m00 * r - m01 * r, r - m01 * r - m11 * r);
					g.drawImage(full, 0, 0);
					out.push(c);
				}
				return out;
			};
			atlasA = squashSet(shape === 'square' ? halfOff![1] : offSprite);
			atlasB = squashSet(shape === 'square' ? halfOn![0] : onSprite);
		} else {
			atlasA = atlasB = null;
		}

		// The board layer: only the shaded look needs one (recessed socket wells);
		// flat mode fills the background directly each frame — no full-canvas
		// texture to hold or blit.
		if (shaded) {
			const b = document.createElement('canvas');
			b.width = Math.max(1, Math.round(w * dpr));
			b.height = Math.max(1, Math.round(h * dpr));
			const g = b.getContext('2d')!;
			g.scale(dpr, dpr);
			g.fillStyle = rgba(board, 1);
			g.fillRect(0, 0, w, h);
			// The molded waffle: each socket is a square recess with pyramid facets —
			// in the corners between discs the board shows its geometry, diagonal
			// facets alternating light and shadow between cells.
			for (let y = 0; y < rows; y++)
				for (let x = 0; x < cols; x++) {
					const x0 = ox + x * cell;
					const y0 = oy + y * cell;
					const fx = x0 + cell / 2;
					const fy = y0 + cell / 2;
					const facet = (ax: number, ay: number, bx: number, by: number, style: string) => {
						g.fillStyle = style;
						g.beginPath();
						g.moveTo(ax, ay);
						g.lineTo(bx, by);
						g.lineTo(fx, fy);
						g.closePath();
						g.fill();
					};
					facet(x0, y0, x0 + cell, y0, 'rgba(0,0,0,0.36)'); // top wall in its own shadow
					facet(x0 + cell, y0, x0 + cell, y0 + cell, 'rgba(255,255,255,0.04)');
					facet(x0 + cell, y0 + cell, x0, y0 + cell, 'rgba(255,255,255,0.07)'); // catches the light
					facet(x0, y0 + cell, x0, y0, 'rgba(0,0,0,0.2)');
				}
			const rr = (dot / 2) * 1.08;
			const prad = (axis * Math.PI) / 180 + Math.PI / 2; // the stop-post line
			for (let y = 0; y < rows; y++)
				for (let x = 0; x < cols; x++) {
					const cx = ox + (x + 0.5) * cell;
					const cy = oy + (y + 0.5) * cell;
					const well = g.createRadialGradient(cx, cy, rr * 0.55, cx, cy, rr);
					well.addColorStop(0, 'rgba(0,0,0,0.5)');
					well.addColorStop(0.85, 'rgba(0,0,0,0.62)');
					well.addColorStop(1, 'rgba(0,0,0,0.15)');
					g.fillStyle = well;
					if (shape === 'square') octagon(g, cx, cy, rr);
					else {
						g.beginPath();
						g.arc(cx, cy, rr, 0, Math.PI * 2);
					}
					g.fill();
					if (shape !== 'square') {
						// The stop posts, at ±90° to the pivot axis — the disc rests
						// against one; the one the hole isn't wrapping peeks past the
						// rim. Dark heads — they don't shine.
						g.fillStyle = '#37393d';
						for (const dir of [1, -1]) {
							g.beginPath();
							g.arc(
								cx + Math.cos(prad) * (dot / 2) * 1.02 * dir,
								cy + Math.sin(prad) * (dot / 2) * 1.02 * dir,
								dot * 0.075,
								0,
								Math.PI * 2
							);
							g.fill();
						}
					}
				}
			boardLayer = b;
		} else {
			boardLayer = null;
		}
	}

	function draw() {
		if (!w || !h) return;
		const g = ctx!;
		g.setTransform(1, 0, 0, 1, 0, 0);
		if (micro) {
			// Degenerate size: flat pixels, still a correct picture.
			g.scale(dpr, dpr);
			g.fillStyle = rgba(board, 1);
			g.fillRect(0, 0, w, h);
			g.fillStyle = rgba(onColor, 1);
			for (let i = 0; i < n; i++) {
				if (cur[i] < 0.5) continue;
				const x = i % cols;
				const y = (i / cols) | 0;
				g.fillRect(ox + x * cell, oy + y * cell, Math.max(1, cell * 0.9), Math.max(1, cell * 0.9));
			}
			return;
		}
		if (boardLayer) {
			g.drawImage(boardLayer, 0, 0);
			g.scale(dpr, dpr);
		} else {
			// Flat board: a fill beats blitting a full-canvas texture.
			g.scale(dpr, dpr);
			g.fillStyle = rgba(board, 1);
			g.fillRect(0, 0, w, h);
		}
		// The rotation axis: the real discs pivot on pins at diagonal corners, so the
		// foreshortening runs along ~45°, not vertically — that's the twinkle. The
		// squash matrix is R(axis)·S(1,k)·R(-axis), symmetric, so four numbers per dot.
		const rad = (axis * Math.PI) / 180;
		const ca = Math.cos(rad);
		const sa = Math.sin(rad);
		// The edge-on sliver spans the shape along the axis — a square's diagonal
		// is longer than a disc's diameter.
		const gr = shape === 'square' ? dot * 0.62 : dot / 2;
		for (let i = 0; i < n; i++) {
			const p = cur[i];
			// k = cos maps flip progress to the signed foreshortening perpendicular to
			// the axis — +1 off face flat, 0 edge-on, -1 on face flat.
			const k = Math.cos(p * Math.PI);
			const ak = Math.abs(k);
			const sprite = k > 0 ? offSprite! : onSprite!;
			const x = i % cols;
			const y = (i / cols) | 0;
			const cx = ox + (x + 0.5) * cell;
			const cy = oy + (y + 0.5) * cell;
			if (ak > 0.98) {
				// Settled (or nearly): a plain blit, no per-dot transform.
				g.drawImage(sprite, cx - dot / 2, cy - dot / 2, dot, dot);
				continue;
			}
			if (shape === 'square') {
				// The square cell is ONE triangular flap folding 180° across the hinge
				// onto the other half. Both base halves are fixed paint: the notch side
				// bright (with the pole hole), the other side dark. The flap covers one
				// of them — blank hides the hole, open reveals it. Mid-fold the cell
				// shows the diagonal-triangle state the real bus signs are full of.
				g.drawImage(halfOff![0], cx - dot / 2, cy - dot / 2, dot, dot); // dark base
				g.drawImage(halfOn![1], cx - dot / 2, cy - dot / 2, dot, dot); // bright base + hole
				// k > 0: flap flat over the bright base, dark face up (blank);
				// k < 0: flap folded onto the dark base, bright face up (open).
				if (ak > 0.02) {
					if (atlasA) {
						const q = Math.round(ak * (ATLAS_STEPS - 1));
						g.drawImage((k > 0 ? atlasA : atlasB)![q], cx - dot / 2, cy - dot / 2, dot, dot);
					} else {
						const sp = k > 0 ? halfOff![1] : halfOn![0];
						const m00 = ca * ca + ak * sa * sa;
						const m11 = sa * sa + ak * ca * ca;
						const m01 = sa * ca * (1 - ak);
						g.setTransform(dpr * m00, dpr * m01, dpr * m01, dpr * m11, dpr * cx, dpr * cy);
						g.drawImage(sp, -dot / 2, -dot / 2, dot, dot);
						g.setTransform(dpr, 0, 0, dpr, 0, 0);
					}
				}
				if (ak < 0.35 && shaded) glint(g, cx, cy, ca, sa, gr, ak, jit[i]);
				continue;
			}
			if (ak > 0.02) {
				if (atlasA) {
					const q = Math.round(ak * (ATLAS_STEPS - 1));
					g.drawImage((k > 0 ? atlasA : atlasB)![q], cx - dot / 2, cy - dot / 2, dot, dot);
				} else {
					const m00 = ca * ca + ak * sa * sa;
					const m11 = sa * sa + ak * ca * ca;
					const m01 = sa * ca * (1 - ak);
					g.setTransform(dpr * m00, dpr * m01, dpr * m01, dpr * m11, dpr * cx, dpr * cy);
					g.drawImage(sprite, -dot / 2, -dot / 2, dot, dot);
					g.setTransform(dpr, 0, 0, dpr, 0, 0);
				}
			}
			if (ak < 0.35 && shaded) glint(g, cx, cy, ca, sa, gr, ak, jit[i]);
		}
	}

	// Edge-on: the flap is a sliver along the hinge — the bare metal edge catching
	// the light.
	function glint(
		g: CanvasRenderingContext2D,
		cx: number,
		cy: number,
		ca: number,
		sa: number,
		gr: number,
		ak: number,
		j: number
	) {
		const a = (1 - ak / 0.35) * (0.35 + 0.3 * j);
		g.strokeStyle = `rgba(255,252,235,${a})`;
		g.lineWidth = Math.max(0.75, dot * 0.07);
		g.beginPath();
		g.moveTo(cx - ca * gr, cy - sa * gr);
		g.lineTo(cx + ca * gr, cy + sa * gr);
		g.stroke();
	}

	// --- animation ---------------------------------------------------------------
	// rAF runs only while a dot is waiting or mid-flip; a settled board costs nothing.
	function animate() {
		if (reduced || flipMs <= 0) {
			for (let i = 0; i < n; i++) {
				cur[i] = target[i];
				delay[i] = 0;
			}
			draw();
			return;
		}
		if (raf) return;
		lastT = performance.now();
		const step = () => {
			raf = 0;
			const now = performance.now();
			const dt = Math.min(0.1, (now - lastT) / 1000);
			lastT = now;
			clickBudget = Math.min(CLICKS_PER_S, clickBudget + dt * CLICKS_PER_S);
			const dur = flipMs / 1000;
			let moving = false;
			let starts = 0;
			let startSum = 0; // for the average pan of this frame's clicks
			for (let i = 0; i < n; i++) {
				if (delay[i] > 0) {
					delay[i] -= dt;
					if (delay[i] > 0) {
						// Waiting for the sweep — but a disc caught mid-flip completes its
						// PREVIOUS flip first (nothing hangs edge-on waiting for a command).
						const back = 1 - target[i];
						if (cur[i] !== back) {
							const rate = dt / (dur * (0.85 + 0.3 * jit[i]));
							cur[i] =
								back > cur[i] ? Math.min(back, cur[i] + rate) : Math.max(back, cur[i] - rate);
						}
						moving = true;
						continue;
					}
					delay[i] = 0;
					starts++;
					startSum += i % cols;
				}
				const t = target[i];
				if (cur[i] === t) continue;
				// Slightly quicker off the mark than on arrival — a solenoid, not a tween.
				const rate = dt / (dur * (0.85 + 0.3 * jit[i]));
				cur[i] = t > cur[i] ? Math.min(t, cur[i] + rate) : Math.max(t, cur[i] - rate);
				if (cur[i] !== t) moving = true;
			}
			if (starts > 0) clicks(starts, startSum / starts);
			draw();
			if (moving) raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
	}

	// The rattle: each frame's flip *starts* become at most a few clicks — dense
	// sweeps read as texture, not as N oscillators. Gain falls as density rises
	// (many quiet clicks ≈ one loud board), pan follows the flipping column.
	function clicks(starts: number, meanCol: number) {
		const s = sound();
		if (!s) return;
		const count = Math.min(starts, 3, Math.floor(clickBudget));
		if (count <= 0) return;
		clickBudget -= count;
		// Recipe matched to the measured character of a real board: a narrow ring
		// somewhere in 6.5–10.5 kHz (each solenoid its own), a strike down to 20%
		// in ~2.4 ms with an ~18 ms tail, and a WIDE click-to-click level spread
		// (p10 ≈ 0.14, p90 ≈ 0.80 of max).
		const g = Math.min(1, 1.6 / starts) * 0.7 + 0.3;
		for (let i = 0; i < count; i++) {
			const j = Math.random();
			s.tick({
				delay: j * 0.012,
				freq: 6300 + j * 4200,
				decay: 0.004 + j * 0.012,
				noise: 0.9,
				noiseHz: 5200,
				gain: g * (0.25 + 0.75 * j * j),
				pan: cols > 1 ? (meanCol / (cols - 1)) * 1.4 - 0.7 : 0
			});
		}
	}

	// Stagger assignment for dots whose target actually changed.
	function delayFor(x: number, y: number): number {
		if (stagger === 'none' || reduced || flipMs <= 0) return 0;
		if (stagger === 'random') return (Math.random() * scanMs) / 1000;
		// 'scan': the row driver sweep, with per-dot solenoid variance.
		return ((y / Math.max(1, rows - 1)) * scanMs + jit[y * cols + x] * 14) / 1000;
	}

	function apply(idx: number, x: number, y: number, on: boolean) {
		const t = on ? 1 : 0;
		if (target[idx] === t) return false;
		target[idx] = t;
		delay[idx] = delayFor(x, y);
		return true;
	}

	function resize() {
		const cap = pixelRatio > 0 ? pixelRatio : 1;
		dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, cap);
		const r = canvas.getBoundingClientRect();
		w = Math.max(1, r.width || canvas.clientWidth || 1);
		h = Math.max(1, r.height || canvas.clientHeight || 1);
		canvas.width = Math.max(1, Math.round(w * dpr));
		canvas.height = Math.max(1, Math.round(h * dpr));
		bake();
		draw();
	}

	function applyAria() {
		canvas.setAttribute('role', 'img');
		if (label) {
			canvas.setAttribute('aria-label', label);
			canvas.removeAttribute('aria-hidden');
		} else {
			canvas.setAttribute('aria-hidden', 'true');
			canvas.removeAttribute('aria-label');
		}
	}
	applyAria();

	const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
	ro?.observe(canvas);
	resize();

	return {
		get cols() {
			return cols;
		},
		get rows() {
			return rows;
		},
		set(x, y, on) {
			x = Math.floor(x);
			y = Math.floor(y);
			if (x < 0 || x >= cols || y < 0 || y >= rows) return;
			if (apply(y * cols + x, x, y, on)) animate();
		},
		get(x, y) {
			x = Math.floor(x);
			y = Math.floor(y);
			if (x < 0 || x >= cols || y < 0 || y >= rows) return false;
			return target[y * cols + x] === 1;
		},
		setFrame(frame) {
			const at =
				typeof frame === 'function'
					? (x: number, y: number) => !!frame(x, y)
					: (x: number, y: number) => !!frame[y * cols + x];
			let changed = false;
			for (let y = 0; y < rows; y++)
				for (let x = 0; x < cols; x++) changed = apply(y * cols + x, x, y, at(x, y)) || changed;
			if (changed) animate();
		},
		clear() {
			this.setFrame(() => false);
		},
		fill() {
			this.setFrame(() => true);
		},
		setOptions(patch) {
			let rebake = false;
			let regrid = false;
			if (patch.cols != null && Math.floor(patch.cols) !== cols) {
				cols = Math.max(1, Math.floor(patch.cols));
				regrid = true;
			}
			if (patch.rows != null && Math.floor(patch.rows) !== rows) {
				rows = Math.max(1, Math.floor(patch.rows));
				regrid = true;
			}
			if (regrid) {
				// New geometry: preserve nothing (a re-tiled board powers up dark).
				n = cols * rows;
				target = new Uint8Array(n);
				cur = new Float32Array(n);
				delay = new Float32Array(n);
				jit = new Float32Array(n);
				seedJit();
				rebake = true;
			}
			if (patch.onColor != null) {
				onColor = parseColor(patch.onColor);
				rebake = true;
			}
			if (patch.offColor != null) {
				offColor = parseColor(patch.offColor);
				rebake = true;
			}
			if (patch.board != null) {
				board = parseColor(patch.board);
				rebake = true;
			}
			if (patch.gap != null) {
				gap = Math.max(0, Math.min(0.45, patch.gap));
				rebake = true;
			}
			if (patch.shape != null) {
				shape = patch.shape;
				rebake = true;
			}
			if (patch.shaded != null) {
				shaded = patch.shaded;
				rebake = true;
			}
			if (patch.flipMs != null) flipMs = patch.flipMs;
			if (patch.axis != null) {
				axis = patch.axis;
				rebake = true; // the notch is baked into the face sprites
			}
			if (patch.stagger != null) stagger = patch.stagger;
			if (patch.scanMs != null) scanMs = patch.scanMs;
			if (patch.sound !== undefined) {
				volume = patch.sound === true ? 0.5 : Math.max(0, Math.min(1, Number(patch.sound) || 0));
				snd?.setVolume(volume);
			}
			if (patch.label !== undefined) {
				label = patch.label;
				applyAria();
			}
			if (patch.pixelRatio != null) {
				pixelRatio = patch.pixelRatio;
				resize();
				rebake = false; // resize() baked already
			}
			if (rebake) {
				bake();
				draw();
			}
			animate();
		},
		resize,
		snapshot() {
			draw();
			return canvas.toDataURL('image/png');
		},
		dispose() {
			ro?.disconnect();
			if (raf) cancelAnimationFrame(raf);
			snd?.dispose();
			// Hand the consumer's canvas back without our ARIA (it may be reused).
			canvas.removeAttribute('role');
			canvas.removeAttribute('aria-label');
			canvas.removeAttribute('aria-hidden');
		}
	};
}
