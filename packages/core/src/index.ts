// @glowbox/core — framework-agnostic 3D LED-grid display. Embed in any SPA:
//   import { createLedDisplay } from "@glowbox/core";
// Framework wrappers are separate packages (e.g. "@glowbox/svelte").
export type {
	CameraOptions,
	ColorOptions,
	DisplayStats,
	InteractionOptions,
	LedDisplay,
	LedDisplayOptions,
	LedDisplayPatch,
	LedOptions,
	LedShape,
	LedStyle,
	Projection,
	QualityOptions,
	RGB,
	RgbLayout,
	Vec3,
	VoxelGrid
} from './led-display';
export { createLedDisplay } from './led-display';
// Colours: [r,g,b] 0..1 (>1 blooms) or any CSS string. parseColor normalizes either.
export { type Color, parseColor } from './color';
// The pure voxel API (no WebGL) — draw/compute frames headlessly, or reuse the
// canvas-like drawing primitives on your own buffer. Re-typed to the public `VoxelGrid`
// so the internal culling handle (`active`/`ActiveSet`) stays off the published surface.
import {
	createVoxelGrid as createVoxelGridImpl,
	type VoxelGrid as PublicVoxelGrid
} from './voxel-grid';
export const createVoxelGrid: (
	nx: number,
	ny: number,
	nz: number,
	leds?: Float32Array
) => PublicVoxelGrid = createVoxelGridImpl;
