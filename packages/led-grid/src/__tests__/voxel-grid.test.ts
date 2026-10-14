import { describe, expect, test } from 'vitest';

import { createVoxelGrid, type Vec3 } from '../voxel-grid';

// Chebyshev-adjacent = differ by at most 1 on every axis (a contiguous voxel step).
const adjacent = (a: Vec3, b: Vec3) =>
	Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1 && Math.abs(a[2] - b[2]) <= 1;

const litVoxels = (g: ReturnType<typeof createVoxelGrid>): Vec3[] => {
	const out: Vec3[] = [];
	for (let z = 0; z < g.nz; z++)
		for (let y = 0; y < g.ny; y++)
			for (let x = 0; x < g.nx; x++) {
				const [r, gr, b] = g.get(x, y, z);
				if (r + gr + b > 0) out.push([x, y, z]);
			}
	return out;
};

describe('voxel-grid', () => {
	test('index maps (x,y,z) → flat RGB offset', () => {
		const g = createVoxelGrid(4, 5, 6);
		expect(g.index(0, 0, 0)).toBe(0);
		expect(g.index(1, 0, 0)).toBe(3);
		expect(g.index(0, 1, 0)).toBe(4 * 3);
		expect(g.index(0, 0, 1)).toBe(4 * 5 * 3);
		expect(g.leds.length).toBe(4 * 5 * 6 * 3);
	});

	test('plot / get round-trips; inBounds guards; out-of-range ignored', () => {
		const g = createVoxelGrid(3, 3, 3);
		g.plot(1, 2, 0, [0.5, 0.25, 1]);
		expect(g.get(1, 2, 0)).toEqual([0.5, 0.25, 1]);
		expect(g.inBounds(2, 2, 2)).toBe(true);
		expect(g.inBounds(3, 0, 0)).toBe(false);
		expect(g.inBounds(-1, 0, 0)).toBe(false);
		// out of range is a no-op, not a throw, and reads back black
		expect(() => g.plot(9, 9, 9, [1, 1, 1])).not.toThrow();
		expect(g.get(9, 9, 9)).toEqual([0, 0, 0]);
	});

	test('add accumulates; clear / fill set every LED', () => {
		const g = createVoxelGrid(2, 2, 2);
		g.add(0, 0, 0, [0.2, 0, 0]);
		g.add(0, 0, 0, [0.3, 0.5, 0]);
		expect(g.get(0, 0, 0)).toEqual([0.5, 0.5, 0]);
		// float32-exact values so read-back is bit-identical (0.1 is not representable)
		g.fill([0.5, 0.25, 0.75]);
		expect(g.get(1, 1, 1)).toEqual([0.5, 0.25, 0.75]);
		g.clear();
		expect(litVoxels(g)).toHaveLength(0);
	});

	test('line is contiguous, gap-free, and hits both endpoints', () => {
		const g = createVoxelGrid(8, 8, 8);
		const a: Vec3 = [0, 0, 0];
		const b: Vec3 = [7, 3, 1];
		g.line(a, b, [1, 1, 1]);
		const lit = litVoxels(g);
		// exactly max-axis-span + 1 voxels (one per step of the driving axis)
		expect(lit).toHaveLength(7 + 1);
		expect(g.get(...a)).toEqual([1, 1, 1]);
		expect(g.get(...b)).toEqual([1, 1, 1]);
		// each successive voxel is adjacent to the previous → no gaps
		const ordered = [...lit].sort((p, q) => p[0] - q[0]);
		for (let i = 1; i < ordered.length; i++)
			expect(adjacent(ordered[i - 1], ordered[i])).toBe(true);
	});

	test('a line partly off the grid lights the voxels the full walk does, in the same order', () => {
		// The full Bresenham walk, every step, for reference.
		const walked = (a: Vec3, b: Vec3, n: number): number[] => {
			let [x, y, z] = a;
			const d = [0, 1, 2].map((i) => Math.abs(b[i] - a[i]));
			const s = [0, 1, 2].map((i) => (a[i] < b[i] ? 1 : -1));
			const dm = Math.max(...d);
			const e = [dm / 2, dm / 2, dm / 2];
			const cells: number[] = [];
			for (let i = 0; i <= dm; i++) {
				if (x >= 0 && x < n && y >= 0 && y < n && z >= 0 && z < n) cells.push(x + n * (y + n * z));
				const p = [x, y, z];
				for (let k = 0; k < 3; k++) {
					e[k] -= d[k];
					if (e[k] < 0) {
						e[k] += dm;
						p[k] += s[k];
					}
				}
				[x, y, z] = p;
			}
			return cells;
		};
		let seed = 7;
		const rand = (lo: number, hi: number) => {
			seed = (seed * 16807) % 2147483647;
			return lo + (seed % (hi - lo + 1));
		};
		for (let i = 0; i < 400; i++) {
			const reach = i < 200 ? 30 : 5000;
			const a: Vec3 = [rand(-reach, reach), rand(-reach, reach), rand(-reach, reach)];
			const b: Vec3 = [rand(-reach, reach), rand(-reach, reach), rand(-reach, reach)];
			const g = createVoxelGrid(8, 8, 8);
			g.line(a, b, [1, 1, 1]);
			const order = Array.from(g.active.list.subarray(0, g.active.count));
			expect(order, `${a} → ${b}`).toEqual(walked(a, b, 8));
		}
	});

	test('a line from far off the grid costs only its visible part; non-finite ends draw nothing', () => {
		const g = createVoxelGrid(8, 8, 8);
		const t0 = performance.now();
		g.line([0, 0, 0], [2e9, 5, 5], [1, 1, 1]);
		expect(litVoxels(g)).toEqual([0, 1, 2, 3, 4, 5, 6, 7].map((x) => [x, 0, 0]));
		g.clear();
		// Crossing the grid halfway along a 4e9-step walk (past 2^53 in the closed form)
		// lights what the same line scaled down to a 40-step walk does.
		g.line([-2e9, -1e9, 3], [2e9, 1e9, 4], [1, 1, 1]);
		expect(performance.now() - t0).toBeLessThan(100);
		const small = createVoxelGrid(8, 8, 8);
		small.line([-20, -10, 3], [20, 10, 4], [1, 1, 1]);
		expect(litVoxels(g)).toEqual(litVoxels(small));
		expect(litVoxels(g)).toHaveLength(8);
		g.clear();
		g.line([0, 0, 0], [NaN, 5, 5], [1, 1, 1]);
		g.line([Infinity, 0, 0], [1, 1, 1], [1, 1, 1]);
		expect(litVoxels(g)).toHaveLength(0);
	});

	test('box wireframe lights edges only; filled lights the volume', () => {
		const wire = createVoxelGrid(3, 3, 3);
		wire.box([0, 0, 0], [2, 2, 2], [1, 1, 1]);
		expect(wire.get(0, 0, 0)).toEqual([1, 1, 1]); // corner: 3 boundary axes
		expect(wire.get(1, 0, 0)).toEqual([1, 1, 1]); // edge midpoint: 2 boundary axes
		expect(wire.get(1, 1, 0)).toEqual([0, 0, 0]); // face centre: 1 boundary axis
		expect(wire.get(1, 1, 1)).toEqual([0, 0, 0]); // interior

		const solid = createVoxelGrid(3, 3, 3);
		solid.box([0, 0, 0], [2, 2, 2], [1, 1, 1], true);
		expect(litVoxels(solid)).toHaveLength(27);
	});

	test('sphere shell is hollow inside; filled is solid', () => {
		const shell = createVoxelGrid(7, 7, 7);
		shell.sphere([3, 3, 3], 2, [1, 1, 1]);
		expect(shell.get(3, 3, 3)).toEqual([0, 0, 0]); // centre: hollow
		expect(shell.get(3, 3, 4)).toEqual([0, 0, 0]); // interior (dist 1): off the shell
		expect(shell.get(3, 3, 5)).toEqual([1, 1, 1]); // on the surface (dist 2)

		const solid = createVoxelGrid(7, 7, 7);
		solid.sphere([3, 3, 3], 2, [1, 1, 1], true);
		expect(solid.get(3, 3, 3)).toEqual([1, 1, 1]); // centre: filled
		expect(solid.get(3, 3, 4)).toEqual([1, 1, 1]); // interior: filled
		expect(solid.get(3, 3, 5)).toEqual([1, 1, 1]); // surface: filled
	});

	test('an external buffer is drawn into in place', () => {
		const buf = new Float32Array(2 * 2 * 2 * 3);
		const g = createVoxelGrid(2, 2, 2, buf);
		g.plot(1, 1, 1, [1, 0, 0]);
		expect(buf[g.index(1, 1, 1)]).toBe(1);
	});

	test('torus shell is a hollow tube; filled is a solid ring; the hole stays dark', () => {
		const shell = createVoxelGrid(17, 17, 17);
		shell.torus([8, 8, 8], 4, 1, [1, 1, 1]);
		expect(shell.get(13, 8, 8)).toEqual([1, 1, 1]); // outer wall (ring dist 1)
		expect(shell.get(11, 8, 8)).toEqual([1, 1, 1]); // inner wall (ring dist 1)
		expect(shell.get(12, 9, 8)).toEqual([1, 1, 1]); // top of the tube
		expect(shell.get(12, 8, 8)).toEqual([0, 0, 0]); // tube centreline: hollow
		expect(shell.get(8, 8, 8)).toEqual([0, 0, 0]); // the doughnut hole

		const solid = createVoxelGrid(17, 17, 17);
		solid.torus([8, 8, 8], 4, 1, [1, 1, 1], true);
		expect(solid.get(12, 8, 8)).toEqual([1, 1, 1]); // tube centreline: filled
		expect(solid.get(8, 8, 8)).toEqual([0, 0, 0]); // hole stays dark even filled
	});

	test('torus axis re-orients the ring plane', () => {
		const g = createVoxelGrid(17, 17, 17);
		g.torus([8, 8, 8], 4, 1, [1, 1, 1], true, 'x');
		expect(g.get(8, 12, 8)).toEqual([1, 1, 1]); // ring now lives in the y–z plane

		const def = createVoxelGrid(17, 17, 17);
		def.torus([8, 8, 8], 4, 1, [1, 1, 1], true); // default axis 'y' (x–z ring)
		expect(def.get(8, 12, 8)).toEqual([0, 0, 0]);
		expect(def.get(12, 8, 8)).toEqual([1, 1, 1]);
	});

	test('cylinder shell is wall + end caps; filled is a solid can', () => {
		const shell = createVoxelGrid(17, 17, 17);
		shell.cylinder([8, 3, 8], 3, 6, [1, 1, 1]); // layers y = 3..8
		expect(shell.get(11, 5, 8)).toEqual([1, 1, 1]); // wall
		expect(shell.get(8, 3, 8)).toEqual([1, 1, 1]); // bottom cap centre
		expect(shell.get(8, 8, 8)).toEqual([1, 1, 1]); // top cap centre
		expect(shell.get(8, 5, 8)).toEqual([0, 0, 0]); // interior: hollow
		expect(shell.get(8, 9, 8)).toEqual([0, 0, 0]); // above the top cap

		const solid = createVoxelGrid(17, 17, 17);
		solid.cylinder([8, 3, 8], 3, 6, [1, 1, 1], true);
		expect(solid.get(8, 5, 8)).toEqual([1, 1, 1]); // interior: filled
	});

	test('cylinder axis re-orients; off-grid / oversized shapes clamp without throwing', () => {
		const g = createVoxelGrid(17, 17, 17);
		g.cylinder([8, 8, 3], 3, 6, [1, 1, 1], false, 'z'); // layers z = 3..8
		expect(g.get(11, 8, 5)).toEqual([1, 1, 1]); // wall in the x–y plane

		const edge = createVoxelGrid(17, 17, 17);
		expect(() => edge.cylinder([16, 15, 16], 10, 10, [1, 1, 1])).not.toThrow();
		expect(() => edge.torus([-5, 8, 40], 30, 6, [1, 1, 1])).not.toThrow();
	});
});
