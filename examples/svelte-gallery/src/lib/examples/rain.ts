// Example driver: falling rain — droplets streaking down the y axis with fading
// trails, gusting sideways in a slow wind, and splashing where they hit the floor:
// each landing throws a brief expanding ring (plus a little bounce blip), heavy drops
// a bigger one. Sparse (a few hundred lit cells), so it scales to any grid; droplet
// count tracks the grid's x–z footprint.
import type { LedDisplay } from '@glowbox/led-grid';

interface Drop {
	x: number; // fractional — wind drifts it
	z: number;
	y: number; // fractional height, falls toward 0
	v: number; // fall speed in grid-heights per second
	hue: number;
	trail: number; // trail length in cells
	heavy: boolean; // brighter head, bigger splash
}

interface Splash {
	x: number;
	z: number;
	age: number;
	life: number;
	maxR: number;
	hue: number;
}

const MAX_SPLASHES = 80;

export function makeRain(): (d: LedDisplay, dt: number) => void {
	let drops: Drop[] = [];
	let splashes: Splash[] = [];
	let footprint = -1;
	let t = 0;

	const spawn = (nx: number, nz: number, ny: number, atTop: boolean): Drop => {
		const heavy = Math.random() < 0.1;
		return {
			x: Math.random() * nx,
			z: Math.floor(Math.random() * nz),
			y: atTop ? ny - 1 + Math.random() * 3 : Math.random() * ny,
			v: (heavy ? 1.1 : 0.6) + Math.random() * 1.1,
			hue: 0.5 + Math.random() * 0.12, // cyan → blue
			trail: heavy ? 4 : 2 + Math.floor(Math.random() * 2),
			heavy
		};
	};

	return (d, dt) => {
		const { nx, ny, nz } = d;
		const target = Math.max(12, Math.round(nx * nz * 0.18));
		if (footprint !== nx * nz) {
			drops = Array.from({ length: target }, () => spawn(nx, nz, ny, false));
			splashes = [];
			footprint = nx * nz;
		}
		d.clear();

		// A slow compound gust: mostly calm, occasionally leaning the whole shower.
		t += dt;
		const wind = Math.sin(t * 0.4) * Math.sin(t * 0.13) * 1.6; // cells/second
		const lean = wind * 0.3; // trail offset per cell of height

		for (const drop of drops) {
			drop.y -= drop.v * dt * ny;
			drop.x = (((drop.x + wind * dt) % nx) + nx) % nx;
			if (drop.y < 0) {
				// Land: splash where it hit, then respawn at the top.
				if (splashes.length < MAX_SPLASHES)
					splashes.push({
						x: Math.round(drop.x),
						z: drop.z,
						age: 0,
						life: drop.heavy ? 0.5 : 0.35,
						maxR: drop.heavy ? 3 : 1.8,
						hue: drop.hue
					});
				Object.assign(drop, spawn(nx, nz, ny, true));
			}
			const head = Math.round(drop.y);
			// The trail leans back against the wind so gusts read as diagonal streaks.
			for (let k = 0; k <= drop.trail; k++) {
				const y = head + k;
				if (y < 0 || y >= ny) continue;
				const x = Math.round(drop.x - k * lean);
				if (x < 0 || x >= nx) continue;
				const b = (1 - k / (drop.trail + 1)) * (drop.heavy && k === 0 ? 1.4 : 1);
				d.plot(x, y, drop.z, [0.5 * b, (0.7 + drop.hue) * b, 1 * b]);
			}
		}

		// Splashes: an expanding ring on the floor + a brief bounce blip one cell up,
		// fading fast. Eight spokes approximate the ring — plenty at LED resolution.
		for (const s of splashes) {
			s.age += dt;
			const p = s.age / s.life; // 0..1
			if (p >= 1) continue;
			const r = s.maxR * p;
			const b = (1 - p) * (1 - p) * 0.9;
			for (let i = 0; i < 8; i++) {
				const a = (i / 8) * Math.PI * 2;
				const x = Math.round(s.x + Math.cos(a) * r);
				const z = Math.round(s.z + Math.sin(a) * r);
				if (x < 0 || z < 0 || x >= nx || z >= nz) continue;
				// A touch whiter than the drop — hitting water catches the light.
				d.plot(x, 0, z, [0.55 * b, (0.75 + s.hue) * b, 1 * b]);
			}
			if (p < 0.3 && ny > 1) d.plot(s.x, 1, s.z, [0.4 * b, 0.6 * b, 0.9 * b]);
		}
		splashes = splashes.filter((s) => s.age < s.life);
	};
}
