// Example driver: falling rain — a cloud of droplets streaking down the y axis with
// short fading trails, respawning at the top. Sparse (a few hundred lit cells), so
// it scales to any grid. Droplet count tracks the grid's x–z footprint.
import type { LedDisplay } from '@glowbox/core';

interface Drop {
	x: number;
	z: number;
	y: number; // fractional height, falls toward 0
	v: number; // fall speed in grid-heights per second
	hue: number;
}

export function makeRain(): (d: LedDisplay, dt: number) => void {
	let drops: Drop[] = [];
	let footprint = -1;

	const spawn = (nx: number, nz: number, ny: number, atTop: boolean): Drop => ({
		x: Math.floor(Math.random() * nx),
		z: Math.floor(Math.random() * nz),
		y: atTop ? ny - 1 : Math.random() * ny,
		v: 0.6 + Math.random() * 1.1,
		hue: 0.5 + Math.random() * 0.12 // cyan → blue
	});

	return (d, dt) => {
		const { nx, ny, nz } = d;
		const target = Math.max(12, Math.round(nx * nz * 0.18));
		if (footprint !== nx * nz) {
			drops = Array.from({ length: target }, () => spawn(nx, nz, ny, false));
			footprint = nx * nz;
		}
		d.clear();
		for (const drop of drops) {
			drop.y -= drop.v * dt * ny;
			if (drop.y < 0) Object.assign(drop, spawn(nx, nz, ny, true));
			const head = Math.round(drop.y);
			// A 3-cell trail above the head, fading out.
			for (let k = 0; k < 3; k++) {
				const y = head + k;
				if (y < 0 || y >= ny) continue;
				const b = 1 - k / 3;
				const [r, g, bl] = [0.5 * b, (0.7 + drop.hue) * b, 1 * b];
				d.plot(drop.x, y, drop.z, [r, g, bl]);
			}
		}
	};
}
