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
});
