// Still-image player: load an image (PNG/JPG/…), then paint it onto the grid plane
// every frame. Loads async — draws nothing until ready.
import type { LedDisplay } from '@glowbox/led-grid';

import { paintImage, type PaintOptions } from './plane';
import type { ImageSource } from './sample';

export interface PlayerOptions extends PaintOptions {
	/** Clear the grid before painting each frame (default true). */
	clear?: boolean;
}

/** A per-frame draw callback (what the players return). */
export type DrawFn = (d: LedDisplay, dt: number) => void;

/** Transport controls carried by every player's draw fn (non-breaking: the fn still
 *  goes straight to `onFrame`). Pausing freezes the current frame (it keeps painting —
 *  other stacked callbacks continue); `seek` jumps to a time offset in the loop;
 *  `rate` scales playback speed (negative plays backwards). On a still image they are
 *  accepted no-ops, so players are interchangeable. */
export interface PlayerControls {
	pause(): void;
	play(): void;
	/** Jump to `seconds` into the (looping) animation. */
	seek(seconds: number): void;
	/** Playback-speed multiplier (default 1; negative = backwards). */
	rate: number;
	readonly paused: boolean;
	/** Resolves once the source is decoded — `true` on success, `false` on load failure
	 *  (the player logs a warning and draws nothing). Never rejects. */
	readonly ready: Promise<boolean>;
}

/** A player: a draw callback with transport controls attached. */
export type PlayerDrawFn = DrawFn & PlayerControls;

/** Decode an image URL to raw RGBA via `createImageBitmap` + a 2D canvas (browser). */
export async function decodeImage(url: string): Promise<ImageSource> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`glowbox: failed to load image ${url} (${res.status})`);
	const bitmap = await createImageBitmap(await res.blob());
	const canvas = document.createElement('canvas');
	canvas.width = bitmap.width;
	canvas.height = bitmap.height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('glowbox: 2D canvas unavailable');
	ctx.drawImage(bitmap, 0, 0);
	bitmap.close?.();
	const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
	return { data: img.data, width: img.width, height: img.height };
}

/**
 * Load `url` and return a draw callback that paints it onto the grid plane. Give
 * the result to `display.onFrame(...)` (or a wrapper's `draw` prop). Draws nothing
 * until the image has loaded. Carries the same transport controls as the GIF player
 * (accepted no-ops on a still — the players are interchangeable); `ready` resolves
 * when the image is decoded.
 */
export function makeImagePlayer(url: string, opts: PlayerOptions = {}): PlayerDrawFn {
	let src: ImageSource | null = null;
	const ready = decodeImage(url).then(
		(s) => {
			src = s;
			return true;
		},
		(e) => {
			console.warn(e);
			return false;
		}
	);
	const clear = opts.clear ?? true;
	const draw = (d: LedDisplay) => {
		if (clear) d.clear();
		if (src) paintImage(d, src, opts);
	};
	let paused = false;
	let rate = 1;
	const player = Object.assign(draw, {
		pause: () => {
			paused = true;
		},
		play: () => {
			paused = false;
		},
		seek: () => {},
		ready
		// paused/rate arrive as accessors below — Object.assign copies values, not getters.
	}) as unknown as PlayerDrawFn;
	Object.defineProperty(player, 'paused', { get: () => paused });
	Object.defineProperty(player, 'rate', {
		get: () => rate,
		set: (v: number) => {
			rate = v;
		}
	});
	return player;
}
