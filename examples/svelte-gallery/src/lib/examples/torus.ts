// Example driver: a spinning torus drawn onto the LED grid via its canvas-like
// voxel API. Two strategies, picked by resolution:
//   • small grids → scan the volume and test the torus SDF with a soft shell
//     (temporally stable — no edge flicker — and cheap when nx·ny·nz is small).
//   • big grids → generate the torus *surface* parametrically over (u, v) angles
//     (O(surface) ≈ n² instead of O(n³)), so 100³ stays fast. Hard voxel rounding
//     of the moving surface would flicker at low res, but at high density it's
//     imperceptible — hence the split.
// Hue runs around the major ring.
import type { LedDisplay } from '@glowbox/led-grid';

const TAU = Math.PI * 2;

// At/below this longest-axis size the volume SDF is cheap (≲10 ms) and flicker-free.
const VOLUME_MAX_DIM = 64;

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
		const maxDim = Math.max(nx, ny, nz);
		const ax = t * 0.6; // tumble around X
		const ay = t * 0.9; // and Y
		const cax = Math.cos(ax),
			sax = Math.sin(ax);
		const cay = Math.cos(ay),
			say = Math.sin(ay);

		if (maxDim <= VOLUME_MAX_DIM) {
			// --- volume SDF (smooth, flicker-free) ---
			const shell = Math.max(0.12, 1.4 / maxDim); // ~1 LED thick
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
			return;
		}

		// --- parametric surface (fast for big grids) ---
		// ~3 samples per voxel around the major ring, ~1.5 around the tube.
		const uSteps = Math.ceil(maxDim * 3);
		const vSteps = Math.ceil(maxDim * 1.5);
		const rc = new Float32Array(vSteps); // major + minor·cos v
		const sy = new Float32Array(vSteps); // minor·sin v (torus-frame y)
		for (let iv = 0; iv < vSteps; iv++) {
			const v = (iv / vSteps) * TAU;
			rc[iv] = major + minor * Math.cos(v);
			sy[iv] = minor * Math.sin(v);
		}
		for (let iu = 0; iu < uSteps; iu++) {
			const u = (iu / uSteps) * TAU;
			const cu = Math.cos(u),
				su = Math.sin(u);
			const hue = (u / TAU + 0.5 + t * 0.04) % 1;
			const [cr, cg, cb] = hsv2rgb((hue + 1) % 1, 0.85, 1);
			for (let iv = 0; iv < vSteps; iv++) {
				// Surface point in the torus frame (ring in the x–z plane), then the
				// inverse of Ry(ay)·Rx(ax) → normalized [-1,1] grid coords.
				const px = rc[iv] * cu;
				const pz = rc[iv] * su;
				const py = sy[iv];
				const pz1 = px * say + pz * cay;
				const gx = px * cay - pz * say;
				const gy = py * cax + pz1 * sax;
				const gz = -py * sax + pz1 * cax;
				const x = Math.round(((gx + 1) / 2) * (nx - 1));
				const y = Math.round(((gy + 1) / 2) * (ny - 1));
				const z = Math.round(((gz + 1) / 2) * (nz - 1));
				d.plot(x, y, z, [cr, cg, cb]);
			}
		}
	};
}
