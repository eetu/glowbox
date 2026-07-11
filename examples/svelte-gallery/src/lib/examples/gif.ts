// Example driver: play a looping GIF onto the front face of the grid using
// @glowbox/extras. The player loads the GIF asynchronously (composites its frames)
// and paints the current frame each draw — the grid becomes a chunky LED billboard.
import type { LedDisplay } from '@glowbox/core';
import { makeGifPlayer, type PlayerOptions } from '@glowbox/extras';

import loopUrl from './loop.gif?url';

// `contain` keeps the 4:3 GIF's aspect. The hologram style wants a healthy gain to
// glow bright against the dark background (GIF colours are 0..1); the cel-shaded
// comic style preserves brightness, so it wants ~unity gain or bright pixels blow to
// white — hence the demo passes a style-appropriate gain.
//
// `gain` can be a getter so brightness tracks the live LED style *without* recreating
// the player: the player holds this same `opts` object and re-reads `gain` every paint,
// so we just mutate it per frame. Recreating instead would re-decode the GIF (a black
// flash on every style toggle).
export function makeGifDraw(
	gain: number | (() => number) = 2.6
): (d: LedDisplay, dt: number) => void {
	const getGain = typeof gain === 'function' ? gain : () => gain;
	const opts: PlayerOptions = { plane: 'xy', fit: 'contain' };
	const player = makeGifPlayer(loopUrl, opts);
	return (d, dt) => {
		opts.gain = getGain();
		player(d, dt);
	};
}
