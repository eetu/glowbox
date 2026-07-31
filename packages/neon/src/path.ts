// @glowbox/neon path support — SVG path data → tube centrelines. The parser is shared
// (`shared/path-parse.ts`, symlinked in as `path-parse.ts`); what is neon own is what
// comes out the far end: OPEN polylines, because a tube is a stroke.
//
// One thing no parser can fix: neon needs CENTRELINES. A filled icon outline path strokes
// as a double-walled tube silhouette — author single-stroke paths (the pen tool, not the
// shape-minus-shape booleans), and put the bends you want in the path itself (sharp
// corners render as sharp glass).
import { flattenPath, type PathFlattenOptions } from './path-parse';

export type PathToStrokesOptions = PathFlattenOptions;

/** Turn SVG path data (a `d` string, or several — subpaths become separate glass
 *  runs either way) into centreline polylines in the path own units, ready for
 *  a custom `NeonFont` glyph or the sign `art`. Throws on malformed data. */
export function pathToStrokes(
	d: string | string[],
	opts: PathToStrokesOptions = {}
): [number, number][][] {
	const strokes: [number, number][][] = [];
	for (const { pts, closed } of flattenPath(d, opts)) {
		// A closed subpath returns to its start: the glass runs all the way round.
		if (closed) {
			const first = pts[0];
			const last = pts[pts.length - 1];
			if (first[0] !== last[0] || first[1] !== last[1]) pts.push([first[0], first[1]]);
		}
		if (pts.length >= 2) strokes.push(pts);
	}
	return strokes;
}
