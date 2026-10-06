// SHARED SOURCE. This file lives in `shared/` and is SYMLINKED into each package that
// needs it (see `scripts/check-shared.mjs` and CLAUDE.md → Conventions). Editing it here
// edits it for every one of them. It is not a package and nothing depends on it at
// runtime: each bundler inlines it, so the cores stay genuinely zero-dep.
// Shared by: lcd (as `latin.ts`), split-flap.
//
// A 5×7 extension face to `font5x7.ts`: the Western European / Nordic set, in the same
// ASCII-art authoring format (7 rows of 5, '#' = ink). Hardware framing: this is the
// HD44780 A02 ROM's territory — the ubiquitous A00 ROM had katakana here and no accents
// at all, which is what CGRAM was for. It tree-shakes away unless imported: lcd injects
// it on request (`createLcdModule(canvas, { glyphs: LATIN_5X7 })`), split-flap's pixel
// print falls back to it, which is where the Nordic drum's Å, Ä and Ö come from.
export const LATIN_5X7: Record<string, string> = {
	Å: `
..#..
.#.#.
..#..
.###.
#...#
#####
#...#`,
	Ä: `
.#.#.
.....
..#..
.#.#.
#...#
#####
#...#`,
	Ö: `
.#.#.
.....
.###.
#...#
#...#
#...#
.###.`,
	Ü: `
.#.#.
.....
#...#
#...#
#...#
#...#
.###.`,
	É: `
...#.
..#..
#####
#....
####.
#....
#####`,
	Ø: `
....#
.###.
#..##
#.#.#
##..#
.###.
#....`,
	Æ: `
.####
#.#..
#.#..
####.
#.#..
#.#..
#.###`,
	Ñ: `
.##.#
.....
#...#
##..#
#.#.#
#..##
#...#`,
	Ç: `
.###.
#...#
#....
#....
#...#
.###.
..#..`,
	å: `
..#..
.#.#.
.###.
....#
.####
#...#
.####`,
	ä: `
.#.#.
.....
.###.
....#
.####
#...#
.####`,
	ö: `
.#.#.
.....
.....
.###.
#...#
#...#
.###.`,
	ü: `
.#.#.
.....
.....
#...#
#...#
#...#
.####`,
	é: `
...#.
..#..
.###.
#...#
#####
#....
.###.`,
	ø: `
....#
.###.
#..##
#.#.#
##..#
.###.
#....`,
	æ: `
.....
.....
.####
#.#.#
.####
#.#..
.####`,
	ñ: `
.##.#
.....
.....
#.##.
##..#
#...#
#...#`,
	ç: `
.....
.....
.###.
#....
#....
.###.
..#..`,
	ß: `
.###.
#...#
#.##.
#...#
#...#
#.##.
#....`,
	'°': `
..#..
.#.#.
..#..
.....
.....
.....
.....`
};
