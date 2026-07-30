// Attract-mode content for the /neon page — everything here is *client* code
// driving the sign through its public API (setText/power/setOptions), the way a
// consuming app would. The shows: the cursive power-cycle hero (the strike
// sequence IS the wow), the dying motel sign, a flashing diner window, a chase
// marquee, a tour of the gas fills, a failing transformer, and free text with the
// full tinker set. All self-playing; every show starts by stating its whole look,
// so switching shows never inherits a stale option.
import type { GasName, NeonArt, NeonSign, NeonSignOptions } from '@glowbox/neon';

export type NeonShow =
	'cocktails' | 'dice' | 'rick' | 'vacancy' | 'open' | 'marquee' | 'gastour' | 'tired' | 'text';

// Sign artwork, authored in nib (a rounded die body + circle pips per die) and
// pasted as SVG path data — the `art` pipeline flattens the cubics into tube
// centrelines. Subpaths stay one piece: a die strikes, ages and dies as one tube.
const DIE_5 = [
	'M 26 8 L 74 8 C 83.941 8 92 16.059 92 26 L 92 74 C 92 83.941 83.941 92 74 92 L 26 92 C 16.059 92 8 83.941 8 74 L 8 26 C 8 16.059 16.059 8 26 8 Z',
	'M 36 28 C 36 32.418 32.418 36 28 36 C 23.582 36 20 32.418 20 28 C 20 23.582 23.582 20 28 20 C 32.418 20 36 23.582 36 28 Z',
	'M 80 28 C 80 32.418 76.418 36 72 36 C 67.582 36 64 32.418 64 28 C 64 23.582 67.582 20 72 20 C 76.418 20 80 23.582 80 28 Z',
	'M 58 50 C 58 54.418 54.418 58 50 58 C 45.582 58 42 54.418 42 50 C 42 45.582 45.582 42 50 42 C 54.418 42 58 45.582 58 50 Z',
	'M 36 72 C 36 76.418 32.418 80 28 80 C 23.582 80 20 76.418 20 72 C 20 67.582 23.582 64 28 64 C 32.418 64 36 67.582 36 72 Z',
	'M 80 72 C 80 76.418 76.418 80 72 80 C 67.582 80 64 76.418 64 72 C 64 67.582 67.582 64 72 64 C 76.418 64 80 67.582 80 72 Z'
];
const DIE_3 = [
	'M 146 8 L 194 8 C 203.941 8 212 16.059 212 26 L 212 74 C 212 83.941 203.941 92 194 92 L 146 92 C 136.059 92 128 83.941 128 74 L 128 26 C 128 16.059 136.059 8 146 8 Z',
	'M 156 28 C 156 32.418 152.418 36 148 36 C 143.582 36 140 32.418 140 28 C 140 23.582 143.582 20 148 20 C 152.418 20 156 23.582 156 28 Z',
	'M 178 50 C 178 54.418 174.418 58 170 58 C 165.582 58 162 54.418 162 50 C 162 45.582 165.582 42 170 42 C 174.418 42 178 45.582 178 50 Z',
	'M 200 72 C 200 76.418 196.418 80 192 80 C 187.582 80 184 76.418 184 72 C 184 67.582 187.582 64 192 64 C 196.418 64 200 67.582 200 72 Z'
];
// The classic overlapping pair, both left of the word: the rear die tucks
// up-and-left; the front die is a solid face (`opaque`) that CUTS the rear
// tubes shy of its edge — glass can't hide glass, so the sign maker ends the
// run where the front die covers it.
const DICE_ART: NeonArt[] = [
	{ d: DIE_3, place: 'left', size: 0.62, rotate: 9, dx: -0.32, dy: -0.22, color: '#7cd5ff' },
	{
		d: DIE_5,
		place: 'left',
		size: 0.74,
		rotate: -11,
		dx: 0.18,
		dy: 0.16,
		color: '#ff3355',
		opaque: true
	}
];

// A border ring for the diner window: a wide rounded rect authored as arc
// commands — wide and snug, so the word fills its window.
const RING =
	'M36 0H224A36 36 0 0 1 260 36V64A36 36 0 0 1 224 100H36A36 36 0 0 1 0 64V36A36 36 0 0 1 36 0Z';

// The cocktails backdrop, after the classic window signs: a martini glass with
// its mouth open to the viewer (rim ellipse, gently curved bowl, elliptical
// foot — the sign maker's cheap 3D), a long swizzle stick leaning out of it,
// and two olives — `opaque`, so they cut the bowl line AND the stick where
// they sit.
const MARTINI = [
	'M2 4a48 9 0 1 0 96 0a48 9 0 1 0 -96 0Z', // the mouth
	'M2 7Q22 44 50 58', // bowl, left run
	'M98 7Q78 44 50 58', // bowl, right run
	'M50 58L50 88', // stem
	'M22 92a28 6 0 1 0 56 0a28 6 0 1 0 -56 0Z' // the foot
];
const STICK = 'M0 78L48 0';
const OLIVES = ['M0 22a9 9 0 1 0 18 0a9 9 0 1 0 -18 0Z', 'M20 10a9 9 0 1 0 18 0a9 9 0 1 0 -18 0Z'];
const COCKTAIL_ART: NeonArt[] = [
	{ d: MARTINI, place: 'behind', size: 2.3, rotate: -5, gas: 'gold' },
	{ d: STICK, place: 'behind', size: 1.15, dx: 0.32, dy: -0.85, gas: 'gold' },
	{ d: OLIVES, place: 'behind', size: 0.42, dx: -0.04, dy: -0.5, gas: 'green', opaque: true }
];

// The tribute portrait — a certain singer, hand-authored as single-stroke
// caricature in ONE 220×280 drawing, split into five pieces that keep their
// registration via the shared `frame`: each part its own glass colour, the
// mic `opaque` so it cuts the jacket lines behind its head.
const RICK_FRAME: [number, number] = [220, 280];
const RICK_HAIR = [
	// Outer mass: tall, cresting high — the quiff has VOLUME.
	'M76 96 C68 78 66 54 74 40 C80 24 90 12 104 6 C124 -2 144 6 150 26 C155 44 152 76 146 96',
	// The fringe — the hair/forehead boundary, rising hard into the front wave.
	'M78 70 C84 64 90 54 94 42 C102 52 116 56 130 58 C137 59 143 63 146 70',
	// The comb direction: the swoosh from the wave up into the mass.
	'M94 42 C100 26 112 16 128 16',
	'M76 96L77 106',
	'M146 96L145 106'
];
const RICK_FACE = [
	'M78 92 C80 114 90 132 111 137 C132 132 142 114 144 92',
	'M74 88 C70 94 72 102 78 104',
	'M148 88 C152 94 150 102 144 104',
	'M88 76 C94 71 102 71 107 75',
	'M115 75 C120 71 128 71 134 76',
	'M92 86 C97 84 101 84 105 86',
	'M117 86 C121 84 125 84 130 86',
	'M112 84 C111 94 109 100 105 104 C108 107 114 107 117 104',
	'M99 117a12 8 0 1 0 24 0a12 8 0 1 0 -24 0Z'
];
const RICK_JACKET = [
	'M97 137 C96 144 95 150 94 153',
	'M125 137 C126 144 127 150 128 153',
	'M94 153 C70 155 48 158 34 166 C26 172 20 184 16 200',
	'M128 153 C152 155 174 158 188 166 C196 172 202 184 206 200',
	'M95 154 C102 170 108 186 112 202',
	'M127 154 C120 170 114 186 110 202',
	'M112 202 C112 224 114 248 118 272',
	'M110 202 C110 224 108 248 104 272'
];
const RICK_SHIRT = [
	'M97 140 C104 148 118 148 125 140',
	'M100 160L122 160',
	'M103 172L119 172',
	'M106 184L116 184'
];
const RICK_MIC = [
	'M64 146 C64 135 108 135 108 146 L103 194 C103 202 69 202 69 194 Z',
	'M67 156L105 156',
	'M68 168L104 168',
	'M69 180L103 180',
	'M86 202L86 278'
];
// Floating eighth-notes — he IS singing: one single, one beamed pair.
const RICK_NOTES = [
	'M168 60a6 4.5 0 1 0 12 0a6 4.5 0 1 0 -12 0Z',
	'M180 58L180 30',
	'M180 30 C186 32 190 38 188 46',
	'M185 100a5 4 0 1 0 10 0a5 4 0 1 0 -10 0Z',
	'M195 98L195 74',
	'M202 94a5 4 0 1 0 10 0a5 4 0 1 0 -10 0Z',
	'M212 92L212 68',
	'M195 74L212 68'
];
const rickPiece = (d: string[], gas: GasName, extra?: Partial<NeonArt>): NeonArt => ({
	d,
	frame: RICK_FRAME,
	place: 'left',
	size: 2.4,
	dx: -0.15,
	dy: -0.05,
	gas,
	...extra
});
const RICK_ART: NeonArt[] = [
	rickPiece(RICK_JACKET, 'argon'),
	rickPiece(RICK_SHIRT, 'gold'),
	rickPiece(RICK_FACE, 'helium'),
	rickPiece(RICK_HAIR, 'neon'), // the ginger quiff in the gas it deserves
	rickPiece(RICK_NOTES, 'gold'),
	rickPiece(RICK_MIC, 'co2', { opaque: true }) // the white tube in front
];

/** Live knobs a show may read (so edits apply without a restart). */
export interface NeonKnobs {
	text(): string;
}

/** A show: start it on a sign, get back its stop(). */
export type NeonShowFn = (sign: NeonSign, knobs: NeonKnobs) => () => void;

// Every show states its full look over this baseline — no inherited leftovers.
const BASE: Partial<NeonSignOptions> = {
	font: 'script',
	art: [],
	color: null,
	gas: 'neon',
	age: 0,
	flicker: 0,
	tired: false,
	program: 'steady',
	tubes: 'auto',
	align: 'center',
	lineSpacing: 1.1, // the core defaults, stated so no show inherits another's
	tilt: 0,
	lineOn: []
};

/** The hero: a rising rose script "Cocktails" across a gold martini glass —
 *  mouth open to the viewer, stick leaning out, green olives cutting the bowl
 *  and the stick — power-cycling to dark glass on the wall, then the staggered
 *  electrode strike. The sequence is the show. */
const makeCocktails: NeonShowFn = (sign) => {
	sign.setOptions({ ...BASE, gas: 'rose', tilt: -14, art: COCKTAIL_ART });
	sign.setText('Cocktails');
	let t1: ReturnType<typeof setTimeout> | null = null;
	let t2: ReturnType<typeof setTimeout> | null = null;
	const loop = () => {
		t1 = setTimeout(() => {
			sign.power(false);
			t2 = setTimeout(() => {
				sign.power(true);
				loop();
			}, 1700);
		}, 5600);
	};
	loop();
	return () => {
		if (t1) clearTimeout(t1);
		if (t2) clearTimeout(t2);
		sign.power(true);
	};
};

/** The recurring theme: the tribute portrait beside the words, power-cycling
 *  forever — this sign is never gonna give you up. */
const makeRick: NeonShowFn = (sign) => {
	sign.setOptions({ ...BASE, gas: 'rose', tilt: -8, lineSpacing: 1.15, art: RICK_ART });
	sign.setText('Never gonna\ngive you up');
	const loop = setInterval(() => {
		sign.power(false);
		setTimeout(() => sign.power(true), 1400);
	}, 9500);
	return () => {
		clearInterval(loop);
		sign.power(true);
	};
};

/** The motel gag: a worn two-line NO / VACANCY on per-glyph tubes, one line red,
 *  one ice-blue — the sign is old, so some letter is dying and the wear decides
 *  which. The NO rides its own circuit (`lineOn`): the motel fills and empties,
 *  the NO strikes in and cuts out while its glass stays on the wall. */
const makeVacancy: NeonShowFn = (sign) => {
	sign.setOptions({
		...BASE,
		font: 'sans',
		tubes: 'glyph',
		color: ['#ff3b30', '#7cd5ff'],
		age: 0.88,
		flicker: 0.25,
		lineSpacing: 1.25
	});
	sign.setText('NO\nVACANCY');
	let full = true;
	const timer = setInterval(() => {
		full = !full;
		sign.setOptions({ lineOn: [full] });
	}, 6000);
	return () => clearInterval(timer);
};

/** The dice sign: two nib-authored dice flanking the word — each die its own
 *  tube in its own colour. Every few seconds the sign re-glasses (a re-roll):
 *  the dice strike back in with the word. */
const makeDice: NeonShowFn = (sign) => {
	sign.setOptions({ ...BASE, gas: 'co2', art: DICE_ART });
	sign.setText('dice');
	const loop = setInterval(() => {
		sign.power(false);
		setTimeout(() => sign.power(true), 1200);
	}, 7000);
	return () => {
		clearInterval(loop);
		sign.setOptions({ art: [] });
		sign.power(true);
	};
};

/** The diner window: script "Open" on the flasher cam, ringed by a border tube
 *  placed BEHIND the word — the border lights first under 'reveal'. */
const makeOpen: NeonShowFn = (sign) => {
	sign.setOptions({
		...BASE,
		program: 'flash',
		speed: 0.8,
		art: [{ d: RING, place: 'behind', size: 1.3, gas: 'argon', steady: true }]
	});
	sign.setText('Open');
	return () => sign.setOptions({ art: [] });
};

/** The chase marquee: gold block letters, a dark slot running the line. */
const makeMarquee: NeonShowFn = (sign) => {
	sign.setOptions({ ...BASE, font: 'sans', gas: 'gold', program: 'chase', speed: 1.3 });
	sign.setText('LIVE MUSIC');
	return () => undefined;
};

/** What's in the glass: every gas preset in turn, named in its own light —
 *  each step re-glasses, so each gas gets its strike. */
const makeGasTour: NeonShowFn = (sign) => {
	const gases: GasName[] = ['neon', 'argon', 'helium', 'co2', 'green', 'gold', 'rose'];
	sign.setOptions({ ...BASE });
	let i = 0;
	const step = () => {
		const gas = gases[i % gases.length];
		i++;
		sign.setOptions({ gas });
		sign.setText(gas === 'co2' ? 'CO2' : gas[0].toUpperCase() + gas.slice(1));
	};
	step();
	const timer = setInterval(step, 3400);
	return () => clearInterval(timer);
};

/** The failing transformer: whole-sign dropouts and staggered re-strikes —
 *  turn SOUND on; the hum dies with the light. */
const makeTired: NeonShowFn = (sign) => {
	sign.setOptions({ ...BASE, font: 'sans', gas: 'argon', tired: true, age: 0.35 });
	sign.setText('COLD BEER');
	return () => undefined;
};

/** Free text — the page's tinker controls (font, gas, wear, flicker, program)
 *  ride on top while this show is active. */
const makeText: NeonShowFn = (sign, knobs) => {
	sign.setOptions({ ...BASE });
	sign.setText(knobs.text());
	return () => undefined;
};

export const NEON_SHOWS: Record<NeonShow, NeonShowFn> = {
	cocktails: makeCocktails,
	dice: makeDice,
	rick: makeRick,
	vacancy: makeVacancy,
	open: makeOpen,
	marquee: makeMarquee,
	gastour: makeGasTour,
	tired: makeTired,
	text: makeText
};
