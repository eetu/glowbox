// Example driver: a spinning torus drawn onto the LED grid via its canvas-like
// voxel API. For each node we take its normalized [-1,1] position, rotate it by
// the current orientation, and light it when it lies within a thin shell of the
// torus surface (an SDF). Hue runs around the ring. The simplest demonstration
// of the generic display interface.
import type { LedDisplay } from '$lib/led-grid';

const TAU = Math.PI * 2;

function hsv2rgb(h: number, s: number, v: number): [number, number, number] {
	const f = (n: number) => {
		const k = (n + h * 6) % 6;
		return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
	};
	return [f(5), f(3), f(1)];
}

/** A stateful per-frame draw callback for <LedGrid draw={...}>. */
export function makeTorusDraw(major = 0.52, minor = 0.2) {
	let t = 0;
	return (d: LedDisplay, dt: number) => {
		t += dt;
		d.clear();
		const { nx, ny, nz } = d;
		const shell = Math.max(0.12, 1.4 / Math.max(nx, ny, nz)); // ~1 LED thick
		const ax = t * 0.6; // tumble around X
		const ay = t * 0.9; // and Y
		const cax = Math.cos(ax),
			sax = Math.sin(ax);
		const cay = Math.cos(ay),
			say = Math.sin(ay);
		for (let z = 0; z < nz; z++) {
			const pz0 = nz > 1 ? (z / (nz - 1)) * 2 - 1 : 0;
			for (let y = 0; y < ny; y++) {
				const py0 = ny > 1 ? (y / (ny - 1)) * 2 - 1 : 0;
				for (let x = 0; x < nx; x++) {
					const px0 = nx > 1 ? (x / (nx - 1)) * 2 - 1 : 0;
					const py = py0 * cax - pz0 * sax;
					const pz1 = py0 * sax + pz0 * cax;
					const px = px0 * cay + pz1 * say;
					const pz = -px0 * say + pz1 * cay;
					const q = Math.hypot(px, pz) - major;
					const dd = Math.abs(Math.hypot(q, py) - minor);
					if (dd >= shell) continue;
					const b = 1 - dd / shell;
					const hue = (Math.atan2(pz, px) / TAU + 0.5 + t * 0.04) % 1;
					const [cr, cg, cb] = hsv2rgb((hue + 1) % 1, 0.85, 1);
					const k = b * b * 1.2;
					d.plot(x, y, z, [cr * k, cg * k, cb * k]);
				}
			}
		}
	};
}
