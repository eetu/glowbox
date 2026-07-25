// Example driver: Sphere — the grid's largest inscribed sphere as an LED ball (à la
// the Las Vegas one), playing looping "shows" on its surface: the iconic wandering,
// blinking eye; a plasma swirl; a smiley. Patterns are functions of (lat, lon, t) over
// precomputed shell cells, crossfaded between shows, so the whole thing is one cheap
// per-cell colour lookup per frame.
import type { LedDisplay } from '@glowbox/led-grid';

interface Cell {
	x: number;
	y: number;
	z: number;
	lat: number; // -π/2 (south) .. +π/2 (north)
	lon: number; // -π .. π, 0 facing the default camera (+z)
}

type Pattern = (lat: number, lon: number, t: number) => [number, number, number];

// Great-circle angular distance between two (lat, lon) points.
const angDist = (lat1: number, lon1: number, lat2: number, lon2: number) =>
	Math.acos(
		Math.min(
			1,
			Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos(lon1 - lon2)
		)
	);

// The eye: a sclera/iris/pupil disc tracking a look direction — the cursor when the
// viewer has one (getLook), a slow wander otherwise — with a periodic eyelid blink.
const makeEye = (getLook: () => [number, number] | null): Pattern => {
	// Smoothed look state so cursor jumps ease instead of snapping.
	let lookLon = 0;
	let lookLat = 0;
	let lastT = -1;
	return (lat, lon, t) => {
		if (t !== lastT) {
			lastT = t;
			const p = getLook();
			// Cursor → look angles (x → longitude, y → latitude; screen y is down).
			const targetLon = p ? p[0] * 0.9 : 0.7 * Math.sin(t * 0.6) + 0.25 * Math.sin(t * 1.7);
			const targetLat = p ? -p[1] * 0.55 : 0.3 * Math.sin(t * 0.43);
			lookLon += (targetLon - lookLon) * 0.12;
			lookLat += (targetLat - lookLat) * 0.12;
		}
		// Only the front cap is lit — the LEDs are see-through and additive, so a fully
		// wrapped eyeball would show the back shell through the front. Shutting down
		// the far side keeps the eye crisp (and is what the real Sphere does with
		// content that only faces one way). Soft fade at the terminator.
		const face = angDist(lat, lon, 0, 0);
		if (face > 1.5) return [0, 0, 0];
		const k = Math.min(1, (1.5 - face) / 0.35);

		// Blink ~ every 4 s: a fast close-open envelope.
		const bt = (t % 4.2) / 4.2;
		const blink = bt > 0.92 ? Math.sin(((bt - 0.92) / 0.08) * Math.PI) : 0;
		if (Math.abs(lat) > (1 - blink) * 1.2) return [0.5 * k, 0.42 * k, 0.38 * k]; // eyelid
		const a = angDist(lat, lon, lookLat, lookLon);
		if (a < 0.22) return [0.02, 0.02, 0.03]; // pupil
		if (a < 0.5) {
			// Iris: radial streaks around the pupil.
			const streak = 0.75 + 0.25 * Math.sin(Math.atan2(lat - lookLat, lon - lookLon) * 14);
			return [0.1 * streak, 0.55 * streak, 0.8 * streak];
		}
		if (a < 0.56) return [0.05, 0.08, 0.12]; // limbal ring
		return [0.85 * k, 0.82 * k, 0.75 * k]; // sclera, dimming to off at the edge
	};
};

// A slow additive plasma in sphere coordinates — the ambient between-shows look.
const plasma: Pattern = (lat, lon, t) => {
	const v =
		Math.sin(lon * 3 + t * 0.8) + Math.sin(lat * 4 - t * 0.6) + Math.sin((lon + lat) * 2 + t * 1.3);
	const h = (v / 6 + 0.5 + t * 0.02) % 1;
	// Cheap hue wheel (three phased cosines).
	const c = (o: number) => 0.5 + 0.5 * Math.cos((h + o) * Math.PI * 2);
	return [c(0) * 1.2, c(1 / 3) * 1.2, c(2 / 3) * 1.2];
};

// The yellow dude — cartoon eyes (white ovals, glancing irises, dark pupils) over a
// big open smile with a mouth interior + tongue, à la the real Sphere's emoji.
// The yellow dude, after the real Sphere's emoji: a plain yellow ball with small,
// low-key features — close-set round white eyes with big black pupils, bold dark
// eyebrows (one raised, skeptically), and a tiny contented smile. No big grin.
const smiley: Pattern = (lat, lon, t) => {
	// Same front-cap treatment as the eye — the see-through back would muddy the face.
	const face = angDist(lat, lon, 0, 0);
	if (face > 1.5) return [0, 0, 0];
	const k = Math.min(1, (1.5 - face) / 0.35);
	const dark: [number, number, number] = [0.03, 0.03, 0.04];

	// Eyes: close together, just above centre; pupils fill most of the white and
	// glance around together (subtle).
	const glLon = 0.04 * Math.sin(t * 0.9);
	const glLat = 0.02 * Math.sin(t * 0.57);
	for (const side of [-1, 1]) {
		const white = angDist(lat, lon, 0.02, side * 0.24);
		if (white < 0.135) {
			const pupil = angDist(lat, lon, 0.02 + glLat, side * 0.24 + glLon);
			return pupil < 0.085 ? dark : [0.95, 0.93, 0.88];
		}
	}

	// Eyebrows: thick dark bars above the eyes. The right one sits higher and tilts
	// up outward — the skeptical look.
	for (const side of [-1, 1]) {
		const x = side * lon; // 0.. outward along this brow
		if (x > 0.1 && x < 0.42) {
			const raise = side === 1 ? 0.06 + 0.12 * (x - 0.1) : 0.02 * (x - 0.1);
			if (Math.abs(lat - (0.24 + raise)) < 0.03) return dark;
		}
	}

	// The mouth: a small smile — corners clearly turned up.
	if (Math.abs(lon) < 0.16 && Math.abs(lat - (-0.3 + 2.2 * lon * lon)) < 0.04) return dark;

	return [1.1 * k, 0.75 * k, 0.05 * k]; // classic yellow, off past the terminator
};

// The 8-ball: a near-dark glossy ball (off LEDs read as black), a white number disc
// facing front with the "8" as two stacked rings, and a soft specular high-light.
const eightBall: Pattern = (lat, lon) => {
	// Full sphere — the dim body is cheap light, so no front-cap shutdown here; only
	// the number disc is directional.
	const face = angDist(lat, lon, 0, 0);
	if (face < 0.52) {
		// The number disc: white, with the 8 as two ring bands (top smaller).
		const top = Math.abs(angDist(lat, lon, 0.14, 0) - 0.1);
		const bottom = Math.abs(angDist(lat, lon, -0.13, 0) - 0.13);
		if (top < 0.045 || bottom < 0.045) return [0.02, 0.02, 0.03];
		return [0.92, 0.9, 0.85];
	}
	if (face < 0.58) return [0.02, 0.02, 0.03]; // disc rim seats it on the black
	// "Black" on an additive LED ball is just off — invisible. So the body is a dim
	// charcoal lifted by a broad specular bloom and a cool rim light on the
	// silhouette: a black ball catching the room light, not a hole in the display.
	const gloss = Math.max(0, 1 - angDist(lat, lon, 0.55, -0.6) / 0.6);
	const g = 0.09 + gloss * gloss * 0.55;
	return [g, g, g * 1.3];
};

// The globe: a slowly turning glowing Earth. Land is a hand-authored coarse
// equirectangular ASCII map ('#' = land, '*' = ice) — same trick as the bitmap font;
// at LED resolution the shapes matter, not the fidelity. 64 cols × 30 rows.
const WORLD = `
................................................................
............#########...........................#####..#.......
........#..####.#####........####........#############.#.......
...####..######..####............###....###############........
..#################..###.........###..#########################
..#################...##.....#..###...##########################
.#################.....#.....##.####..#########################.
.....############............###########################.##..#.
.....###########.............###########..######..#######..##..
.....#########..............####..#####...#####..######.....#..
....#########..............##########.#####..#..######......#..
.....#..####...............###########.####..####.####.........
......#..##................###########..###...#######..#.......
.......####................############...#..##.#####.##.......
.........####.#............###########.......###..#######......
.........#######.............#########.......##...#..######....
..........######..............#######...........#....######.#..
..........######..............######...........####..######....
..........#####...............#####..#.........###########.....
..........#####................####..#.........###########.....
..........####.................####............###########.....
..........###..................###..............####..###......
..........###.........................................#..##....
..........##....................................................
..........##...................................................
...........#...................................................
................................................................
......................*****..........**********................
............*******************************************........
................................................................`;
const WORLD_ROWS = WORLD.trim().split('\n');
const WORLD_H = WORLD_ROWS.length;
const WORLD_W = 64;

const globe: Pattern = (lat, lon, t) => {
	// Slow eastward spin; wrap the sampling longitude.
	const L = (((lon + t * 0.12 + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
	const col = Math.min(WORLD_W - 1, Math.floor((L / (Math.PI * 2)) * WORLD_W));
	const row = Math.min(WORLD_H - 1, Math.floor(((Math.PI / 2 - lat) / Math.PI) * WORLD_H));
	const ch = WORLD_ROWS[row]?.[col] ?? '.';
	if (ch === '*') return [0.5, 0.55, 0.6]; // ice
	if (ch === '#') {
		// Land: green into tan, varied by a cheap position hash so continents aren't flat.
		const h = 0.5 + 0.5 * Math.sin(col * 12.9898 + row * 78.233);
		return [0.14 + h * 0.2, 0.42 + h * 0.12, 0.1];
	}
	// Ocean: deep blue, faintly banded by latitude so the water isn't a void.
	const band = 0.02 * Math.sin(lat * 8);
	return [0.02, 0.09 + band, 0.3];
};

/** The selectable shows (also the `auto` rotation order). */
export const SPHERE_SHOWS = ['eye', 'plasma', 'smiley', '8-ball', 'globe'] as const;
export type SphereShow = (typeof SPHERE_SHOWS)[number] | 'auto';

const SHOW_S = 9; // seconds per show
const FADE_S = 1.2;

/** `getPointer` (optional): the cursor in -1..1 stage coordinates, or null before the
 *  first move — the eye show follows it (and wanders while unattended).
 *  `getShow` (optional): pin one show, or `'auto'` (default) for the timed rotation. */
export function makeSphere(
	getPointer: () => [number, number] | null = () => null,
	getShow: () => SphereShow = () => 'auto'
): (d: LedDisplay, dt: number) => void {
	const BY_NAME: Record<(typeof SPHERE_SHOWS)[number], Pattern> = {
		eye: makeEye(getPointer),
		plasma,
		smiley,
		'8-ball': eightBall,
		globe
	};
	const SHOWS: Pattern[] = SPHERE_SHOWS.map((s) => BY_NAME[s]);
	let cells: Cell[] = [];
	let sized = '';
	let t = 0;

	const build = (nx: number, ny: number, nz: number) => {
		cells = [];
		const cx = (nx - 1) / 2;
		const cy = (ny - 1) / 2;
		const cz = (nz - 1) / 2;
		const R = Math.min(nx, ny, nz) / 2 - 0.5;
		for (let x = 0; x < nx; x++)
			for (let y = 0; y < ny; y++)
				for (let z = 0; z < nz; z++) {
					const dx = x - cx;
					const dy = y - cy;
					const dz = z - cz;
					const r = Math.hypot(dx, dy, dz);
					if (Math.abs(r - R) > 0.55) continue; // ~1-voxel shell
					cells.push({
						x,
						y,
						z,
						lat: Math.asin(dy / (r || 1)),
						lon: Math.atan2(dx, dz) // 0 = +z, toward the default camera
					});
				}
	};

	return (d, dt) => {
		const { nx, ny, nz } = d;
		const key = `${nx}:${ny}:${nz}`;
		if (key !== sized) {
			build(nx, ny, nz);
			sized = key;
		}
		t += dt;
		d.clear();

		// Which show, and how far into the crossfade window at its end. A pinned show
		// (anything but 'auto') renders directly, no rotation.
		const pinned = getShow();
		const slot = t / SHOW_S;
		const i = Math.floor(slot) % SHOWS.length;
		const current = pinned === 'auto' ? SHOWS[i] : BY_NAME[pinned];
		const next = SHOWS[(i + 1) % SHOWS.length];
		const into = (slot % 1) * SHOW_S;
		const mix =
			pinned === 'auto' && into > SHOW_S - FADE_S ? (into - (SHOW_S - FADE_S)) / FADE_S : 0;

		for (const c of cells) {
			const a = current(c.lat, c.lon, t);
			if (mix === 0) {
				d.plot(c.x, c.y, c.z, a);
				continue;
			}
			const b = next(c.lat, c.lon, t);
			d.plot(c.x, c.y, c.z, [
				a[0] + (b[0] - a[0]) * mix,
				a[1] + (b[1] - a[1]) * mix,
				a[2] + (b[2] - a[2]) * mix
			]);
		}
	};
}
