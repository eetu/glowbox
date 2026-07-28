// The drum, as arithmetic. A split-flap module can only rotate FORWARD through its
// flap sequence — the drum is a ratchet, not a dial — so "how far is B from A" is a
// modular distance, and reaching an *earlier* character means cycling the whole way
// around. That constraint is the display's signature (the cascading wrap-through),
// and it lives here as pure, node-testable functions the renderer builds on.

// Drum presets. A drum is just a string (index order IS flip order), so presets
// cost bytes — pass any of these as `charset`, or roll your own. Blank rides
// first on all of them: a fresh module shows nothing.

/** The classic 40-flap alphanumeric drum: A–Z, digits, the timetable marks. */
export const DRUM_ALNUM = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:.-';
/** The Nordic 53-flap drum: ÅÄÖ after Z in alphabet order (these boards live in
 *  Finnish stations), plus the punctuation everyday strings actually carry —
 *  parentheses, the at-sign, comma, apostrophe, ampersand, plus. Rarer marks
 *  belong on a custom drum: every flap taxes every wrap. */
export const DRUM_NORDIC = " ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ0123456789:./-?!()@,'&+";
/** The dedicated 14-flap digit module — real boards used these for time and
 *  track columns; short drum, short wraps, snappy rollovers. */
export const DRUM_DIGITS = ' 0123456789:.-';

/** The default drum (= `DRUM_NORDIC`; a colon on board, because a display
 *  spends its life showing times — and ASCII users lose little to the extra
 *  flaps). */
export const DEFAULT_CHARSET = DRUM_NORDIC;

/** Split a string into its flap sequence — by *grapheme* where the platform has
 *  Intl.Segmenter (everywhere modern), by code point otherwise. A flap is
 *  whatever prints on one card: a half-width katakana with its combining
 *  dakuten, an emoji, a box glyph — custom drums take them all. */
export const flapsOf = (charset: string): string[] =>
	typeof Intl !== 'undefined' && 'Segmenter' in Intl
		? Array.from(new Intl.Segmenter().segment(charset), (s) => s.segment)
		: [...charset];

/** Where a character sits on the drum: exact match first, then its uppercase
 *  (drums are usually caps-only), else the blank flap (or flap 0 on a drum
 *  without one) — an unprintable character shows as empty, like the real
 *  boards' controllers do. Input is NFC-normalised so a decomposed Ä (A +
 *  combining diaeresis, the macOS-filename kind) still finds its flap. */
export function flapIndex(flaps: string[], ch: string): number {
	ch = ch.normalize('NFC');
	let i = flaps.indexOf(ch);
	if (i < 0) i = flaps.indexOf(ch.toUpperCase());
	if (i < 0) i = flaps.indexOf(' ');
	return i < 0 ? 0 : i;
}

/** Flips needed to advance from flap `from` to flap `to` — forward only. */
export const stepsBetween = (from: number, to: number, n: number): number =>
	(((to - from) % n) + n) % n;

/** A display line as the module row sees it: exactly `cols` cells, one flap
 *  each (grapheme-aware — kana and emoji count as one cell, not their code
 *  units). */
export function padCells(line: string, cols: number): string[] {
	const cells = flapsOf(line).slice(0, cols);
	while (cells.length < cols) cells.push(' ');
	return cells;
}
