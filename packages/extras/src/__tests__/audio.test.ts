// makeAudioBands + visualizers are pure over a stubbed AnalyserNode — node-testable.
import { createVoxelGrid, type LedDisplay } from '@glowbox/led-grid';
import { expect, test } from 'vitest';

import { makeAudioBands, makeBarsVisualizer, makeRadialVisualizer } from '../audio';

// A fake analyser whose FFT is whatever `fill` writes (bin 0 = DC .. last = Nyquist).
const stubAnalyser = (fill: (fft: Uint8Array) => void, sampleRate = 48000) =>
	({
		frequencyBinCount: 512,
		context: { sampleRate },
		getByteFrequencyData: (fft: Uint8Array) => {
			fft.fill(0);
			fill(fft);
		}
	}) as unknown as AnalyserNode;

const grid = () => createVoxelGrid(16, 16, 16) as unknown as LedDisplay;
const g = (d: LedDisplay) =>
	d as unknown as { get(x: number, y: number, z: number): number[] | null };
// Unlit voxels read back as [0,0,0]; "lit" means any channel is on.
const lit = (c: number[] | null) => c != null && c[0] + c[1] + c[2] > 0;

test('low-frequency energy lands in the low bands, silence stays at zero', () => {
	// 48 kHz / 512 bins → bin width ~46.9 Hz; bins 1–3 ≈ 47–140 Hz (inside band 0's range).
	const audio = makeAudioBands(
		stubAnalyser((fft) => fft.fill(255, 1, 4)),
		{ bands: 8 }
	);
	audio.update();
	expect(audio.bands[0]).toBeGreaterThan(0.3);
	expect(audio.bands[7]).toBe(0);
	expect(audio.level).toBeGreaterThan(0);
	expect(audio.peak).toBeGreaterThanOrEqual(audio.level);
});

test('attack is instant, release glides', () => {
	let loud = true;
	const audio = makeAudioBands(
		stubAnalyser((fft) => {
			if (loud) fft.fill(255);
		}),
		{ bands: 4, release: 0.5 }
	);
	audio.update();
	const hot = audio.bands[0];
	expect(hot).toBeGreaterThan(0.9); // instant rise
	loud = false;
	audio.update();
	expect(audio.bands[0]).toBeCloseTo(hot * 0.5, 5); // one release step
	audio.update();
	expect(audio.bands[0]).toBeCloseTo(hot * 0.25, 5);
});

test('bars visualizer paints columns whose height follows the band', () => {
	const audio = makeAudioBands(
		stubAnalyser((fft) => fft.fill(255)), // everything loud → all bands ≈ 1
		{ bands: 4 }
	);
	const d = grid();
	makeBarsVisualizer(audio)(d, 0.016);
	// A full-energy spectrum lights the whole front-to-mid column, bottom to top.
	expect(lit(g(d).get(0, 0, 8))).toBe(true);
	expect(lit(g(d).get(0, 15, 8))).toBe(true);
	expect(lit(g(d).get(15, 15, 8))).toBe(true);
});

test('radial visualizer paints from the centre outward', () => {
	const audio = makeAudioBands(
		stubAnalyser((fft) => fft.fill(255)),
		{ bands: 8 }
	);
	const d = grid();
	makeRadialVisualizer(audio)(d, 0.016);
	const centreish = lit(g(d).get(8, 8, 8)) || lit(g(d).get(7, 7, 8)) || lit(g(d).get(8, 7, 8));
	expect(centreish).toBe(true);
	// Corners stay dark — spokes reach maxR (half the min dimension), not the corners.
	expect(lit(g(d).get(0, 0, 8))).toBe(false);
});

test('a quiet analyser draws nothing (clear leaves the grid dark)', () => {
	const audio = makeAudioBands(
		stubAnalyser(() => {}),
		{ bands: 4 }
	);
	const d = grid();
	makeBarsVisualizer(audio)(d, 0.016);
	expect(lit(g(d).get(8, 0, 8))).toBe(false);
});
