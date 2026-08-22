// @glowbox/neon font machinery — the vendored Hershey single-stroke faces and the
// `NeonFont` contract a custom face plugs into. A neon letterform is a *centreline*
// — the path the glass bender follows — so the faces are single-stroke (open-path)
// fonts, never filled outlines: Hershey Simplex ('sans', block channel letters) and
// Hershey Script ('script', connected cursive — the classic one-tube-per-word window
// sign), packed as the classic JHF pair strings and decoded lazily on first use.
// The Hershey license requires its acknowledgements to ship WITH the font data —
// they live in faces/hershey-license.ts as a string constant the face modules
// reference (a bundler can't drop it while a face is in use); full terms in the
// package's LICENSE-hershey.
import { HERSHEY_LICENSE } from './faces/hershey-license';
import { SANS } from './faces/sans';
import { SCRIPT } from './faces/script';

export { HERSHEY_LICENSE };

/** One glyph's tube centreline: polylines in font units (y-down, baseline at 0). */
export interface NeonGlyph {
	/** Horizontal advance to the next glyph, font units. */
	adv: number;
	/** Centreline polylines; x runs 0..~adv (the side bearings are inside `adv`). */
	strokes: [number, number][][];
}

/** A stroke font the sign can bend into glass — the custom-face escape hatch (a
 *  one-glyph face whose strokes are your logo works). Coordinates are y-down with
 *  the baseline at 0; `capHeight` is the scale reference. */
export interface NeonFont {
	/** Cap height above the baseline, font units (the Hershey faces: 21). */
	capHeight: number;
	/** Extremes above/below the baseline across the face, as positive numbers. */
	ascent: number;
	descent: number;
	/** The face's default circuit grouping under `tubes: 'auto'` (default
	 *  'word' — a sign wires a word as one circuit, its returns painted out
	 *  behind the panel). Declare 'glyph' for a face meant to run as separately
	 *  switched channel letters. */
	grouping?: 'glyph' | 'word';
	glyphs: Record<string, NeonGlyph>;
	/** Attribution that must travel with the font data (the Hershey terms). */
	license?: string;
}

/** A vendored face before decoding: raw JHF pair strings (see faces/*.ts). */
export interface PackedFace {
	grouping?: 'glyph' | 'word';
	/** The face's baseline y in raw JHF units (Hershey convention: 9). */
	baseline: number;
	capHeight: number;
	ascent: number;
	descent: number;
	license: string;
	/** 95 packed glyphs, ASCII 0x20–0x7E: charCode − 82 per coordinate, y down;
	 *  the first pair is the left/right margin (advance = right − left); a ' R'
	 *  pair is pen-up. */
	data: string[];
}

const R = 82; // 'R' — the JHF coordinate origin

function decodeGlyph(packed: string, baseline: number): NeonGlyph {
	const left = packed.charCodeAt(0) - R;
	const right = packed.charCodeAt(1) - R;
	const strokes: [number, number][][] = [];
	let cur: [number, number][] | null = null;
	for (let i = 2; i < packed.length; i += 2) {
		if (packed[i] === ' ' && packed[i + 1] === 'R') {
			cur = null; // pen-up
			continue;
		}
		if (!cur) strokes.push((cur = []));
		cur.push([packed.charCodeAt(i) - R - left, packed.charCodeAt(i + 1) - R - baseline]);
	}
	return { adv: right - left, strokes };
}

// Decoded lazily and memoised per face — an app that never shows the sans face
// never pays for decoding it (the packed data itself is a few kB of strings).
const decoded = new Map<PackedFace, NeonFont>();
function decodeFace(face: PackedFace): NeonFont {
	let f = decoded.get(face);
	if (f) return f;
	const glyphs: Record<string, NeonGlyph> = {};
	for (let i = 0; i < face.data.length; i++)
		glyphs[String.fromCharCode(32 + i)] = decodeGlyph(face.data[i], face.baseline);
	f = {
		capHeight: face.capHeight,
		ascent: face.ascent,
		descent: face.descent,
		grouping: face.grouping,
		glyphs,
		license: face.license
	};
	decoded.set(face, f);
	return f;
}

/** Resolve the `font` option to a glyph table: a built-in face name or a custom
 *  `NeonFont` passed through untouched. Default 'script'. */
export function resolveFont(font?: 'script' | 'sans' | NeonFont): NeonFont {
	if (font === 'sans') return decodeFace(SANS);
	if (font == null || font === 'script') return decodeFace(SCRIPT);
	return font;
}
