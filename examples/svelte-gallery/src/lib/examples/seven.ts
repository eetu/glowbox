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

/** The wires hanging out of the taped-up bundle, in cutting order. */
export const BOMB_WIRES = ['red', 'blue', 'yellow'] as const;
export type BombWire = (typeof BOMB_WIRES)[number];

export interface BombSnapshot {
	state: BombState;
	/** Seconds left on the clock, floor'd — what the digits show. */
	remaining: number;
	/** 'MM:SS' — five slots, the middle one a colon module. */
	display: string;
	/** Wires already cut (a cut wire stays cut until the rig is re-armed). */
	cut: BombWire[];
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
	blast(): void;
	dispose(): void;
}

// A scavenged piezo: a hard square tone through a narrow band-pass, struck with
// a fast envelope. Cheap, tinny and loud — the sound of a $2 buzzer glued to a
// board, not a synthesizer.
function createPiezo(): Piezo | null {
	if (typeof AudioContext === 'undefined') return null;
	const ctx = new AudioContext();
	const master = ctx.createGain();
	master.gain.value = 0.22;
	const band = ctx.createBiquadFilter();
	band.type = 'bandpass';
	band.frequency.value = 2700;
	band.Q.value = 1.4;
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
		// The tick pitches up as the clock runs out — the same buzzer, driven harder.
		beep: (remaining) => tone(remaining <= 5 ? 3200 : remaining <= 10 ? 2900 : 2600, 70, 0.9),
		// Two rising notes: the wire was the right one.
		chirp: () => {
			tone(1800, 120, 0.7);
			setTimeout(() => tone(2700, 220, 0.7), 130);
		},
		// Not a bang — the buzzer jamming on, which is all a prop can really do.
		blast: () => tone(140, 900, 1, 'sawtooth'),
		dispose: () => void ctx.close()
	};
}

export interface BombRig {
	snapshot(): BombSnapshot;
	/** Cut a wire. Red is the one the hero is told not to cut. */
	cut(wire: BombWire): void;
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
	let cut: BombWire[] = [];
	let deadline = Date.now() + seconds * 1000;
	let remaining = seconds;
	// The beep slot last sounded — a slot is one cadence step, so the tick rate
	// changes without the clock drifting.
	let lastSlot = -1;

	const snap = (): BombSnapshot => ({ state, remaining, display: mmss(remaining), cut: [...cut] });
	const emit = () => onChange(snap());
	const voice = (): Piezo | null => {
		if (!soundOn) return null;
		piezo ??= createPiezo();
		return piezo;
	};

	const tick = () => {
		if (state !== 'armed') return;
		const left = Math.max(0, deadline - Date.now());
		const secs = Math.ceil(left / 1000);
		const slot = Math.floor((left / 1000) * cadence(secs));
		if (slot !== lastSlot && left > 0) {
			lastSlot = slot;
			voice()?.beep(secs);
		}
		if (secs !== remaining) {
			remaining = secs;
			emit();
		}
		if (left <= 0) {
			state = 'detonated';
			remaining = 0;
			voice()?.blast();
			emit();
		}
	};

	// 60 ms is fine enough for a 4 Hz cadence and costs nothing; the clock itself
	// is read from the deadline, so nothing drifts.
	const timer = setInterval(tick, 60);

	return {
		snapshot: snap,
		cut(wire) {
			if (state !== 'armed' || cut.includes(wire)) return;
			cut = [...cut, wire];
			if (wire === 'red') {
				state = 'detonated';
				remaining = 0;
				voice()?.blast();
			} else {
				state = 'defused';
				voice()?.chirp();
			}
			emit();
		},
		rearm() {
			state = 'armed';
			cut = [];
			deadline = Date.now() + seconds * 1000;
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
