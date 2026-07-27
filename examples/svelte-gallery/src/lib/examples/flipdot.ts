// Attract-mode content for the /flipdot page — everything here is *client* code
// driving the board through its public API (setFrame + ditherFrame), the way a
// consuming app would. Four shows: a clock (with a seconds sweep so the board
// keeps ticking), the SAME loop.gif the LED grid plays — dithered to one bit,
// a plasma field (ordered dither under animation), and a text marquee.
import { decodeGif, frameAt, type GifFrame, glyph5x7, sampleImageToGrid } from '@glowbox/extras';
import {
	createMechSound,
	ditherFrame,
	type DitherMode,
	type FlipDotBoard
} from '@glowbox/flip-dot';

import loopUrl from './loop.gif?url';

export type FlipShow = 'clock' | 'gif' | 'plasma' | 'marquee' | 'counter';

/** Live knobs a show may read every step (so edits apply without a restart). */
export interface ShowKnobs {
	dither(): DitherMode;
	text(): string;
	/** The page's sound volume (0 = off) — shows with their own audio follow it. */
	sound(): number;
	/** The element to take pointer input from (the board's stage), if any. */
	stage(): HTMLElement | undefined;
}

/** A show: start it on a board, get back its stop(). */
export type ShowFn = (board: FlipDotBoard, knobs: ShowKnobs) => () => void;

// --- 5×7 text onto a bit frame ------------------------------------------------

const drawString = (
	bits: Uint8Array,
	cols: number,
	rows: number,
	str: string,
	x0: number,
	y0: number,
	scale: number
) => {
	const set = (x: number, y: number) => {
		if (x >= 0 && x < cols && y >= 0 && y < rows) bits[y * cols + x] = 1;
	};
	let cx = x0;
	for (const ch of str) {
		if (ch === ':') {
			// A clock colon is a single dot column — a full 5-wide glyph reads bloated.
			for (const gy of [2, 4])
				for (let sy = 0; sy < scale; sy++)
					for (let sx = 0; sx < scale; sx++) set(cx + sx, y0 + gy * scale + sy);
			cx += scale * 2;
			continue;
		}
		const rowsG = glyph5x7(ch);
		for (let gy = 0; gy < 7; gy++) {
			const b = rowsG[gy];
			if (!b) continue;
			for (let gx = 0; gx < 5; gx++) {
				if (!((b >> (4 - gx)) & 1)) continue;
				for (let sy = 0; sy < scale; sy++)
					for (let sx = 0; sx < scale; sx++) set(cx + gx * scale + sx, y0 + gy * scale + sy);
			}
		}
		cx += scale * 6;
	}
	return cx - x0 - scale; // ink width (drop the trailing space)
};

const measure = (str: string, scale: number) => {
	let w = 0;
	for (const ch of str) w += ch === ':' ? scale * 2 : scale * 6;
	return w - scale;
};

// --- shows ---------------------------------------------------------------------

/** HH:MM at the largest integer scale that fits, plus a seconds sweep along the
 *  bottom row — one dot per second, so the board clicks like it's alive. */
export const makeClock: ShowFn = (board) => {
	const draw = () => {
		const { cols, rows } = board;
		const t = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		const str = `${pad(t.getHours())}:${pad(t.getMinutes())}`;
		const scale = Math.max(1, Math.floor(Math.min(cols / (measure(str, 1) + 2), rows / 9)));
		const bits = new Uint8Array(cols * rows);
		const w = measure(str, scale);
		drawString(
			bits,
			cols,
			rows,
			str,
			Math.floor((cols - w) / 2),
			Math.floor((rows - 1 - scale * 7) / 2),
			scale
		);
		// The seconds sweep: fills left→right, wipes at the top of the minute.
		const sec = t.getSeconds() + 1;
		const fill = Math.round((sec / 60) * cols);
		for (let x = 0; x < fill; x++) bits[(rows - 1) * cols + x] = 1;
		board.setFrame(bits);
	};
	draw();
	const id = setInterval(draw, 250);
	return () => clearInterval(id);
};

// You know the GIF. You know the rules. With sound on, the board hums the chorus —
// MechSound's sine ping at a long decay is a perfectly good chiptune voice, and the
// solenoid rattle of the flips is the percussion section. [midi, sixteenths];
// midi 0 = rest; ~113 BPM like the record.
const ANTHEM: [number, number][] = [
	[68, 1],
	[70, 1],
	[73, 1],
	[70, 1],
	[77, 3],
	[77, 3],
	[75, 4],
	[0, 2],
	[68, 1],
	[70, 1],
	[73, 1],
	[70, 1],
	[75, 3],
	[75, 3],
	[73, 3],
	[72, 1],
	[70, 2],
	[0, 2],
	[68, 1],
	[70, 1],
	[73, 1],
	[70, 1],
	[73, 4],
	[75, 2],
	[72, 3],
	[68, 1],
	[68, 2],
	[75, 2],
	[73, 6],
	[0, 4]
];

/** The LED grid's loop.gif on one bit: sample each frame down to the grid, take the
 *  luma, dither. The board flips only when the GIF advances a frame. */
export const makeGif: ShowFn = (board, { dither: getDither, sound: getSound }) => {
	let frames: GifFrame[] | null = null;
	let raf = 0;
	let start = 0;
	let last = -1;
	let lastMode: DitherMode | null = null;
	void decodeGif(loopUrl).then((f) => {
		frames = f;
	});

	// The serenade, floppotron-style: a mechanical voice doesn't play pitched
	// pings — it sings with its REPETITION RATE. Each note is a stream of the
	// board's ordinary solenoid clicks (random high ring, full noise strike)
	// fired at the note's frequency dropped two octaves into clickable range
	// (~104–185 clicks/s) — the dots rattling in tune. The page mutes the
	// board's own background rattle while this show owns the audio.
	// Volume tracks the page's sound knob live; at 0 nothing boots, nothing
	// plays. Paused while the tab is hidden (rAF stops on its own; timers only
	// get throttled, which would blip erratically in the background).
	const snd = createMechSound({ volume: 0 });
	const UNIT = 60000 / 113 / 4; // one sixteenth at 113 BPM ≈ 133 ms
	let note = 0;
	let melodyTimer: ReturnType<typeof setTimeout> | null = null;
	const serenade = () => {
		melodyTimer = null;
		const [midi, len] = ANTHEM[note];
		note = (note + 1) % ANTHEM.length;
		snd.setVolume(getSound());
		const durMs = len * UNIT;
		if (midi > 0) {
			const rate = (440 * 2 ** ((midi - 69) / 12)) / 4; // clicks per second
			const count = Math.floor((durMs / 1000) * rate * 0.9); // ~90% gate — breath between notes
			for (let b = 0; b < count; b++) {
				const j = Math.random();
				snd.tick({
					delay: b / rate,
					freq: 6300 + j * 4200,
					decay: 0.005 + j * 0.004,
					noise: 0.9,
					noiseHz: 5200,
					gain: 0.3 + 0.12 * j
				});
			}
		}
		if (!document.hidden) melodyTimer = setTimeout(serenade, durMs);
	};
	const onVisibility = () => {
		if (document.hidden) {
			if (melodyTimer) clearTimeout(melodyTimer);
			melodyTimer = null;
		} else if (!melodyTimer) {
			melodyTimer = setTimeout(serenade, UNIT);
		}
	};
	document.addEventListener('visibilitychange', onVisibility);
	serenade();
	const step = (now: number) => {
		raf = requestAnimationFrame(step);
		if (!frames || frames.length === 0) return;
		if (!start) start = now;
		const idx = frameAt(frames, now - start);
		const mode = getDither();
		if (idx === last && mode === lastMode) return;
		last = idx;
		lastMode = mode;
		const { cols, rows } = board;
		const s = sampleImageToGrid(frames[idx].src, cols, rows, 'contain');
		const luma = new Float32Array(cols * rows);
		for (let y = 0; y < rows; y++)
			for (let x = 0; x < cols; x++) {
				// GridSample is y-up (LED grids count from the bottom); the board is y-down.
				const i = (rows - 1 - y) * cols + x;
				luma[y * cols + x] =
					(0.2126 * s.rgb[i * 3] + 0.7152 * s.rgb[i * 3 + 1] + 0.0722 * s.rgb[i * 3 + 2]) *
					s.alpha[i] *
					1.25;
			}
		board.setFrame(ditherFrame(luma, cols, rows, { mode }));
	};
	raf = requestAnimationFrame(step);
	return () => {
		cancelAnimationFrame(raf);
		document.removeEventListener('visibilitychange', onVisibility);
		if (melodyTimer) clearTimeout(melodyTimer);
		snd.dispose();
	};
};

/** A drifting plasma field — the ordered-dither showcase: under motion the Bayer
 *  pattern reads as halftone shading, not noise. Stepped at ~11 fps so the flips
 *  read as waves of discs, not soup. */
export const makePlasma: ShowFn = (board, { dither: getDither }) => {
	let t = 0;
	const draw = () => {
		t += 0.09;
		const { cols, rows } = board;
		board.setFrame(
			ditherFrame(
				(x, y) => {
					const cx = x - cols / 2;
					const cy = y - rows / 2;
					const v =
						Math.sin(x / 5.5 + t) +
						Math.sin(y / 4.5 - t * 0.8) +
						Math.sin((x + y) / 7 + t * 0.5) +
						Math.sin(Math.hypot(cx, cy) / 5 - t);
					return v / 8 + 0.5;
				},
				cols,
				rows,
				{ mode: getDither() }
			)
		);
	};
	draw();
	const id = setInterval(draw, 90);
	return () => clearInterval(id);
};

/** The classic destination sign: a message strip marching one column per step.
 *  Reads the text knob every step — edits re-render the strip in place. */
export const makeMarquee: ShowFn = (board, { text }) => {
	const { cols, rows } = board;
	const scale = Math.max(1, Math.floor(rows / 9));
	let msg = '';
	let w = 0;
	let strip = new Uint8Array(0);
	const build = () => {
		msg = (text().trim() || 'GLOWBOX FLIP-DOT') + ' ';
		w = Math.max(1, measure(msg, scale));
		strip = new Uint8Array(w * rows);
		drawString(strip, w, rows, msg, 0, Math.floor((rows - scale * 7) / 2), scale);
	};
	build();
	let o = -cols; // start with the message just off the right edge
	const draw = () => {
		const now = (text().trim() || 'GLOWBOX FLIP-DOT') + ' ';
		if (now !== msg) build();
		o = (o + 1) % w;
		board.setFrame((x, y) => {
			const sx = (((x + o) % w) + w) % w;
			return strip[y * w + sx];
		});
	};
	draw();
	const id = setInterval(draw, 80);
	return () => clearInterval(id);
};

/** A mechanical tally counter: tap/click the board to increment — every count
 *  earns its flips (and, sound on, its solenoid clicks). Odometer-style zero
 *  padding; wraps at 10000 like the real thing. */
export const makeCounter: ShowFn = (board, { stage }) => {
	let count = 0;
	const draw = () => {
		const { cols, rows } = board;
		const str = String(count % 10000).padStart(4, '0');
		const scale = Math.max(1, Math.floor(Math.min(cols / (measure(str, 1) + 2), rows / 8)));
		const bits = new Uint8Array(cols * rows);
		const w = measure(str, scale);
		drawString(
			bits,
			cols,
			rows,
			str,
			Math.floor((cols - w) / 2),
			Math.floor((rows - scale * 7) / 2),
			scale
		);
		board.setFrame(bits);
	};
	const el = stage();
	const onClick = () => {
		count++;
		draw();
	};
	el?.addEventListener('click', onClick);
	draw();
	return () => el?.removeEventListener('click', onClick);
};

export const FLIP_SHOWS: Record<FlipShow, ShowFn> = {
	clock: makeClock,
	gif: makeGif,
	plasma: makePlasma,
	marquee: makeMarquee,
	counter: makeCounter
};
