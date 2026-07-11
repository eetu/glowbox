// Example driver: an animated wave field — a rippling height surface across the
// grid's x–z floor, coloured by height. A sum of a few travelling sines keeps the
// motion organic (not an obvious single ripple); cheap (O(nx·nz), one lit cell per
// column) so it stays fast even on big grids.
import type { LedDisplay } from '@glowbox/core';

function hsv2rgb(h: number, s: number, v: number): [number, number, number] {
	const f = (n: number) => {
		const k = (n + h * 6) % 6;
		return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
	};
	return [f(5), f(3), f(1)];
}

export function makeWave(): (d: LedDisplay, dt: number) => void {
	let t = 0;
	return (d, dt) => {
		t += dt;
		d.clear();
		const { nx, ny, nz } = d;
		for (let x = 0; x < nx; x++) {
			const u = nx > 1 ? x / (nx - 1) : 0.5;
			for (let z = 0; z < nz; z++) {
				const w = nz > 1 ? z / (nz - 1) : 0.5;
				// Three travelling sines at different angles → interference ripples.
				const s =
					Math.sin((u * 3.0 + t * 0.9) * Math.PI) * 0.5 +
					Math.sin((w * 2.3 - t * 0.7) * Math.PI) * 0.3 +
					Math.sin(((u + w) * 2.0 + t * 1.3) * Math.PI) * 0.2;
				const hgt = (s + 1) / 2; // 0..1
				const y = Math.round(hgt * (ny - 1));
				const [r, g, b] = hsv2rgb((0.6 - hgt * 0.6 + 1) % 1, 0.85, 1);
				const k = 0.6 + hgt * 0.8; // crests brighter
				d.plot(x, y, z, [r * k, g * k, b * k]);
			}
		}
	};
}
