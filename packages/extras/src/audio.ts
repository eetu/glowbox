// Audio-reactive helpers: an AnalyserNode distilled into a few log-spaced, smoothed
// 0..1 bands + an overall level, and two canned visualizers (bars / radial) over the
// voxel draw API. Zero deps, no module-scope browser globals — the AnalyserNode comes
// from the caller's WebAudio graph (mic, media element, synth …), so this file never
// touches an AudioContext itself.
import { type Color, type LedDisplay, parseColor, type RGB } from '@glowbox/led-grid';

import { type Plane, planeAxes } from './plane';

export interface AudioBandsOptions {
	/** Number of bands (default 16). */
	bands?: number;
	/** Lowest analysed frequency in Hz (default 40). */
	minFreq?: number;
	/** Highest analysed frequency in Hz (default 12000, clamped to Nyquist). */
	maxFreq?: number;
	/** Release smoothing 0..1 — how much of a band survives each falling frame
	 *  (default 0.72). Rises are instant, so beats stay punchy while decays glide.
	 *  (The analyser's own `smoothingTimeConstant` applies on top.) */
	release?: number;
}

export interface AudioBands {
	/** The smoothed band energies, 0..1, low → high frequency. */
	readonly bands: Float32Array;
	/** Overall level 0..1 (mean of the bands). */
	readonly level: number;
	/** Decaying peak of `level` — a slow envelope for pulse effects. */
	readonly peak: number;
	/** Pull a fresh FFT from the analyser and fold it into the bands. Call once per
	 *  frame (the canned visualizers call it for you). */
	update(): void;
}

/** Distil `analyser` into `n` log-spaced smoothed bands. Feed any AnalyserNode —
 *  microphone, `<audio>` element, or your own synth graph. */
export function makeAudioBands(analyser: AnalyserNode, opts: AudioBandsOptions = {}): AudioBands {
	const n = Math.max(1, opts.bands ?? 16);
	const release = opts.release ?? 0.72;
	const nyquist = analyser.context.sampleRate / 2;
	const minFreq = Math.max(1, opts.minFreq ?? 40);
	const maxFreq = Math.min(nyquist, opts.maxFreq ?? 12000);
	const fft = new Uint8Array(analyser.frequencyBinCount);
	const bands = new Float32Array(n);
	let level = 0;
	let peak = 0;

	// Log-spaced band edges expressed as FFT bin indices (a band always spans ≥1 bin).
	const binOf = (freq: number) =>
		Math.min(fft.length - 1, Math.round((freq / nyquist) * fft.length));
	const edges: number[] = [];
	for (let i = 0; i <= n; i++) edges.push(binOf(minFreq * (maxFreq / minFreq) ** (i / n)));

	return {
		bands,
		get level() {
			return level;
		},
		get peak() {
			return peak;
		},
		update() {
			analyser.getByteFrequencyData(fft);
			let sum = 0;
			for (let i = 0; i < n; i++) {
				const lo = edges[i];
				const hi = Math.max(lo + 1, edges[i + 1]);
				let acc = 0;
				for (let b = lo; b < hi; b++) acc += fft[b];
				const v = acc / (hi - lo) / 255;
				bands[i] = v > bands[i] ? v : bands[i] * release + v * (1 - release);
				sum += bands[i];
			}
			level = sum / n;
			peak = Math.max(level, peak * 0.96);
		}
	};
}

/** Per-cell colour: band index (0..1 across the row) and height (0..1 up the bar). */
export type VisualizerColor = Color | ((band: number, height: number) => Color);

export interface VisualizerOptions {
	/** Grid plane to draw on (default `'xy'`). */
	plane?: Plane;
	/** Index on the plane's normal axis (default: the middle slice). */
	depth?: number;
	/** A colour, or a per-cell function of (band, height) 0..1 (default: a warm
	 *  level meter — amber base into a hot top). */
	color?: VisualizerColor;
	/** Multiply painted colours (>1 blooms in the hologram style; default 1). */
	gain?: number;
	/** Clear the grid before painting each frame (default true). */
	clear?: boolean;
}

const defaultColor = (_band: number, height: number): RGB => [
	1,
	0.55 - height * 0.35,
	0.12 + height * 0.5
];

const resolveColor = (c: VisualizerColor | undefined) => {
	if (typeof c === 'function') return (b: number, h: number) => parseColor(c(b, h));
	const fixed = c != null ? parseColor(c) : null;
	return (b: number, h: number) => fixed ?? defaultColor(b, h);
};

/** Classic spectrum bars: one column (or more) per band, height = band energy. */
export function makeBarsVisualizer(
	audio: AudioBands,
	opts: VisualizerOptions = {}
): (d: LedDisplay, dt: number) => void {
	const color = resolveColor(opts.color);
	const gain = opts.gain ?? 1;
	const clear = opts.clear ?? true;
	return (d) => {
		audio.update();
		if (clear) d.clear();
		const { dimU, dimV, dimW, at } = planeAxes(d, opts.plane ?? 'xy');
		const depth = opts.depth ?? dimW >> 1;
		const n = audio.bands.length;
		for (let u = 0; u < dimU; u++) {
			const band = Math.min(n - 1, Math.floor((u / dimU) * n));
			const h = Math.round(audio.bands[band] * dimV);
			for (let v = 0; v < h; v++) {
				const [r, g, b] = color(band / Math.max(1, n - 1), v / Math.max(1, dimV - 1));
				const [x, y, z] = at(u, v, depth);
				d.plot(x, y, z, [r * gain, g * gain, b * gain]);
			}
		}
	};
}

/** Radial spokes: bands fan out from the plane's centre, length = band energy. */
export function makeRadialVisualizer(
	audio: AudioBands,
	opts: VisualizerOptions = {}
): (d: LedDisplay, dt: number) => void {
	const color = resolveColor(opts.color);
	const gain = opts.gain ?? 1;
	const clear = opts.clear ?? true;
	return (d) => {
		audio.update();
		if (clear) d.clear();
		const { dimU, dimV, dimW, at } = planeAxes(d, opts.plane ?? 'xy');
		const depth = opts.depth ?? dimW >> 1;
		const cu = (dimU - 1) / 2;
		const cv = (dimV - 1) / 2;
		const maxR = Math.min(dimU, dimV) / 2;
		const n = audio.bands.length;
		for (let i = 0; i < n; i++) {
			const angle = (i / n) * Math.PI * 2 - Math.PI / 2; // band 0 at 12 o'clock
			const len = audio.bands[i] * maxR;
			for (let r = 0; r <= len; r++) {
				const u = Math.round(cu + Math.cos(angle) * r);
				const v = Math.round(cv + Math.sin(angle) * r);
				if (u < 0 || v < 0 || u >= dimU || v >= dimV) continue;
				const h = maxR > 0 ? r / maxR : 0;
				const [cr, cg, cb] = color(i / Math.max(1, n - 1), h);
				const [x, y, z] = at(u, v, depth);
				d.plot(x, y, z, [cr * gain, cg * gain, cb * gain]);
			}
		}
	};
}
