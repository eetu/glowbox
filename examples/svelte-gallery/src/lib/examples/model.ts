// Example driver: voxelize a glTF model (an X-wing) into the LED grid and spin it.
// three.js (GLTFLoader) handles the GLB — KHR_mesh_quantization, node transforms,
// materials — which a hand parser would choke on. We load once, surface-sample the
// triangles into a normalized point cloud (with each triangle's material colour),
// then each frame just rotate the cloud and plot it (sparse, like the torus). three
// is dynamically imported so it stays out of the default demo bundle.
import type { LedDisplay } from '@glowbox/core';
import type * as THREE from 'three'; // type-only (erased); three itself is loaded lazily

import xwingUrl from './xwing.glb?url';

// Packed cloud: [x,y,z, r,g,b] per point, normalized to ~[-1,1] model space.
let cloud: Float32Array | null = null;
let ptCount = 0;
let loading: Promise<void> | null = null;

const srgb = (c: number) => Math.pow(Math.max(0, c), 1 / 2.2); // three colours are linear

async function loadCloud(): Promise<void> {
	const three = await import('three');
	const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
	const gltf = await new GLTFLoader().loadAsync(xwingUrl);
	gltf.scene.updateMatrixWorld(true);

	// Collect world-space triangles + their material colour.
	const tris: number[] = []; // per tri: ax,ay,az, bx,by,bz, cx,cy,cz, r,g,b
	const min = [Infinity, Infinity, Infinity];
	const max = [-Infinity, -Infinity, -Infinity];
	const v = new three.Vector3();

	gltf.scene.traverse((obj) => {
		const mesh = obj as THREE.Mesh;
		if (!mesh.isMesh) return;
		const geo = mesh.geometry;
		const pos = geo.attributes.position as THREE.BufferAttribute;
		if (!pos) return;
		const index = geo.index;
		const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as {
			color?: THREE.Color;
		};
		const col = mat?.color ?? new three.Color(1, 1, 1);
		const r = srgb(col.r),
			g = srgb(col.g),
			b = srgb(col.b);
		const world = (i: number): [number, number, number] => {
			v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
			for (let k = 0; k < 3; k++) {
				const c = v.getComponent(k);
				if (c < min[k]) min[k] = c;
				if (c > max[k]) max[k] = c;
			}
			return [v.x, v.y, v.z];
		};
		const n = index ? index.count : pos.count;
		for (let i = 0; i < n; i += 3) {
			const i0 = index ? index.getX(i) : i;
			const i1 = index ? index.getX(i + 1) : i + 1;
			const i2 = index ? index.getX(i + 2) : i + 2;
			const A = world(i0),
				B = world(i1),
				C = world(i2);
			tris.push(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2], r, g, b);
		}
	});

	// Centre + uniform scale into ~[-0.85, 0.85].
	const ctr = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
	const ext = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1;
	const scale = 1.7 / ext;

	// Deterministic voxelization: lattice-sample each triangle finely enough to hit
	// every surface cell (no random holes), dedup into unique voxels at RES so the
	// point count stays bounded. RES ≥ the top preset ⇒ gap-free up to 128³.
	const RES = 128;
	const step = 2 / RES; // normalized voxel size
	const norm = (i: number, k: number) => (tris[i] - ctr[k]) * scale;
	const voxel = new Map<number, [number, number, number]>();
	const T = tris.length / 12;
	for (let ti = 0; ti < T; ti++) {
		const o = ti * 12;
		const col: [number, number, number] = [tris[o + 9], tris[o + 10], tris[o + 11]];
		const ax = norm(o, 0),
			ay = norm(o + 1, 1),
			az = norm(o + 2, 2);
		const bx = norm(o + 3, 0),
			by = norm(o + 4, 1),
			bz = norm(o + 5, 2);
		const cx = norm(o + 6, 0),
			cy = norm(o + 7, 1),
			cz = norm(o + 8, 2);
		const e1 = Math.hypot(bx - ax, by - ay, bz - az);
		const e2 = Math.hypot(cx - ax, cy - ay, cz - az);
		const n = Math.max(1, Math.ceil((Math.max(e1, e2) / step) * 1.5)); // oversample ×1.5
		for (let i = 0; i <= n; i++) {
			for (let j = 0; j <= n - i; j++) {
				const u = i / n,
					w = j / n;
				const px = ax + u * (bx - ax) + w * (cx - ax);
				const py = ay + u * (by - ay) + w * (cy - ay);
				const pz = az + u * (bz - az) + w * (cz - az);
				const vx = Math.min(RES - 1, Math.max(0, Math.round(((px + 1) / 2) * (RES - 1))));
				const vy = Math.min(RES - 1, Math.max(0, Math.round(((py + 1) / 2) * (RES - 1))));
				const vz = Math.min(RES - 1, Math.max(0, Math.round(((pz + 1) / 2) * (RES - 1))));
				const key = vx + RES * (vy + RES * vz);
				if (!voxel.has(key)) voxel.set(key, col);
			}
		}
	}

	const out: number[] = [];
	const inv = 2 / (RES - 1);
	for (const [key, col] of voxel) {
		const vx = key % RES;
		const vy = Math.floor(key / RES) % RES;
		const vz = Math.floor(key / (RES * RES));
		out.push(vx * inv - 1, vy * inv - 1, vz * inv - 1, col[0], col[1], col[2]);
	}
	cloud = new Float32Array(out);
	ptCount = out.length / 6;
}

/** A stateful per-frame draw callback that spins the voxelized X-wing. `getSpin`
 *  gates the self-rotation (the demo wires it to auto-orbit, so turning that off
 *  freezes the model to inspect it — drag-orbit still works). */
export function makeXwing(getSpin: () => boolean = () => true) {
	loading ??= loadCloud().catch((e) => console.error('glowbox: X-wing load failed', e));
	let t = 0;
	const rgb: [number, number, number] = [0, 0, 0];
	return (d: LedDisplay, dt: number) => {
		if (getSpin()) t += dt; // freeze the angle when spin is off
		d.clear();
		const c = cloud;
		if (!c) return; // still loading
		const { nx, ny, nz } = d;
		// Start on a 3/4 "hero" angle (base yaw offset) so the load view reads as an
		// X-wing straight away, then spin slowly. A little extra top-tilt shows the
		// wings' X, and SCALE fills the grid (wingtips clip a hair — worth the presence).
		const ay = t * 0.35 + 1.9; // spin around Y, offset to the hero angle
		const ax = 0.4; // fixed tilt (look down at the top a touch)
		const SCALE = 1.4;
		const cay = Math.cos(ay),
			say = Math.sin(ay),
			cax = Math.cos(ax),
			sax = Math.sin(ax);
		const hx = (nx - 1) / 2,
			hy = (ny - 1) / 2,
			hz = (nz - 1) / 2;
		for (let i = 0; i < ptCount; i++) {
			const o = i * 6;
			const px = c[o] * SCALE,
				py = c[o + 1] * SCALE,
				pz = c[o + 2] * SCALE;
			const y1 = py * cax - pz * sax; // tilt about X
			const z1 = py * sax + pz * cax;
			const x2 = px * cay + z1 * say; // spin about Y
			const z2 = -px * say + z1 * cay;
			rgb[0] = c[o + 3];
			rgb[1] = c[o + 4];
			rgb[2] = c[o + 5];
			d.plot(Math.round((x2 + 1) * hx), Math.round((y1 + 1) * hy), Math.round((z2 + 1) * hz), rgb);
		}
	};
}
