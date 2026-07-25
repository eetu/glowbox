// Transport-control semantics of the frame player — pure logic, node-testable via
// makeFramePlayer with synthetic 1×1 frames on a headless voxel grid.
import { createVoxelGrid, type LedDisplay } from '@glowbox/led-grid';
import { expect, test } from 'vitest';

import { frameAt, type GifFrame, makeFramePlayer } from '../gif';

// Two 1×1 solid frames: red for 100 ms, then green for 100 ms.
const solid = (r: number, g: number, b: number, delay: number): GifFrame => ({
	src: { data: new Uint8ClampedArray([r, g, b, 255]), width: 1, height: 1 },
	delay
});
const FRAMES = [solid(255, 0, 0, 100), solid(0, 255, 0, 100)];

// paintImage only touches the voxel API, so the headless grid stands in for a display.
const makeGrid = () => createVoxelGrid(1, 1, 1) as unknown as LedDisplay;
const litColor = (g: LedDisplay) =>
	(g as unknown as { get(x: number, y: number, z: number): number[] | null }).get(0, 0, 0);

test('advances frames by rate-scaled dt and loops', () => {
	const g = makeGrid();
	const player = makeFramePlayer(FRAMES);
	player(g, 0.01); // 10 ms in — frame 0 (red)
	expect(litColor(g)?.[0]).toBeGreaterThan(0.9);
	player(g, 0.1); // 110 ms — frame 1 (green)
	expect(litColor(g)?.[1]).toBeGreaterThan(0.9);
	player(g, 0.1); // 210 ms — wrapped back to frame 0
	expect(litColor(g)?.[0]).toBeGreaterThan(0.9);

	player.rate = 10; // 10× — a 5 ms tick now jumps 50 ms
	expect(player.rate).toBe(10);
	player.seek(0);
	player(g, 0.006); // 60 ms — still red
	expect(litColor(g)?.[0]).toBeGreaterThan(0.9);
	player(g, 0.006); // 120 ms — green
	expect(litColor(g)?.[1]).toBeGreaterThan(0.9);
});

test('pause freezes the clock but keeps painting; play resumes', () => {
	const g = makeGrid();
	const player = makeFramePlayer(FRAMES);
	player(g, 0.01);
	expect(player.paused).toBe(false);
	player.pause();
	expect(player.paused).toBe(true);
	player(g, 10); // a huge paused tick must not advance
	expect(litColor(g)?.[0]).toBeGreaterThan(0.9); // still red — and still painted
	player.play();
	player(g, 0.15); // 160 ms — green
	expect(litColor(g)?.[1]).toBeGreaterThan(0.9);
});

test('seek jumps into the loop; negative rate plays backwards through the wrap', () => {
	const g = makeGrid();
	const player = makeFramePlayer(FRAMES);
	player.seek(0.15); // 150 ms — frame 1
	player(g, 0);
	expect(litColor(g)?.[1]).toBeGreaterThan(0.9);

	player.rate = -1;
	player(g, 0.1); // 50 ms — frame 0
	expect(litColor(g)?.[0]).toBeGreaterThan(0.9);
	player(g, 0.1); // -50 ms — wraps to 150 ms, frame 1
	expect(litColor(g)?.[1]).toBeGreaterThan(0.9);
});

test('frameAt wraps negative offsets', () => {
	expect(frameAt(FRAMES, -50)).toBe(1); // -50 ≡ 150 ms
	expect(frameAt(FRAMES, -150)).toBe(0); // -150 ≡ 50 ms
});

test('makeFramePlayer is ready immediately', async () => {
	await expect(makeFramePlayer(FRAMES).ready).resolves.toBe(true);
});
