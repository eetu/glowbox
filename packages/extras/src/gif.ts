// GIF animation player: decode a GIF, composite its (possibly partial) frames into
// full RGBA snapshots honouring frame disposal, then paint the frame for the current
// time onto the grid every draw. Decoding is via gifuct-js (small, cross-browser —
// avoids ImageDecoder support gaps). Compositing is pure JS (no canvas), so it runs
// and is testable in node.
import type { LedDisplay } from '@glowbox/led-grid';
import { decompressFrames, parseGIF } from 'gifuct-js';

import { type DrawFn, type PlayerOptions } from './image';
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
	let t = elapsedMs % total;
	for (let i = 0; i < frames.length; i++) {
		if (t < frames[i].delay) return i;
		t -= frames[i].delay;
	}
	return frames.length - 1;
}

/**
 * Load `url` and return a draw callback that plays the GIF onto the grid plane,
 * advancing frames by their delays and looping. Give the result to
 * `display.onFrame(...)` (or a wrapper's `draw` prop). Draws nothing until loaded.
 */
export function makeGifPlayer(url: string, opts: PlayerOptions = {}): DrawFn {
	let frames: GifFrame[] | null = null;
	let elapsed = 0;
	decodeGif(url).then(
		(f) => (frames = f),
		(e) => console.warn(e)
	);
	const clear = opts.clear ?? true;
	const paint: PaintOptions = opts;
	return (d: LedDisplay, dt: number) => {
		if (clear) d.clear();
		if (!frames || frames.length === 0) return;
		elapsed += dt * 1000; // dt is seconds
		paintImage(d, frames[frameAt(frames, elapsed)].src, paint);
	};
}
