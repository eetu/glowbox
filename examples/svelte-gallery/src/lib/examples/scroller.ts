// Example driver: a scrolling text marquee across the grid's front face — a thin
// wrapper over @glowbox/extras' makeTextScroller that adds the demo's rainbow (a hue
// drifting across columns). The font select feeds a live getter: the 'bitmap' sentinel
// picks the bundled 5×7 LED font (deterministic, chunky); anything else rasterizes as
// a system font family. Text and font swap live without recreating the program.
import { makeTextScroller } from '@glowbox/extras';
import type { LedDisplay } from '@glowbox/led-grid';

function hsv2rgb(h: number, s: number, v: number): [number, number, number] {
	const f = (n: number) => {
		const k = (n + h * 6) % 6;
		return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
	};
	return [f(5), f(3), f(1)];
}

export function makeScroller(
	getText: () => string = () => 'GLOWBOX · ',
	getFont: () => string = () => 'bitmap'
): (d: LedDisplay, dt: number) => void {
	const rainbow = (u: number, t: number, w: number): [number, number, number] =>
		hsv2rgb((((u / Math.max(1, w) + t * 0.1) % 1) + 1) % 1, 0.8, 1);
	// Two scrollers (each owns its scroll state + raster cache); the font select picks
	// which one draws each frame. Speeds tuned to read alike on the demo's 64×12 face.
	const bitmap = makeTextScroller(getText, { color: rainbow, speed: 14 });
	const system = makeTextScroller(getText, {
		font: 'system',
		fontFamily: getFont,
		color: rainbow,
		speed: 19
	});
	return (d, dt) => (getFont() === 'bitmap' ? bitmap : system)(d, dt);
}
