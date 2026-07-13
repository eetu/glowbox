// Example driver: a wormhole — a hollow tube down the z-axis whose wall glows with
// flowing colour-streaks that rush toward you, the tube meandering as it recedes.
// A voxel take on the classic 2001 star-gate slit-scan tunnel: instead of raymarching
// a fullscreen shader, we light the tube's wall shell in the grid, so you can orbit
// around the glowing tunnel itself.
import type { LedDisplay } from '@glowbox/led-grid';

const TAU = Math.PI * 2;

function hsv2rgb(h: number, s: number, v: number): [number, number, number] {
	const f = (n: number) => {
		const k = (n + h * 6) % 6;
		return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
	};
	return [f(5), f(3), f(1)];
}

export function makeWormhole(): (d: LedDisplay, dt: number) => void {
	// Travel distance along the tube. The tunnel is fixed in "world" space (bends
	// keyed to absolute z); we fly forward by scrolling camZ, so the walls rush past
	// and the bends sweep by — a POV fly-through. Pair with a camera looking down the
	// z-axis (the demo sets one) to be *inside* the tunnel.
	let camZ = 0;
	const SPEED = 7; // travel units/sec
	// Tunnel centreline in world space (sum of sines) — the course we fly through.
	const px = (s: number) => Math.sin(s * 0.13) + 0.5 * Math.sin(s * 0.06 + 1.3);
	const py = (s: number) => Math.sin(s * 0.1 + 2.1) + 0.5 * Math.sin(s * 0.05 + 0.5);
	return (d, dt) => {
		camZ += dt * SPEED;
		d.clear();
		const { nx, ny, nz } = d;
		const cx = (nx - 1) / 2;
		const cy = (ny - 1) / 2;
		const half = Math.min(nx, ny) / 2;
		const R = half * 0.5; // tube radius
		const thick = Math.max(1.0, R * 0.24); // wall shell thickness
		// The wall must never leave the box, so the centre can drift at most this far.
		const maxOff = Math.max(0, half - R - thick - 0.5);
		// Camera sits at the near (+z / high grid-z) end looking down the tube. The
		// centreline is measured RELATIVE to the camera, so the near rings are always
		// centred (never clip the box) and the tube bends away with depth — real turns.
		// The offset is smoothly bounded (tanh) to maxOff so the wall stays in-bounds
		// however hard the course turns. Travel = camZ (features sweep toward camera).
		const NA = Math.max(24, Math.ceil(TAU * R * 1.5));
		const RSTEPS = Math.max(2, Math.round(thick) + 1);
		const pcx = px(camZ);
		const pcy = py(camZ);
		for (let z = 0; z < nz; z++) {
			const depth = nz - 1 - z; // 0 at camera → nz-1 at far end
			const s = camZ + depth; // absolute distance along the tube at this slice
			const ox = px(s) - pcx;
			const oy = py(s) - pcy;
			const m = Math.hypot(ox, oy) || 1e-6;
			const bound = (maxOff * Math.tanh(m * 0.9)) / m; // squash magnitude ≤ maxOff
			const bx = cx + ox * bound;
			const by = cy + oy * bound;
			const dn = depth / Math.max(1, nz - 1); // 0 near → 1 far
			const fade = 1 - dn * 0.75; // far end dims → vanishing point reads as infinite
			const hue = ((s * 0.02) % 1) + (s < 0 ? 1 : 0); // flowing colour down the tube
			const [cr, cg, cb] = hsv2rgb(hue, 0.85, 1);
			for (let ia = 0; ia < NA; ia++) {
				const a = ia / NA;
				const ang = a * TAU;
				const ca = Math.cos(ang);
				const sa = Math.sin(ang);
				const streak = Math.pow(0.5 + 0.5 * Math.sin(s * 0.45 * TAU + a * TAU * 3), 2);
				const white = Math.pow(streak, 4) * 0.6; // white-hot crests
				for (let ir = 0; ir < RSTEPS; ir++) {
					const rr = R - thick + (ir / (RSTEPS - 1)) * 2 * thick;
					const shell = 1 - Math.abs(rr - R) / thick;
					const x = Math.round(bx + ca * rr);
					const y = Math.round(by + sa * rr);
					const k = shell * (0.25 + streak * 1.5) * fade;
					const w = white * shell * fade;
					d.plot(x, y, z, [cr * k + w, cg * k + w, cb * k + w]);
				}
			}
		}
	};
}
