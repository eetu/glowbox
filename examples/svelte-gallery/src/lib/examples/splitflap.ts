// Attract-mode content for the /splitflap page — everything here is *client* code
// driving the board through its public API (setText/setLine/setOptions/cellAt), the
// way a consuming app would. The shows: a departure board (the display's home turf —
// the top train leaves, every row shifts up, the whole board cascades), a flip clock
// with the date, free text from an input, three board *games* of the self-playing
// kind (matrix rain, snake, pong) that swap in tiny custom drums, a chroma show —
// colour-flap drums cycling a slideshow of scenes as flap-pixels — and three
// tappable ones pairing drum zones with `cellAt` hit-testing: counter and poll
// self-play between taps; the scroller holds still (its text is a story — the
// reading pace belongs to the reader).
import { decodeGif, frameAt, type GifFrame, sampleImageToGrid } from '@glowbox/extras';
import {
	chromaDrum,
	DEFAULT_CHARSET,
	DRUM_DIGITS,
	paletteFrame,
	type SplitFlapBoard
} from '@glowbox/split-flap';

import chromaUrl from './chroma.gif?url';

export type FlapShow =
	| 'departures'
	| 'clock'
	| 'text'
	| 'counter'
	| 'scroller'
	| 'poll'
	| 'chroma'
	| 'matrix'
	| 'snake'
	| 'pong';

/** The chroma show's drum choices — all `chromaDrum` recipes, coarse to fine.
 *  Mono is the newsprint wall; Ultra pays its 81-flap wraps in longer cascades. */
export const CHROMA_KINDS = {
	mono: { hues: 0, grays: 10 },
	coarse: { hues: 6, shades: 2, grays: 4 },
	rich: {},
	ultra: { hues: 18, shades: 4, grays: 8 }
} as const;
export type ChromaKind = keyof typeof CHROMA_KINDS;

/** Live knobs a show may read every step (so edits apply without a restart). */
export interface FlapKnobs {
	text(): string;
	chroma(): ChromaKind;
	/** The element to take pointer input from (the board's stage), if any. */
	stage(): HTMLElement | undefined;
}

/** A show: start it on a board, get back its stop(). */
export type FlapShowFn = (board: SplitFlapBoard, knobs: FlapKnobs) => () => void;

const pad = (n: number) => String(n).padStart(2, '0');
const center = (s: string, cols: number) =>
	' '.repeat(Math.max(0, Math.floor((cols - s.length) / 2))) + s;

// --- departures ------------------------------------------------------------------

// Stations of the Finnish rail map — the default drum carries ÅÄÖ, so Jyväskylä
// rides along.
const DESTS = [
	'HELSINKI',
	'TAMPERE',
	'TURKU',
	'OULU',
	'ROVANIEMI',
	'JYVÄSKYLÄ',
	'SEINÄJOKI',
	'PIEKSÄMÄKI',
	'RIIHIMÄKI',
	'JÄRVENPÄÄ',
	'KUOPIO',
	'JOENSUU',
	'VAASA',
	'KOTKA',
	'LAHTI',
	'PORI',
	'KEMI',
	'KAJAANI',
	'MIKKELI',
	'IMATRA',
	'HANKO',
	'KOLARI',
	'KOKKOLA',
	'IISALMI'
];

// The track column's drum: digits plus ONE special flap, the way the real
// boards did it (a duplicated red alphabet would double the drum and slow
// every flip): flap 'x' prints as a red X — the cancelled-platform mark.
const TRACK_DRUM = ' 0123456789x';
const DEPARTURE_FACES = { x: { glyph: 'X', ink: '#d64541' } };

/** The canonical split-flap scene. Fictional trains depart the top row every few
 *  seconds: the rows shift up and a new service flips in at the bottom — the
 *  full-board cascade that made these things famous. Built the way the real
 *  boards were: the time and track columns are `drums` zones on dedicated short
 *  drums, so a minute rollover wraps in a few flips instead of cascading
 *  through the whole alphabet. Late trains lose their platform to a red X —
 *  one dedicated flap on the track drum (`FlapFace`). */
export const makeDepartures: FlapShowFn = (board) => {
	const { cols, rows } = board;
	board.setOptions({
		charset: DEFAULT_CHARSET,
		palette: DEPARTURE_FACES,
		drums: [
			{ x: 0, y: 0, cols: 5, rows, charset: DRUM_DIGITS },
			{ x: cols - 2, y: 0, cols: 2, rows, charset: TRACK_DRUM }
		]
	});
	const destW = Math.max(4, cols - 8); // 'HH:MM <dest> NN'
	type Entry = { min: number; dest: string; trk: number; late: boolean };
	const now = new Date();
	let clock = now.getHours() * 60 + now.getMinutes();
	const entries: Entry[] = [];
	const randDest = () => DESTS[Math.floor(Math.random() * DESTS.length)];
	const push = () => {
		const lastMin = entries.length ? entries[entries.length - 1].min : clock + 2;
		entries.push({
			min: lastMin + 2 + Math.floor(Math.random() * 9),
			dest: randDest(),
			trk: 1 + Math.floor(Math.random() * 12),
			late: Math.random() < 0.2
		});
	};
	for (let i = 0; i < rows; i++) push();
	const render = () => {
		board.setText(
			entries.map(
				(e) =>
					`${pad(((e.min / 60) | 0) % 24)}:${pad(e.min % 60)} ` +
					`${e.dest.slice(0, destW).padEnd(destW)}` +
					(e.late ? ' x' : String(e.trk).padStart(2))
			)
		);
	};
	render();
	// A departure every few seconds — time itself runs theatrically fast here.
	const id = setInterval(() => {
		clock = entries[0].min;
		entries.shift();
		push();
		render();
	}, 6500);
	return () => {
		clearInterval(id);
		board.setOptions({ charset: DEFAULT_CHARSET, palette: {}, drums: [] });
	};
};

// --- clock -------------------------------------------------------------------------

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** Date + seconds clock — the seconds modules earn a flip (and a clack) every
 *  second, and each :59 → :00 rollover is a wrap-through: forward-only drums
 *  can't count down. */
export const makeClock: FlapShowFn = (board) => {
	const draw = () => {
		const { cols, rows } = board;
		const t = new Date();
		const date = `${DAYS[t.getDay()]} ${pad(t.getDate())} ${MONTHS[t.getMonth()]}`;
		const time = `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
		const lines = new Array<string>(rows).fill('');
		if (rows >= 2) {
			const mid = Math.floor((rows - 2) / 2);
			lines[mid] = center(date, cols);
			lines[mid + 1] = center(time, cols);
		} else {
			lines[0] = center(time, cols);
		}
		board.setText(lines);
	};
	draw();
	const id = setInterval(draw, 250);
	return () => clearInterval(id);
};

// --- text ---------------------------------------------------------------------------

/** Free text, word-wrapped and centred. Reads the knob continuously — typing
 *  spins only the modules whose character actually changed. */
export const makeText: FlapShowFn = (board, { text }) => {
	let last: string | null = null;
	const apply = () => {
		const msg = (text().trim() || 'GLOWBOX SPLIT-FLAP').toUpperCase();
		if (msg === last) return;
		last = msg;
		const { cols, rows } = board;
		const lines: string[] = [];
		let line = '';
		for (const word of msg.split(/\s+/)) {
			const fit = word.slice(0, cols);
			if (!line.length) line = fit;
			else if (line.length + 1 + fit.length <= cols) line += ' ' + fit;
			else {
				lines.push(line);
				line = fit;
			}
		}
		if (line) lines.push(line);
		const block = lines.slice(0, rows).map((l) => center(l, cols));
		const top = Math.floor((rows - block.length) / 2);
		board.setText([...new Array<string>(top).fill(''), ...block]);
	};
	apply();
	const id = setInterval(apply, 300);
	return () => clearInterval(id);
};

// --- counter ------------------------------------------------------------------------

/** A mechanical tally counter: tap/click the board to increment — every count
 *  earns its flips (and, sound on, its clacks). Runs on `DRUM_DIGITS`, the
 *  dedicated digit module, so a 9 → 0 rollover wraps in a couple of flips and
 *  0999 → 1000 is the odometer moment. Zero-padded, wraps at 10000. */
export const makeCounter: FlapShowFn = (board, { stage }) => {
	board.setOptions({ charset: DRUM_DIGITS });
	let count = 0;
	const draw = () => {
		const { cols, rows } = board;
		const lines = new Array<string>(rows).fill('');
		lines[Math.floor((rows - 1) / 2)] = center(String(count % 10000).padStart(4, '0'), cols);
		board.setText(lines);
	};
	const el = stage();
	const onClick = () => {
		count++;
		draw();
	};
	el?.addEventListener('click', onClick);
	draw();
	return () => {
		el?.removeEventListener('click', onClick);
		board.setOptions({ charset: DEFAULT_CHARSET });
	};
};

// --- scroller -----------------------------------------------------------------------

// What the scroller scrolls: a story, for whoever actually reads the board.
// Every line fits the default 18-wide panel (≤17 characters, rail excluded),
// and every character rides the Nordic drum.
const STORY = [
	'AT THE EDGE',
	'OF THE CITY,',
	'WHERE BUSES TURN',
	'AND NO ONE WAITS,',
	'STANDS A BOARD',
	'OF FORTY FLAPS.',
	'',
	'THE MALL GOT LED.',
	'THE STATION TOO.',
	'SHE WAS NOT.',
	'',
	'TOO FAR OUT,',
	'TOO FEW RIDERS,',
	'TOO MANY WASPS.',
	'',
	'A BOY COMES',
	'EVERY SUNDAY.',
	'HE BRUSHES OFF',
	'THE SPIDERWEBS,',
	'LIFTS WASP NESTS',
	'FROM HER FRAME,',
	'OILS EVERY HINGE.',
	'',
	'ONE DUSK HE SAYS:',
	'I LOVE THE WAY',
	'YOU FLIP. I LOVE',
	'THE WAY YOU FLAP.',
	'',
	'SHE CAN ANSWER',
	'ONLY WITH WHAT',
	'HER DRUMS HOLD.',
	'ALL NIGHT SHE',
	'SPINS TIMETABLES',
	'TILL THEY READ:',
	'',
	'00:00 TO ANYWHERE',
	'WITH YOU, TRACK 1',
	'',
	'THE LED CREW CAME',
	'IN SPRING. THEY',
	'FOUND BOLT HOLES,',
	'NO BOARD AT ALL.',
	'',
	'BUT IN A BEDROOM',
	'AT THE EDGE',
	'OF THE CITY,',
	'SOMETHING CLACKS',
	'SOFTLY, EVERY',
	'TIME THE BOY',
	'SAYS GOODNIGHT.',
	'',
	'(THE END)'
];

/** A text longer than the board, scrolled with a scrollbar built FROM the panel
 *  itself — the reason `cellAt` and drum zones exist together. The right-hand
 *  column rides a five-flap rail drum (arrows, track, thumb), so the thumb
 *  lands in a flip or two instead of wrapping an alphabet. Tap the arrows to
 *  turn a page, the rail to jump. The one show that holds still: the text is a
 *  story, and reading pace belongs to the reader. */
export const makeScroller: FlapShowFn = (board, { stage }) => {
	const { cols, rows } = board;
	board.setOptions({ drums: [{ x: cols - 1, y: 0, cols: 1, rows, charset: ' ▲▼░█' }] });
	const lines = STORY;
	const max = Math.max(0, lines.length - rows);
	const inner = rows - 2; // rail rows between the arrows
	let top = 0;
	const railChar = (y: number, thumb: number) => {
		if (y === 0) return '▲';
		if (y === rows - 1) return '▼';
		return y - 1 === thumb ? '█' : '░';
	};
	const render = () => {
		const thumb = inner > 1 ? Math.round((top / Math.max(1, max)) * (inner - 1)) : 0;
		board.setText(
			Array.from(
				{ length: rows },
				(_, y) => (lines[top + y] ?? '').slice(0, cols - 1).padEnd(cols - 1) + railChar(y, thumb)
			)
		);
	};
	const jump = (t: number) => {
		top = Math.max(0, Math.min(max, t));
		render();
	};
	const el = stage();
	const onClick = (e: MouseEvent) => {
		const cell = board.cellAt(e.clientX, e.clientY);
		if (!cell || cell.x !== cols - 1) return;
		// The arrows page — a board-height of story per tap; the rail jumps.
		if (cell.y === 0) jump(top - rows);
		else if (cell.y === rows - 1) jump(top + rows);
		else if (inner > 1) jump(Math.round(((cell.y - 1) / (inner - 1)) * max));
	};
	el?.addEventListener('click', onClick);
	render();
	return () => {
		el?.removeEventListener('click', onClick);
		board.setOptions({ drums: [] });
	};
};

// --- poll ---------------------------------------------------------------------------

// One row per display core; each bar rides a chroma flap of its own colour.
const POLL = [
	{ name: 'LED', key: 'l', color: '#5dd39e' },
	{ name: 'NIXIE', key: 'n', color: '#ff9d47' },
	{ name: '7SEG', key: 's', color: '#ef5350' },
	{ name: 'DOTS', key: 'd', color: '#ffe066' },
	{ name: 'FLAPS', key: 'f', color: '#7ec8ff' }
] as const;

/** A straw poll across the glowbox family: tap a row to vote for a core. Three
 *  drum kinds share one board — letters for the names, a five-colour chroma
 *  drum for the bars, `DRUM_DIGITS` for the tallies — and when a bar hits the
 *  edge, every bar halves: renormalisation as a full-board cascade. Votes
 *  trickle in on their own; taps pile on. */
export const makePoll: FlapShowFn = (board, { stage }) => {
	const { cols, rows } = board;
	const C = Math.min(POLL.length, rows);
	const y0 = rows > C ? 1 : 0; // a spare top row becomes the header
	const nameW = 6;
	const countW = 3;
	const barW = Math.max(1, cols - nameW - countW);
	board.setOptions({
		palette: Object.fromEntries(POLL.map((p) => [p.key, p.color])),
		drums: [
			{ x: nameW, y: y0, cols: barW, rows: C, charset: ' ' + POLL.map((p) => p.key).join('') },
			{ x: nameW + barW, y: y0, cols: countW, rows: C, charset: DRUM_DIGITS }
		]
	});
	const total = POLL.slice(0, C).map(() => 1 + Math.floor(Math.random() * 5));
	const bar = total.map((t) => Math.min(t, barW));
	let holdUntil = 0;
	const render = () => {
		const out = y0 ? [center('TAP A ROW TO VOTE', cols)] : [];
		for (let i = 0; i < C; i++)
			out.push(
				POLL[i].name.padEnd(nameW) +
					POLL[i].key.repeat(bar[i]).padEnd(barW) +
					String(Math.min(total[i], 999)).padStart(countW)
			);
		board.setText(out);
	};
	const vote = (i: number) => {
		total[i]++;
		// A bar off the edge renormalises the whole field — every bar halves, and
		// shrinking on a forward-only drum is the cascade the medium is famous for.
		if (++bar[i] > barW) for (let j = 0; j < C; j++) bar[j] = Math.ceil(bar[j] / 2);
		render();
	};
	const el = stage();
	const onClick = (e: MouseEvent) => {
		const cell = board.cellAt(e.clientX, e.clientY);
		if (!cell) return;
		const i = cell.y - y0;
		if (i < 0 || i >= C) return;
		holdUntil = Date.now() + 5000;
		vote(i);
	};
	el?.addEventListener('click', onClick);
	render();
	const id = setInterval(() => {
		if (Date.now() < holdUntil) return;
		vote(Math.floor(Math.random() * C));
	}, 1300);
	return () => {
		clearInterval(id);
		el?.removeEventListener('click', onClick);
		board.setOptions({ palette: {}, drums: [] });
	};
};

// --- chroma -------------------------------------------------------------------------

// The image drums, generated on demand and cached — a grey ramp plus the hue
// ring laid serpentine, so gradients are neighbouring flaps (see `chromaDrum`
// in @glowbox/split-flap).
const drumCache = new Map<ChromaKind, ReturnType<typeof chromaDrum>>();
const drumFor = (kind: ChromaKind) => {
	let d = drumCache.get(kind);
	if (!d) {
		d = chromaDrum(CHROMA_KINDS[kind]);
		drumCache.set(kind, d);
	}
	return d;
};

/** The chroma-flap installation: solid-colour drums, and the board is suddenly
 *  a (very) low-res screen. Plays `chroma.gif` — a purpose-built slideshow of
 *  five low-detail postcard photographs (sea sky, golden hills, sunset, aurora,
 *  full moon) pre-scaled to 80×40 with EIGHT-SECOND frame delays baked into the
 *  GIF, because this medium is stop-motion: a hue change can cost most of a
 *  drum wrap, so each picture must hold while the thousand-card cascade lands.
 *  The lineup follows the ONE-ICON-PER-FRAME rule — at 40×20 flap-pixels a
 *  photograph's composition is mush; only a single bold subject on a plain
 *  field survives the quantisation: a painterly sunset over the sea, a
 *  snow-capped peak, a snowy spruce, the full moon, Earth floating in space,
 *  a rainbow plasma. All six frames are generated locally — no sourcing, no
 *  attribution burden. */
export const makeChroma: FlapShowFn = (board, { chroma }) => {
	const c0 = board.cols;
	const r0 = board.rows;
	// The image grid rides the panel resolution: double the columns, square
	// flap-pixels at the canvas's 2:1 (so 18-wide text panel → 36×18 image).
	const COLS = Math.min(96, c0 * 2);
	const ROWS = Math.round(COLS / 2);
	let kind = chroma();
	let drum = drumFor(kind);
	board.setOptions({ cols: COLS, rows: ROWS, charset: drum.charset, palette: drum.palette });
	let frames: GifFrame[] | null = null;
	let raf = 0;
	let start = 0;
	let last = -1;
	void decodeGif(chromaUrl).then((f) => {
		frames = f;
	});
	const step = (now: number) => {
		raf = requestAnimationFrame(step);
		if (!frames || frames.length === 0) return;
		if (!start) start = now;
		if (chroma() !== kind) {
			// Re-carding the modules live: swap the drum, then re-map the current
			// frame so the picture corrects itself on the new complement.
			kind = chroma();
			drum = drumFor(kind);
			board.setOptions({ charset: drum.charset, palette: drum.palette });
			last = -1;
		}
		const idx = frameAt(frames, now - start);
		if (idx === last) return;
		last = idx;
		const s = sampleImageToGrid(frames[idx].src, COLS, ROWS, 'contain');
		const rgb = new Float32Array(COLS * ROWS * 3);
		for (let y = 0; y < ROWS; y++)
			for (let x = 0; x < COLS; x++) {
				// GridSample is y-up (LED grids count from the bottom); the board is y-down.
				const si = (ROWS - 1 - y) * COLS + x;
				const di = (y * COLS + x) * 3;
				const a = s.alpha[si];
				rgb[di] = s.rgb[si * 3] * a;
				rgb[di + 1] = s.rgb[si * 3 + 1] * a;
				rgb[di + 2] = s.rgb[si * 3 + 2] * a;
			}
		board.setText(paletteFrame(rgb, COLS, ROWS, drum.palette));
	};
	raf = requestAnimationFrame(step);
	return () => {
		cancelAnimationFrame(raf);
		board.setOptions({ cols: c0, rows: r0, charset: DEFAULT_CHARSET, palette: {} });
	};
};

// --- board games --------------------------------------------------------------------
// Self-playing (the gallery is attract-mode by house rule). Each swaps in a
// custom drum sized to its content: on a forward-only drum, *erasing* a cell
// means wrapping all the way to blank, so a short flap sequence is the
// difference between a crisp move and three seconds of churn.

/** Digital rain on the authentic drum: the film's glyphs are half-width
 *  katakana with a few digits (ours print upright — the cards are honest even
 *  if the CRT wasn't). A short drum keeps the trail-erase honest too: heads
 *  paint random glyphs, tails wipe to blank a few flips later, and the board
 *  never stops muttering. */
export const makeMatrix: FlapShowFn = (board) => {
	const { cols, rows } = board;
	const RAIN = ' ﾊﾐﾋｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃ0179:';
	board.setOptions({ charset: RAIN });
	const cells = new Array<string>(cols * rows).fill(' ');
	const head = new Float32Array(cols);
	const speed = new Float32Array(cols);
	const trail = new Float32Array(cols);
	const reset = (x: number) => {
		head[x] = -1 - Math.random() * rows;
		speed[x] = 0.5 + Math.random();
		trail[x] = 3 + Math.random() * 4;
	};
	for (let x = 0; x < cols; x++) {
		reset(x);
		head[x] = Math.random() * rows * 2 - rows; // initial scatter, some already raining
	}
	const glyph = () => RAIN[1 + Math.floor(Math.random() * (RAIN.length - 1))];
	const step = () => {
		for (let x = 0; x < cols; x++) {
			const prev = Math.floor(head[x]);
			head[x] += speed[x];
			const cur = Math.floor(head[x]);
			for (let y = prev + 1; y <= cur; y++) {
				if (y >= 0 && y < rows) cells[y * cols + x] = glyph();
				const e = y - Math.round(trail[x]);
				if (e >= 0 && e < rows) cells[e * cols + x] = ' ';
			}
			if (cur - trail[x] > rows) reset(x);
		}
		board.setText(
			Array.from({ length: rows }, (_, y) => cells.slice(y * cols, (y + 1) * cols).join(''))
		);
	};
	step();
	const id = setInterval(step, 160);
	return () => {
		clearInterval(id);
		board.setOptions({ charset: DEFAULT_CHARSET });
	};
};

type P = { x: number; y: number };

/** Snake on a three-flap drum (blank / block / snack). Head lands in one flip;
 *  the tail's erase wraps past the snack flap, leaving a brief 'O' crumb behind
 *  the snake — the drum's honest ghost, trailing where it charms. The autopilot
 *  chases the food greedily, wraps the edges, and restarts when it corners
 *  itself. */
export const makeSnake: FlapShowFn = (board) => {
	const { cols, rows } = board;
	board.setOptions({ charset: ' █O' });
	let snake: P[] = [];
	let dir: P = { x: 1, y: 0 };
	let food: P = { x: 0, y: 0 };
	const eq = (a: P, b: P) => a.x === b.x && a.y === b.y;
	const spawnFood = () => {
		do food = { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows) };
		while (snake.some((s) => eq(s, food)));
	};
	const reset = () => {
		const y = Math.floor(rows / 2);
		snake = [
			{ x: 3, y },
			{ x: 2, y },
			{ x: 1, y }
		];
		dir = { x: 1, y: 0 };
		spawnFood();
	};
	reset();
	// Toroidal distance — the snake happily exits stage left.
	const dist = (a: P, b: P) =>
		Math.min(Math.abs(a.x - b.x), cols - Math.abs(a.x - b.x)) +
		Math.min(Math.abs(a.y - b.y), rows - Math.abs(a.y - b.y));
	const step = () => {
		const headP = snake[0];
		let best: P | null = null;
		let bestScore = Infinity;
		for (const d of [dir, { x: dir.y, y: dir.x }, { x: -dir.y, y: -dir.x }]) {
			const nxt = { x: (headP.x + d.x + cols) % cols, y: (headP.y + d.y + rows) % rows };
			// The tail cell is safe — it moves away this same turn (unless we grow).
			const body = snake.slice(0, -1).some((s) => eq(s, nxt));
			const score = dist(nxt, food) + (body ? 1000 : 0);
			if (score < bestScore) {
				bestScore = score;
				best = d;
			}
		}
		if (!best || bestScore >= 1000) {
			reset(); // cornered — a fresh snake, the split-flap way (everything re-flips)
		} else {
			dir = best;
			const nxt = { x: (headP.x + dir.x + cols) % cols, y: (headP.y + dir.y + rows) % rows };
			snake.unshift(nxt);
			if (eq(nxt, food)) spawnFood();
			else snake.pop();
		}
		const cells = new Array<string>(cols * rows).fill(' ');
		cells[food.y * cols + food.x] = 'O';
		for (const s of snake) cells[s.y * cols + s.x] = '█';
		board.setText(
			Array.from({ length: rows }, (_, y) => cells.slice(y * cols, (y + 1) * cols).join(''))
		);
	};
	step();
	const id = setInterval(step, 170);
	return () => {
		clearInterval(id);
		board.setOptions({ charset: DEFAULT_CHARSET });
	};
};

/** Pong. Two block paddles rally a ball; the returns are honest (spin from the
 *  hit offset) and the paddles slightly lazy, so someone eventually misses and
 *  the board takes a breath before the next serve. Drum order matters on three
 *  flaps: with ' O█' the ball lands in ONE flip and its erase ghosts a block
 *  *behind* the motion — a phosphor trail, not a leading artefact. */
export const makePong: FlapShowFn = (board) => {
	const { cols, rows } = board;
	board.setOptions({ charset: ' O█' });
	const HALF = Math.max(1, Math.round(rows / 6)); // paddle half-height
	let bx = cols / 2;
	let by = Math.random() * rows;
	let vx = 0.9;
	let vy = 0.5;
	let pl = rows / 2;
	let pr = rows / 2;
	let pause = 0;
	const chase = (p: number, want: boolean) =>
		p + Math.max(-0.55, Math.min(0.55, (want ? by : rows / 2) - p));
	const step = () => {
		if (pause > 0 && --pause === 0) {
			bx = cols / 2;
			by = Math.random() * (rows - 1);
			vx = Math.random() < 0.5 ? 0.9 : -0.9;
			vy = (Math.random() - 0.5) * 1.2;
		} else if (pause === 0) {
			bx += vx;
			by += vy;
			if (by < 0) {
				by = -by;
				vy = -vy;
			}
			if (by > rows - 1) {
				by = 2 * (rows - 1) - by;
				vy = -vy;
			}
			pl = chase(pl, vx < 0);
			pr = chase(pr, vx > 0);
			if (bx <= 1 && vx < 0 && Math.abs(by - pl) <= HALF + 0.6) {
				bx = 1;
				vx = -vx;
				vy = Math.max(-0.9, Math.min(0.9, vy + (by - pl) * 0.35));
			}
			if (bx >= cols - 2 && vx > 0 && Math.abs(by - pr) <= HALF + 0.6) {
				bx = cols - 2;
				vx = -vx;
				vy = Math.max(-0.9, Math.min(0.9, vy + (by - pr) * 0.35));
			}
			if (bx < -1 || bx > cols) pause = 8;
		}
		const cells = new Array<string>(cols * rows).fill(' ');
		for (let y = 0; y < rows; y++) {
			if (Math.abs(y - pl) <= HALF) cells[y * cols] = '█';
			if (Math.abs(y - pr) <= HALF) cells[y * cols + cols - 1] = '█';
		}
		if (pause === 0) {
			const x = Math.round(bx);
			const y = Math.round(by);
			if (x >= 0 && x < cols && y >= 0 && y < rows) cells[y * cols + x] = 'O';
		}
		board.setText(
			Array.from({ length: rows }, (_, y) => cells.slice(y * cols, (y + 1) * cols).join(''))
		);
	};
	step();
	const id = setInterval(step, 140);
	return () => {
		clearInterval(id);
		board.setOptions({ charset: DEFAULT_CHARSET });
	};
};

export const FLAP_SHOWS: Record<FlapShow, FlapShowFn> = {
	departures: makeDepartures,
	clock: makeClock,
	text: makeText,
	counter: makeCounter,
	scroller: makeScroller,
	poll: makePoll,
	chroma: makeChroma,
	matrix: makeMatrix,
	snake: makeSnake,
	pong: makePong
};
