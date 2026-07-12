// Example driver: a scrolling text marquee across the grid's front face. The string
// is rasterized to a 2D canvas the height of the grid, then sampled column by column
// each frame with a moving offset (wrapping seamlessly), coloured by a hue that
// drifts across the columns — a chunky LED ticker. Text and font come from live
// accessors so the demo can retype/restyle without recreating the program.
import type { LedDisplay } from '@glowbox/led-grid';

function hsv2rgb(h: number, s: number, v: number): [number, number, number] {
	const f = (n: number) => {
		const k = (n + h * 6) % 6;
		return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
	};
	return [f(5), f(3), f(1)];
}

interface Raster {
	data: Uint8ClampedArray;
	w: number;
	h: number;
}

// Rasterize `text` in `font` to a canvas of height `h` (width = the text's width).
function rasterize(text: string, h: number, font: string): Raster {
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d')!;
	const px = Math.max(6, Math.floor(h * 0.85));
	const css = `bold ${px}px ${font}`;
	ctx.font = css;
	const w = Math.max(1, Math.ceil(ctx.measureText(text).width));
	canvas.width = w;
	canvas.height = h;
	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, w, h);
	ctx.font = css;
	ctx.fillStyle = '#fff';
	ctx.textAlign = 'left';
	ctx.textBaseline = 'middle';
	ctx.fillText(text, 0, h / 2);
	return { data: ctx.getImageData(0, 0, w, h).data, w, h };
}

export function makeScroller(
	getText: () => string = () => 'GLOWBOX · ',
	getFont: () => string = () => "'Space Grotesk', sans-serif"
): (d: LedDisplay, dt: number) => void {
	let raster: Raster | null = null;
	let key = '';
	let scroll = 0;
	let t = 0;
	return (d, dt) => {
		t += dt;
		const { nx, ny, nz } = d;
		const text = getText() || ' ';
		const font = getFont();
		const k = `${text}|${font}|${ny}`;
		if (!raster || k !== key) {
			raster = rasterize(text, ny, font);
			key = k;
		}
		const { data, w, h } = raster;
		scroll += dt * ny * 1.6; // ~1.6 glyph-heights/sec
		d.clear();
		const z = nz >> 1;
		for (let x = 0; x < nx; x++) {
			const sx = (((Math.floor(scroll + x) % w) + w) % w) | 0;
			const [r, g, b] = hsv2rgb((x / Math.max(1, nx) + t * 0.1) % 1, 0.8, 1);
			for (let y = 0; y < ny; y++) {
				const sy = h - 1 - y; // flip: grid y-up, canvas y-down
				if (data[(sy * w + sx) * 4] > 128) d.plot(x, y, z, [r, g, b]);
			}
		}
	};
}
