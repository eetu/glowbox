// @glowbox/vfd path support — SVG path data → filled polygons. The parser is shared
// (`shared/path-parse.ts`, symlinked in as `path-parse.ts`); what is this core own is what
// comes out the far end.
//
// Neon needed CENTRELINES, because a tube is a stroke — which made authoring artwork for
// it a craft (single-stroke pen paths, no boolean shapes). A VFD anode is the opposite: a
// patch of phosphor SCREEN-PRINTED onto the plate, so it is a FILL. Path data straight out
// of any vector editor — or copied off an icon set — works as-is, and subpaths keep their
// winding so a shape with a hole (the reels of a cassette, the ring of a disc) fills
// correctly as one anode.
import { flattenPath, type PathFlattenOptions } from './path-parse';

export type PathToPolysOptions = PathFlattenOptions;

/** Turn SVG path data (a `d` string, or several) into closed polygons in the path own
 *  units — the geometry an `icon` element screen-prints onto its plate. Every subpath
 *  comes back closed whether or not it carried a `Z`, since an anode is a filled patch
 *  and an unclosed one is just an authoring slip. Coordinates are flat
 *  `[x0,y0,x1,y1,…]` per polygon, which is the panel one geometry currency. Throws on
 *  malformed data. */
export function pathToPolys(d: string | string[], opts: PathToPolysOptions = {}): number[][] {
	const flat: number[][] = [];
	for (const { pts } of flattenPath(d, opts)) {
		// A ring needs no repeated last point — the fill closes it — and fewer than three
		// points is not an area at all.
		const first = pts[0];
		const last = pts[pts.length - 1];
		if (pts.length > 2 && first[0] === last[0] && first[1] === last[1]) pts.pop();
		if (pts.length < 3) continue;
		const out: number[] = [];
		for (const [x, y] of pts) out.push(x, y);
		flat.push(out);
	}
	return flat;
}
