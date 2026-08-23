// The jerryrigged countdown: the movie bomb's brain, driving a row of
// @glowbox/seven-segment digits. Framework-free — the page mirrors the snapshot
// into its own state and pushes the digits.
//
// The core is a display and has no voice (a seven-segment module doesn't beep),
// so the piezo lives here with the prop that owns it: the rig beeps once a
// second, double-time inside the last ten, four-times inside the last five —
// the pacing every counted-down movie has trained everyone to hear.

/** Where the rig is in its evening. */
export type BombState = 'armed' | 'defused' | 'detonated';

/** The loom across the block, in cutting order. None of it disarms anything —
 *  that is the joke. Red is booby-trapped and fires the cap, so the warning is
 *  the one true thing on the rig; blue is an anti-tamper line that doubles the
 *  clock rate when it opens; yellow goes nowhere at all. The only cut that
 *  actually saves you is on the detonator. */
export const BOMB_WIRES = ['red', 'blue', 'yellow'] as const;
export type BombWire = (typeof BOMB_WIRES)[number];

/** The detonator's own pair, buried in the block. Cutting EITHER one opens the
 *  firing circuit — the honest way to disarm this, and the reason a bomb tech
 *  goes for the cap and not the pretty loom. */
export const BOMB_LEADS = ['detRed', 'detBlack'] as const;
export type BombLead = (typeof BOMB_LEADS)[number];

/** Anything on the rig a pair of cutters can reach. */
export type BombCut = BombWire | BombLead;

export interface BombSnapshot {
	state: BombState;
	/** Clock rate: 1 normally, doubled for every anti-tamper line opened. */
	rate: number;
	/** Seconds left on the clock, floor'd — what the digits show. */
	remaining: number;
	/** 'MM:SS' — five slots, the middle one a colon module. */
	display: string;
	/** Wires and leads already cut (a cut stays cut until the rig is re-armed). */
	cut: BombCut[];
}

export interface BombRigOptions {
	/** Seconds on the clock when armed (default 30). */
	seconds?: number;
	/** Piezo on (default false — the page's sound chip owns this). */
	sound?: boolean;
	onChange: (snap: BombSnapshot) => void;
}

const mmss = (total: number): string => {
	const s = Math.max(0, total);
	return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// Beeps per second at a given remaining time: the closer the deadline, the
// faster the cadence — 1 Hz, then 2, then 4 inside the last five seconds.
const cadence = (remaining: number): number => (remaining <= 5 ? 4 : remaining <= 10 ? 2 : 1);

interface Piezo {
	beep(remaining: number): void;
	chirp(): void;
	dud(): void;
	spool(): void;
	blast(): void;
	dispose(): void;
}

// A scavenged piezo: a hard square tone through a narrow band-pass, struck with
// a fast envelope. Cheap, tinny and high — the 4 kHz chirp of a digital watch
// alarm, which is exactly the part nobody in the room can ignore.
function createPiezo(): Piezo | null {
	if (typeof AudioContext === 'undefined') return null;
	const ctx = new AudioContext();
	const master = ctx.createGain();
	master.gain.value = 0.22;
	const band = ctx.createBiquadFilter();
	band.type = 'bandpass';
	band.frequency.value = 4200;
	band.Q.value = 2.2;
	band.connect(master).connect(ctx.destination);

	// One struck tone: square wave, no attack, exponential tail.
	const tone = (freq: number, ms: number, gain: number, type: OscillatorType = 'square') => {
		if (ctx.state === 'suspended') void ctx.resume();
		const t = ctx.currentTime;
		const o = ctx.createOscillator();
		const g = ctx.createGain();
		o.type = type;
		o.frequency.setValueAtTime(freq, t);
		g.gain.setValueAtTime(gain, t);
		g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
		o.connect(g).connect(band);
		o.start(t);
		o.stop(t + ms / 1000 + 0.02);
	};

	return {
		// The tick pitches up as the clock runs out — the same cell, driven harder.
		// Short: a watch beep is a chirp, not a note.
		beep: (remaining) => tone(remaining <= 5 ? 4600 : remaining <= 10 ? 4300 : 4000, 42, 0.85),
		// Two rising chirps: that lead was the right one.
		chirp: () => {
			tone(3200, 70, 0.7);
			setTimeout(() => tone(4400, 130, 0.7), 90);
		},
		// A dummy wire parts with nothing behind it: the clock does not even
		// stumble, and the next tick lands on schedule.
		dud: () => tone(900, 28, 0.25, 'triangle'),
		// The anti-tamper line opening: the timer spins up, and says so.
		spool: () => {
			tone(2600, 90, 0.6);
			setTimeout(() => tone(3400, 90, 0.6), 70);
			setTimeout(() => tone(4600, 200, 0.75), 140);
		},
		// Not a bang — the buzzer jamming on, which is all a prop can really do.
		blast: () => tone(140, 900, 1, 'sawtooth'),
		dispose: () => void ctx.close()
	};
}

export interface BombRig {
	snapshot(): BombSnapshot;
	/** Cut a wire or a detonator lead. Red fires the cap, blue doubles the clock,
	 *  yellow does nothing at all, and either detonator lead opens the firing
	 *  circuit for good — the only cut that disarms the thing. */
	cut(wire: BombCut): void;
	/** New batteries, fresh tape: back to a full clock with every wire whole. */
	rearm(): void;
	setSound(on: boolean): void;
	stop(): void;
}

/** Wire the rig up. It counts on its own; `onChange` fires on every visible
 *  change (a new second, a cut wire, the end of the clock). */
export function createBombRig({ seconds = 30, sound = false, onChange }: BombRigOptions): BombRig {
	let piezo: Piezo | null = null;
	let soundOn = sound;
	let state: BombState = 'armed';
	let cut: BombCut[] = [];
	// The clock is kept as remaining milliseconds, advanced by real elapsed time
	// times the rate — a fixed deadline could not speed up without the display
	// jumping, and the whole point of the anti-tamper line is that the ticker
	// visibly runs away from you.
	let leftMs = seconds * 1000;
	let rate = 1;
	let last = Date.now();
	let remaining = seconds;
	// The beep slot last sounded — a slot is one cadence step, so the tick rate
	// changes without the clock drifting.
	let lastSlot = -1;

	const snap = (): BombSnapshot => ({
		state,
		rate,
		remaining,
		display: mmss(remaining),
		cut: [...cut]
	});
	const emit = () => onChange(snap());
	const voice = (): Piezo | null => {
		if (!soundOn) return null;
		piezo ??= createPiezo();
		return piezo;
	};

	const tick = () => {
		const now = Date.now();
		const dt = now - last;
		last = now;
		if (state !== 'armed') return;
		leftMs = Math.max(0, leftMs - dt * rate);
		const secs = Math.ceil(leftMs / 1000);
		const slot = Math.floor((leftMs / 1000) * cadence(secs));
		if (slot !== lastSlot && leftMs > 0) {
			lastSlot = slot;
			voice()?.beep(secs);
		}
		if (secs !== remaining) {
			remaining = secs;
			emit();
		}
		if (leftMs <= 0) {
			state = 'detonated';
			remaining = 0;
			voice()?.blast();
			emit();
		}
	};

	// 60 ms is fine enough for a 4 Hz cadence and costs nothing; the clock counts
	// real elapsed time, so a slow frame never loses a second.
	const timer = setInterval(tick, 60);

	return {
		snapshot: snap,
		cut(wire) {
			if (state !== 'armed' || cut.includes(wire)) return;
			cut = [...cut, wire];
			if (wire === 'red') {
				// The booby trap: the warning was about this one.
				state = 'detonated';
				remaining = 0;
				voice()?.blast();
			} else if (wire === 'blue') {
				// The anti-tamper line. Opening it does not stop the clock, it doubles
				// the rate — cutting hopefully is now measurably worse than not cutting
				// at all, and the ticker says so.
				rate *= 2;
				lastSlot = -1;
				voice()?.spool();
			} else if (wire === 'yellow') {
				// A dummy, wired to nothing. The clock does not even stumble.
				voice()?.dud();
			} else {
				// A detonator lead: the firing circuit is open and nothing can fire.
				state = 'defused';
				voice()?.chirp();
			}
			emit();
		},
		rearm() {
			state = 'armed';
			cut = [];
			leftMs = seconds * 1000;
			rate = 1;
			last = Date.now();
			remaining = seconds;
			lastSlot = -1;
			emit();
		},
		setSound(on) {
			soundOn = on;
			if (!on) {
				piezo?.dispose();
				piezo = null;
			}
		},
		stop() {
			clearInterval(timer);
			piezo?.dispose();
			piezo = null;
		}
	};
}
