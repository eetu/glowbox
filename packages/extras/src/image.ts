// Still-image player: load an image (PNG/JPG/…), then paint it onto the grid plane
// every frame. Loads async — draws nothing until ready.
import type { LedDisplay } from '@glowbox/core';

import { paintImage, type PaintOptions } from './plane';
import type { ImageSource } from './sample';

export interface PlayerOptions extends PaintOptions {
	/** Clear the grid before painting each frame (default true). */
	clear?: boolean;
}

/** A per-frame draw callback (what the players return). */
export type DrawFn = (d: LedDisplay, dt: number) => void;

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
 * until the image has loaded.
 */
export function makeImagePlayer(url: string, opts: PlayerOptions = {}): DrawFn {
	let src: ImageSource | null = null;
	decodeImage(url).then(
		(s) => (src = s),
		(e) => console.warn(e)
	);
	const clear = opts.clear ?? true;
	return (d) => {
		if (clear) d.clear();
		if (src) paintImage(d, src, opts);
	};
}
