// Example driver: the Aizawa strange attractor as a glowing particle swarm. A few
// thousand points are integrated along the attractor's flow each frame and plotted
// additively, so its intricate looped-with-a-spike 3D form lights up as a streaming
// holographic sculpture — exactly the kind of genuinely-3D content the display shows
// best. Scaled to sit fully inside the grid (with margin) so nothing clips.
import type { LedDisplay } from '@glowbox/led-grid';

const TAU = Math.PI * 2;

function hsv2rgb(h: number, s: number, v: number): [number, number, number] {
	const f = (n: number) => {
		const k = (n + h * 6) % 6;
		return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
	};
	return [f(5), f(3), f(1)];
}

interface P {
	x: number;
	y: number;
	z: number;
}

export function makeAttractor(): (d: LedDisplay, dt: number) => void {
	// Aizawa constants.
	const a = 0.95;
	const b = 0.7;
	const c = 0.6;
	const dC = 3.5;
	const e = 0.25;
	const f = 0.1;
	const N = 3400;
	const seed = (): P => ({
		x: (Math.random() * 2 - 1) * 0.1,
		y: (Math.random() * 2 - 1) * 0.1,
		z: 0.5 + (Math.random() * 2 - 1) * 0.1
	});
	let ps: P[] = [];
	return (d, dt) => {
		if (ps.length !== N) ps = Array.from({ length: N }, seed);
		d.clear();
		const { nx, ny, nz } = d;
		const h = 0.006; // integration step (stable Aizawa shape)
		const steps = Math.max(1, Math.min(6, Math.round(dt / h)));
		for (const p of ps) {
			let dx = 0;
			let dy = 0;
			let dz = 0;
			for (let s = 0; s < steps; s++) {
				const { x, y, z } = p;
				dx = (z - b) * x - dC * y;
				dy = dC * x + (z - b) * y;
				dz = c + a * z - (z * z * z) / 3 - (x * x + y * y) * (1 + e * z) + f * z * x * x * x;
				p.x += dx * h;
				p.y += dy * h;
				p.z += dz * h;
			}
			if (!Number.isFinite(p.x) || Math.abs(p.x) > 3 || Math.abs(p.y) > 3 || Math.abs(p.z) > 3) {
				Object.assign(p, seed());
				continue;
			}
			// Map attractor axes → grid (x→x, z→up/y, y→depth/z). Conservative scale so
			// the whole attractor (incl. its vertical spike) fits inside with margin.
			const gx = Math.round((p.x * 0.32 + 0.5) * (nx - 1));
			const gy = Math.round(((p.z - 0.6) * 0.38 + 0.5) * (ny - 1));
			const gz = Math.round((p.y * 0.32 + 0.5) * (nz - 1));
			if (gx < 0 || gx >= nx || gy < 0 || gy >= ny || gz < 0 || gz >= nz) continue;
			const hue = (Math.atan2(p.y, p.x) / TAU + 0.5 + p.z * 0.15) % 1;
			const spd = Math.min(1, Math.hypot(dx, dy, dz) * 0.12);
			const [cr, cg, cb] = hsv2rgb((hue + 1) % 1, 0.8, 1);
			const k = 0.55 + spd; // faster streams brighter
			d.add(gx, gy, gz, [cr * k, cg * k, cb * k]);
		}
	};
}
