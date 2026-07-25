// GIF animation player: decode a GIF, composite its (possibly partial) frames into
// full RGBA snapshots honouring frame disposal, then paint the frame for the current
// time onto the grid every draw. Decoding is via gifuct-js (small, cross-browser —
// avoids ImageDecoder support gaps). Compositing is pure JS (no canvas), so it runs
// and is testable in node.
import type { LedDisplay } from '@glowbox/led-grid';
import { decompressFrames, parseGIF } from 'gifuct-js';

import { type PlayerDrawFn, type PlayerOptions } from './image';
import { paintImage, type PaintOptions } from './plane';
import type { ImageSource } from './sample';

/** One composited GIF frame: a full-canvas RGBA snapshot + its display delay (ms). */
export interface GifFrame {
	src: ImageSource;
	delay: number;
}

/** Composite decoded GIF frames (from an ArrayBuffer) into full-size RGBA snapshots. */
export function framesFromBuffer(buffer: ArrayBuffer): GifFrame[] {
	const gif = parseGIF(buffer);
	const raw = decompressFrames(gif, true); // buildPatch → frame.patch is RGBA
	const W = gif.lsd.width;
	const H = gif.lsd.height;
	const full = new Uint8ClampedArray(W * H * 4); // accumulating canvas
	const out: GifFrame[] = [];
	let dispose: { left: number; top: number; width: number; height: number; type: number } | null =
		null;

	for (const fr of raw) {
		// Apply the previous frame's disposal before drawing this one.
		// type 2 (restore to background) / 3 (restore to previous, approximated) → clear.
		if (dispose && (dispose.type === 2 || dispose.type === 3)) clearRegion(full, W, H, dispose);

		const { left, top, width, height } = fr.dims;
		const patch = fr.patch;
		for (let y = 0; y < height; y++)
			for (let x = 0; x < width; x++) {
				const pi = (y * width + x) * 4;
				if (patch[pi + 3] === 0) continue; // transparent → keep what's underneath
				const fx = left + x;
				const fy = top + y;
				if (fx < 0 || fy < 0 || fx >= W || fy >= H) continue;
				const di = (fy * W + fx) * 4;
				full[di] = patch[pi];
				full[di + 1] = patch[pi + 1];
				full[di + 2] = patch[pi + 2];
				full[di + 3] = 255;
			}
		out.push({ src: { data: full.slice(), width: W, height: H }, delay: fr.delay || 100 });
		dispose = { left, top, width, height, type: fr.disposalType };
	}
	return out;
}

function clearRegion(
	buf: Uint8ClampedArray,
	W: number,
	H: number,
	r: { left: number; top: number; width: number; height: number }
) {
	for (let y = r.top; y < r.top + r.height && y < H; y++)
		for (let x = r.left; x < r.left + r.width && x < W; x++) {
			const i = (y * W + x) * 4;
			buf[i] = buf[i + 1] = buf[i + 2] = buf[i + 3] = 0;
		}
}

/** Fetch + decode a GIF URL into composited frames (browser or node with fetch). */
export async function decodeGif(url: string): Promise<GifFrame[]> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`glowbox: failed to load gif ${url} (${res.status})`);
	return framesFromBuffer(await res.arrayBuffer());
}

/** Pick the frame index for a time offset (ms) into a looping animation. */
export function frameAt(frames: GifFrame[], elapsedMs: number): number {
	const total = frames.reduce((a, f) => a + f.delay, 0);
	if (total <= 0) return 0;
	let t = ((elapsedMs % total) + total) % total; // wrap negatives (rate < 0 seeks back)
	for (let i = 0; i < frames.length; i++) {
		if (t < frames[i].delay) return i;
		t -= frames[i].delay;
	}
	return frames.length - 1;
}

// The shared transport: one clock (`elapsed`) advanced by rate-scaled dt while
// playing, frames arriving whenever the decode lands. Both players are this.
function framePlayer(
	opts: PlayerOptions,
	ready: Promise<boolean>,
	getFrames: () => GifFrame[] | null
): PlayerDrawFn {
	let elapsed = 0;
	let paused = false;
	let rate = 1;
	const clear = opts.clear ?? true;
	const paint: PaintOptions = opts;
	const draw = (d: LedDisplay, dt: number) => {
		if (clear) d.clear();
		const frames = getFrames();
		if (!frames || frames.length === 0) return;
		if (!paused) elapsed += dt * 1000 * rate; // dt is seconds
		paintImage(d, frames[frameAt(frames, elapsed)].src, paint);
	};
	const player = Object.assign(draw, {
		pause: () => {
			paused = true;
		},
		play: () => {
			paused = false;
		},
		seek: (seconds: number) => {
			elapsed = seconds * 1000;
		},
		ready
	}) as unknown as PlayerDrawFn;
	// Accessors can't ride Object.assign (it copies values, not getters).
	Object.defineProperty(player, 'paused', { get: () => paused });
	Object.defineProperty(player, 'rate', {
		get: () => rate,
		set: (v: number) => {
			rate = v;
		}
	});
	return player;
}

/**
 * Play a frame sequence you already have — composited GIF frames (`decodeGif` /
 * `framesFromBuffer`) or your own procedural `{ src, delay }` list — onto the grid
 * plane, looping. Same transport controls as `makeGifPlayer`.
 */
export function makeFramePlayer(frames: GifFrame[], opts: PlayerOptions = {}): PlayerDrawFn {
	return framePlayer(opts, Promise.resolve(true), () => frames);
}

/**
 * Load `url` and return a draw callback that plays the GIF onto the grid plane,
 * advancing frames by their delays and looping. Give the result to
 * `display.onFrame(...)` (or a wrapper's `draw` prop). Draws nothing until loaded.
 * The returned fn carries transport controls: `pause()` / `play()` / `seek(s)` /
 * `rate` / `paused` / `ready`.
 */
export function makeGifPlayer(url: string, opts: PlayerOptions = {}): PlayerDrawFn {
	let frames: GifFrame[] | null = null;
	const ready = decodeGif(url).then(
		(f) => {
			frames = f;
			return true;
		},
		(e) => {
			console.warn(e);
			return false;
		}
	);
	return framePlayer(opts, ready, () => frames);
}
