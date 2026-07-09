// Demo driver for the "cube" viz: a self-playing 3D Pac-Man on the @scene/led-grid
// display, now with a real maze so the ghost personalities actually matter (in an
// open grid they collapse to straight-line chase). Movement is one node at a time
// along corridors; walls block movement. It's an attract loop (no input), so
// Pac-Man is AI-driven too.
//
// Maze: a perfect (spanning-tree) 3D maze — cells on even coords, passages carved
// between them by randomized DFS — so every open node is reachable, with corridors
// + junctions. Pac-Man navigates by BFS to the nearest pill (fleeing danger);
// ghosts use the *arcade* rule — at each node pick the open neighbour (no
// reversing) nearest their target by straight-line distance — which is what makes
// Pinky's ambush and Inky's flanking emerge:
//   Blinky (red)    — targets Pac-Man; speeds up (Cruise Elroy) as pills vanish.
//   Pinky  (pink)   — targets 4 nodes ahead of Pac-Man (ambush).
//   Inky   (cyan)   — targets Blinky reflected through the point 2 ahead of Pac.
//   Clyde  (orange) — chases when far, retreats to his corner within 8 nodes.
// Scatter⇄chase alternate; a power pill → frightened ghosts (blue, edible, 6s).
import type { LedDisplay, Vec3 } from '$lib/led-grid';

const DIRS: Vec3[] = [
	[0, 1, 0],
	[0, -1, 0],
	[-1, 0, 0],
	[1, 0, 0],
	[0, 0, -1],
	[0, 0, 1]
];
const dist2 = (a: Vec3, b: Vec3) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const isRev = (a: Vec3, b: Vec3) => a[0] === -b[0] && a[1] === -b[1] && a[2] === -b[2];
const eq = (a: Vec3, b: Vec3) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

type GhostKind = 'blinky' | 'pinky' | 'inky' | 'clyde';
type GhostMode = 'chase' | 'scatter' | 'frightened' | 'eyes';
type Ghost = { p: Vec3; dir: Vec3; kind: GhostKind; mode: GhostMode; corner: Vec3; color: Vec3 };

const GHOST_COLORS: Record<GhostKind, Vec3> = {
	blinky: [1, 0.12, 0.12],
	pinky: [1, 0.5, 0.8],
	inky: [0.2, 0.9, 1],
	clyde: [1, 0.6, 0.12]
};

export function makePacman(n = 9) {
	const STEP = 0.3;
	const FRIGHT = 6.0;
	const SCATTER = 5.0;
	const CHASE = 16.0;
	const total = n * n * n;
	const cornersRaw: Vec3[] = [
		[0, n - 1, 0],
		[n - 1, n - 1, n - 1],
		[n - 1, n - 1, 0],
		[0, n - 1, n - 1]
	];

	const wall = new Uint8Array(total); // 1 wall, 0 open corridor
	const pills = new Uint8Array(total); // 0 eaten, 1 pill, 2 power pill
	const trail = new Float32Array(total * 3); // decaying entity afterglow
	const homeDist = new Int16Array(total); // BFS distance to home (eyes path back)
	let pillsLeft = 0;
	let pac: { p: Vec3; dir: Vec3 } = { p: [0, 0, 0], dir: [1, 0, 0] };
	let ghosts: Ghost[] = [];
	let home: Vec3 = [0, 0, 0];
	let lives = 3;
	let modeClock = 0;
	let frightT = 0;
	let clock = 0;
	let acc = 0;
	let deathPause = 0;
	let blinkyAccum = 0; // Cruise-Elroy extra-step accumulator

	const ni = (x: number, y: number, z: number) => x + n * (y + n * z);
	const vi = (p: Vec3) => ni(p[0], p[1], p[2]);
	const inB = (p: Vec3) => p[0] >= 0 && p[0] < n && p[1] >= 0 && p[1] < n && p[2] >= 0 && p[2] < n;
	const isOpen = (p: Vec3) => inB(p) && wall[vi(p)] === 0;

	// --- maze: randomized-DFS spanning tree over even-coord cells ---
	function carveMaze() {
		wall.fill(1);
		const cpa = Math.floor((n + 1) / 2); // cells per axis (coords 0,2,4,…)
		const ckey = (a: number, b: number, c: number) => a + cpa * (b + cpa * c);
		const seen = new Uint8Array(cpa * cpa * cpa);
		const stack: Vec3[] = [[0, 0, 0]];
		seen[ckey(0, 0, 0)] = 1;
		wall[ni(0, 0, 0)] = 0;
		while (stack.length) {
			const [cx, cy, cz] = stack[stack.length - 1];
			const cand: { c: Vec3; d: Vec3 }[] = [];
			for (const d of DIRS) {
				const nc: Vec3 = [cx + d[0], cy + d[1], cz + d[2]];
				if (nc[0] < 0 || nc[0] >= cpa || nc[1] < 0 || nc[1] >= cpa || nc[2] < 0 || nc[2] >= cpa)
					continue;
				if (!seen[ckey(nc[0], nc[1], nc[2])]) cand.push({ c: nc, d });
			}
			if (!cand.length) {
				stack.pop();
				continue;
			}
			const { c: nc, d } = cand[(Math.random() * cand.length) | 0];
			seen[ckey(nc[0], nc[1], nc[2])] = 1;
			// carve the wall node between the two cells, and the neighbour cell
			wall[ni(cx * 2 + d[0], cy * 2 + d[1], cz * 2 + d[2])] = 0;
			wall[ni(nc[0] * 2, nc[1] * 2, nc[2] * 2)] = 0;
			stack.push(nc);
		}
	}

	function nearestOpen(target: Vec3): Vec3 {
		let best: Vec3 = [0, 0, 0];
		let bd = Infinity;
		for (let z = 0; z < n; z++)
			for (let y = 0; y < n; y++)
				for (let x = 0; x < n; x++) {
					if (wall[ni(x, y, z)]) continue;
					const d = dist2(target, [x, y, z]);
					if (d < bd) {
						bd = d;
						best = [x, y, z];
					}
				}
		return best;
	}

	function newLevel() {
		carveMaze();
		pills.fill(0);
		let open = 0;
		for (let i = 0; i < total; i++)
			if (wall[i] === 0) {
				pills[i] = 1;
				open++;
			}
		pillsLeft = open;
		// power pills: the open node nearest each of 4 spread corners
		const powers: Vec3[] = [
			[0, 0, 0],
			[n - 1, 0, n - 1],
			[0, n - 1, n - 1],
			[n - 1, n - 1, 0]
		];
		for (const c of powers) {
			const o = nearestOpen(c);
			if (pills[vi(o)] === 1) pills[vi(o)] = 2;
		}
	}

	// BFS distances from `home` over open nodes, so eaten "eyes" can descend the
	// field straight back to the pen (the straight-line heuristic can dead-end).
	function computeHomeDist() {
		homeDist.fill(-1);
		const q = new Int32Array(total);
		const start = vi(home);
		homeDist[start] = 0;
		q[0] = start;
		let head = 0;
		let tail = 1;
		while (head < tail) {
			const ci = q[head++];
			const cx = ci % n;
			const cy = ((ci / n) | 0) % n;
			const cz = (ci / (n * n)) | 0;
			for (let di = 0; di < 6; di++) {
				const d = DIRS[di];
				const nx = cx + d[0],
					ny = cy + d[1],
					nz = cz + d[2];
				if (nx < 0 || nx >= n || ny < 0 || ny >= n || nz < 0 || nz >= n) continue;
				const nf = ni(nx, ny, nz);
				if (wall[nf] !== 0 || homeDist[nf] >= 0) continue;
				homeDist[nf] = homeDist[ci] + 1;
				q[tail++] = nf;
			}
		}
	}

	function spawn() {
		const mid = (n - 1) / 2;
		home = nearestOpen([mid, mid, mid]);
		computeHomeDist();
		pac = { p: nearestOpen([n - 1, 0, n - 1]), dir: [-1, 0, 0] };
		if (pills[vi(pac.p)]) {
			pills[vi(pac.p)] = 0;
			pillsLeft--;
		}
		const kinds: GhostKind[] = ['blinky', 'pinky', 'inky', 'clyde'];
		ghosts = kinds.map((kind, i) => ({
			p: [...home] as Vec3,
			dir: [0, 1, 0] as Vec3,
			kind,
			mode: 'scatter' as GhostMode,
			corner: nearestOpen(cornersRaw[i]),
			color: GHOST_COLORS[kind]
		}));
		modeClock = 0;
		frightT = 0;
		blinkyAccum = 0;
		trail.fill(0);
	}

	function reset(full: boolean) {
		if (full) {
			lives = 3;
			newLevel();
		}
		spawn();
		deathPause = 0.6;
	}
	reset(true);

	const globalMode = (): GhostMode =>
		modeClock % (SCATTER + CHASE) < SCATTER ? 'scatter' : 'chase';

	function ghostTarget(g: Ghost): Vec3 {
		if (g.mode === 'eyes') return home;
		if (g.mode === 'scatter') return g.corner;
		const pp = pac.p;
		const d = pac.dir;
		if (g.kind === 'blinky') return pp;
		if (g.kind === 'pinky') return [pp[0] + d[0] * 4, pp[1] + d[1] * 4, pp[2] + d[2] * 4];
		if (g.kind === 'inky') {
			const pivot: Vec3 = [pp[0] + d[0] * 2, pp[1] + d[1] * 2, pp[2] + d[2] * 2];
			const b = ghosts[0].p;
			return [pivot[0] * 2 - b[0], pivot[1] * 2 - b[1], pivot[2] * 2 - b[2]];
		}
		return dist2(g.p, pp) > 64 ? pp : g.corner; // clyde
	}

	// Arcade rule: among OPEN neighbours (no reversing unless forced), pick the one
	// nearest the target by straight-line distance (or farthest, if fleeing).
	function moveGhost(g: Ghost, gm: GhostMode) {
		// Eyes: descend the home-distance field → guaranteed shortest path to the pen,
		// then respawn into the current mode. (No reverse rule needed on a gradient.)
		if (g.mode === 'eyes') {
			let best: Vec3 | null = null;
			let bd = Infinity;
			for (const dd of DIRS) {
				const np: Vec3 = [g.p[0] + dd[0], g.p[1] + dd[1], g.p[2] + dd[2]];
				if (!isOpen(np)) continue;
				const hd = homeDist[vi(np)];
				if (hd >= 0 && hd < bd) {
					bd = hd;
					best = dd;
				}
			}
			if (best) {
				g.p = [g.p[0] + best[0], g.p[1] + best[1], g.p[2] + best[2]];
				g.dir = best;
			}
			if (eq(g.p, home)) g.mode = gm; // arrived → respawn active
			return;
		}
		const target = ghostTarget(g);
		const flee = g.mode === 'frightened';
		let best: Vec3 | null = null;
		let bestScore = flee ? -Infinity : Infinity;
		let fb: Vec3 | null = null;
		let fbScore = flee ? -Infinity : Infinity;
		for (const dd of DIRS) {
			const np: Vec3 = [g.p[0] + dd[0], g.p[1] + dd[1], g.p[2] + dd[2]];
			if (!isOpen(np)) continue;
			const s = dist2(np, target);
			if (flee ? s > fbScore : s < fbScore) {
				fbScore = s;
				fb = dd;
			}
			if (isRev(dd, g.dir)) continue;
			if (flee ? s > bestScore : s < bestScore) {
				bestScore = s;
				best = dd;
			}
		}
		const dir = best ?? fb;
		if (!dir) return; // fully boxed in (shouldn't happen)
		g.p = [g.p[0] + dir[0], g.p[1] + dir[1], g.p[2] + dir[2]];
		g.dir = dir;
	}

	// BFS over open nodes from Pac-Man → distance + first-move direction to every
	// reachable node (so Pac can head to the nearest pill through the maze).
	const bfsDist = new Int16Array(total);
	const bfsStep = new Int8Array(total);
	const bfsQueue = new Int32Array(total);
	function bfsFromPac() {
		bfsDist.fill(-1);
		const start = vi(pac.p);
		bfsDist[start] = 0;
		bfsStep[start] = -1;
		bfsQueue[0] = start;
		let head = 0;
		let tail = 1;
		while (head < tail) {
			const ci = bfsQueue[head++];
			const cx = ci % n;
			const cy = ((ci / n) | 0) % n;
			const cz = (ci / (n * n)) | 0;
			for (let di = 0; di < 6; di++) {
				const d = DIRS[di];
				const nx = cx + d[0],
					ny = cy + d[1],
					nz = cz + d[2];
				if (nx < 0 || nx >= n || ny < 0 || ny >= n || nz < 0 || nz >= n) continue;
				const nf = ni(nx, ny, nz);
				if (wall[nf] !== 0 || bfsDist[nf] >= 0) continue;
				bfsDist[nf] = bfsDist[ci] + 1;
				bfsStep[nf] = bfsDist[ci] === 0 ? di : bfsStep[ci];
				bfsQueue[tail++] = nf;
			}
		}
	}

	function stepPac() {
		bfsFromPac();
		// pick a target node: hunt a reachable frightened ghost, else the nearest pill
		let target = -1;
		let bd = Infinity;
		if (frightT > 0)
			for (const g of ghosts)
				if (g.mode === 'frightened') {
					const gi = vi(g.p);
					if (bfsDist[gi] >= 0 && bfsDist[gi] < bd) {
						bd = bfsDist[gi];
						target = gi;
					}
				}
		if (target < 0)
			for (let i = 0; i < total; i++)
				if (pills[i] && bfsDist[i] >= 0 && bfsDist[i] < bd) {
					bd = bfsDist[i];
					target = i;
				}
		if (target < 0 || bfsStep[target] < 0) return;

		let dir = DIRS[bfsStep[target]];
		// danger override: if the BFS step walks into a live ghost, flee to the open
		// neighbour that maximises distance from the nearest dangerous ghost.
		const dangerous = ghosts.filter((g) => g.mode !== 'frightened' && g.mode !== 'eyes');
		const safety = (p: Vec3) => {
			let m = Infinity;
			for (const g of dangerous) m = Math.min(m, dist2(p, g.p));
			return m;
		};
		const next: Vec3 = [pac.p[0] + dir[0], pac.p[1] + dir[1], pac.p[2] + dir[2]];
		if (dangerous.length && safety(next) < 4) {
			let bestDir: Vec3 | null = null;
			let bestSafe = -1;
			for (const dd of DIRS) {
				const np: Vec3 = [pac.p[0] + dd[0], pac.p[1] + dd[1], pac.p[2] + dd[2]];
				if (!isOpen(np)) continue;
				const s = safety(np);
				if (s > bestSafe) {
					bestSafe = s;
					bestDir = dd;
				}
			}
			if (bestDir) dir = bestDir;
		}
		pac = { p: [pac.p[0] + dir[0], pac.p[1] + dir[1], pac.p[2] + dir[2]], dir };
		const pi = vi(pac.p);
		if (pills[pi]) {
			if (pills[pi] === 2) {
				frightT = FRIGHT;
				for (const g of ghosts) if (g.mode !== 'eyes') g.mode = 'frightened';
			}
			pills[pi] = 0;
			pillsLeft--;
		}
	}

	function collisions() {
		for (const g of ghosts) {
			if (!eq(g.p, pac.p)) continue;
			if (g.mode === 'frightened') g.mode = 'eyes';
			else if (g.mode !== 'eyes') {
				lives--;
				reset(lives <= 0);
				return;
			}
		}
	}

	function gameStep() {
		if (deathPause > 0) return;
		modeClock += STEP;
		if (frightT > 0) frightT = Math.max(0, frightT - STEP);
		const gm = globalMode();

		stepPac();
		collisions();

		for (const g of ghosts) {
			if (g.mode !== 'eyes' && g.mode !== 'frightened') g.mode = gm;
			if (g.mode === 'frightened' && Math.floor(modeClock / STEP) % 2 === 0) continue; // slower
			moveGhost(g, gm);
			if (g.mode === 'eyes') moveGhost(g, gm); // eyes zoom home at double speed
		}
		// Blinky "Cruise Elroy": an extra step now and then as the maze empties.
		const b = ghosts[0];
		if (b.mode === 'chase' || b.mode === 'scatter') {
			const eaten = 1 - pillsLeft / total;
			blinkyAccum += eaten > 0.85 ? 0.8 : eaten > 0.6 ? 0.4 : 0;
			if (blinkyAccum >= 1) {
				blinkyAccum -= 1;
				moveGhost(b, gm);
			}
		}
		collisions();

		if (pillsLeft <= 0) reset(false);
	}

	return (d: LedDisplay, dt: number) => {
		clock += dt;
		if (deathPause > 0) deathPause = Math.max(0, deathPause - dt);
		acc += dt;
		let steps = 0;
		while (acc >= STEP && steps < 4) {
			acc -= STEP;
			gameStep();
			steps++;
		}

		// entity afterglow (short tail → animates the discrete steps)
		const decay = Math.exp(-dt / 0.1);
		for (let i = 0; i < trail.length; i++) trail[i] *= decay;
		const flashing = frightT > 0 && frightT < 1.6 && Math.floor(clock * 8) % 2 === 0;
		const ghostCol = (g: Ghost): Vec3 =>
			g.mode === 'eyes'
				? [0.4, 0.4, 0.55]
				: g.mode === 'frightened'
					? flashing
						? [1, 1, 1]
						: [0.15, 0.2, 1]
					: g.color;
		const deposit = (p: Vec3, c: Vec3) => {
			const i = vi(p) * 3;
			if (c[0] > trail[i]) trail[i] = c[0];
			if (c[1] > trail[i + 1]) trail[i + 1] = c[1];
			if (c[2] > trail[i + 2]) trail[i + 2] = c[2];
		};
		deposit(pac.p, [1.6, 1.5, 0.1]); // bright yellow-white — distinct from orange Clyde
		for (const g of ghosts) deposit(g.p, ghostCol(g));

		d.clear();
		// Only the corridors light up, so the lit dots ARE the maze (walls stay dark);
		// eaten = off → a dark trail through the corridors. Power pills pulse cyan.
		const blink = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(clock * 9));
		for (let z = 0; z < n; z++)
			for (let y = 0; y < n; y++)
				for (let x = 0; x < n; x++) {
					const i = ni(x, y, z);
					if (pills[i] === 1) d.plot(x, y, z, [0.42, 0.42, 0.5]);
					else if (pills[i] === 2) d.plot(x, y, z, [0.2 * blink, 1.0 * blink, 1.0 * blink]);
					const ti = i * 3;
					if (trail[ti] > 0.01 || trail[ti + 1] > 0.01 || trail[ti + 2] > 0.01)
						d.add(x, y, z, [trail[ti], trail[ti + 1], trail[ti + 2]]);
				}
		// lives — yellow dots along a top edge
		for (let i = 0; i < lives; i++) d.plot(i, n - 1, 0, [1, 0.8, 0]);
	};
}
