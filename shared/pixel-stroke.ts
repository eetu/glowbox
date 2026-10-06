// Lines and masks in whole pixels: a polyline as the cells a 1 px line through it covers, and
// any mask as the fewest rects that cover it (row runs, stacked where rows repeat), so a
// vertical stroke is one rect and not one per row.
import type { PixelRect } from './pixel';

type Point = readonly [number, number];

/** The set cells of a `w` × `h` mask (row-major, non-zero set) as rects: runs along each
 *  row, a run extended down while the rows below repeat it exactly. */
export function maskRects(mask: ArrayLike<number>, w: number, h: number): PixelRect[] {
	const rects: PixelRect[] = [];
	let open = new Map<string, PixelRect>();
	for (let y = 0; y < h; y++) {
		const next = new Map<string, PixelRect>();
		for (let x = 0; x < w; x++) {
			if (!mask[y * w + x]) continue;
			const x0 = x;
			while (x + 1 < w && mask[y * w + x + 1]) x++;
			const key = `${x0},${x}`;
			const above = open.get(key);
			if (above) {
				above.h++;
				next.set(key, above);
			} else {
				const r = { x: x0, y, w: x - x0 + 1, h: 1 };
				rects.push(r);
				next.set(key, r);
			}
		}
		open = next;
	}
	return rects;
}

/**
 * The cells of a line `width` px wide (a square brush) through `points`, in pixel units
 * with cell (x, y) covering [x, x+1) × [y, y+1), each cell once, as rects. Segments are
 * Bresenham between the points' cells; `closed` joins the last point to the first.
 */
export function strokeRects(
	points: readonly Point[],
	{ width = 1, closed = false }: { width?: number; closed?: boolean } = {}
): PixelRect[] {
	if (!points.length) return [];
	const cells = new Set<number>();
	const at = (p: Point) => [Math.floor(p[0]), Math.floor(p[1])] as const;
	let [minX, minY] = at(points[0]);
	let [maxX, maxY] = [minX, minY];
	for (const p of points) {
		const [x, y] = at(p);
		minX = Math.min(minX, x);
		minY = Math.min(minY, y);
		maxX = Math.max(maxX, x);
		maxY = Math.max(maxY, y);
	}
	const lo = Math.floor((width - 1) / 2);
	const ox = minX - lo;
	const oy = minY - lo;
	const w = maxX - minX + width;
	const h = maxY - minY + width;
	const plot = (x: number, y: number) => {
		for (let dy = 0; dy < width; dy++)
			for (let dx = 0; dx < width; dx++) cells.add((y - oy - lo + dy) * w + (x - ox - lo + dx));
	};
	const line = (a: Point, b: Point) => {
		let [x0, y0] = at(a);
		const [x1, y1] = at(b);
		const dx = Math.abs(x1 - x0);
		const dy = -Math.abs(y1 - y0);
		const sx = x0 < x1 ? 1 : -1;
		const sy = y0 < y1 ? 1 : -1;
		let err = dx + dy;
		for (;;) {
			plot(x0, y0);
			if (x0 === x1 && y0 === y1) return;
			const e2 = 2 * err;
			if (e2 >= dy) {
				err += dy;
				x0 += sx;
			}
			if (e2 <= dx) {
				err += dx;
				y0 += sy;
			}
		}
	};
	if (points.length === 1) plot(...at(points[0]));
	for (let i = 1; i < points.length; i++) line(points[i - 1], points[i]);
	if (closed && points.length > 2) line(points[points.length - 1], points[0]);
	const mask = new Uint8Array(w * h);
	for (const c of cells) mask[c] = 1;
	return maskRects(mask, w, h).map((r) => ({ ...r, x: r.x + ox, y: r.y + oy }));
}
