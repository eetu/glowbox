// Example driver: audio-reactive music viz on @glowbox/extras — makeAudioBands +
// the bars/radial visualizers. Attract-mode first: with sound off it grooves on a
// deterministic *simulated* spectrum (no AudioContext at all, so it self-plays on
// load like every other example). Flip sound on (a user gesture, which WebAudio
// needs anyway) and a tiny generative synth — kick, offbeat hats, an 8th-note saw
// bassline; zero assets — plays into an AnalyserNode and the same visualizers go
// live on the real FFT.
import {
	type AudioBands,
	makeAudioBands,
	makeBarsVisualizer,
	makeRadialVisualizer
} from '@glowbox/extras';
import type { LedDisplay } from '@glowbox/led-grid';

const BANDS = 16;

// An AudioBands-shaped groove: kick every beat into the low bands, hats offbeat up
// top, a slow melodic swell through the mids. Deterministic in wall-clock time.
function makeSimBands(): AudioBands {
	const bands = new Float32Array(BANDS);
	let level = 0;
	let peak = 0;
	return {
		bands,
		get level() {
			return level;
		},
		get peak() {
			return peak;
		},
		update() {
			const t = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
			const beat = t * 2; // 120 BPM
			const kick = Math.exp(-5 * (beat % 1));
			const hat = Math.exp(-9 * ((beat + 0.5) % 1));
			let sum = 0;
			for (let i = 0; i < BANDS; i++) {
				const f = i / (BANDS - 1);
				const bass = kick * Math.max(0, 1 - f * 2.6);
				const mid =
					0.45 *
					(0.5 + 0.5 * Math.sin(t * 1.7 + i * 0.9)) *
					Math.exp(-Math.abs(f - 0.45) * 5) *
					(0.55 + 0.45 * Math.sin(beat * Math.PI));
				const high = hat * Math.max(0, f - 0.55) * 2 * (0.7 + 0.3 * Math.sin(t * 9 + i * 3));
				const v = Math.min(1, bass + mid + high);
				bands[i] = v > bands[i] ? v : bands[i] * 0.86;
				sum += bands[i];
			}
			level = sum / BANDS;
			peak = Math.max(level, peak * 0.96);
		}
	};
}

// A view of `a` whose update() is a no-op — so several visualizers can share one
// AudioBands without each pulling (and re-smoothing) the FFT per frame.
const frozen = (a: AudioBands): AudioBands => ({
	bands: a.bands,
	get level() {
		return a.level;
	},
	get peak() {
		return a.peak;
	},
	update() {}
});

interface Synth {
	audio: AudioBands;
	stop(): void;
}

// The generative synth: a 100 ms-lookahead step scheduler at 120 BPM (8th notes).
// Everything routes master → analyser → speakers, so the bands hear exactly the mix.
function startSynth(onAutoStop: () => void, isStale: () => boolean): Synth | null {
	if (typeof AudioContext === 'undefined') return null;
	const ctx = new AudioContext();
	const analyser = ctx.createAnalyser();
	analyser.fftSize = 2048;
	analyser.smoothingTimeConstant = 0.55;
	const master = ctx.createGain();
	master.gain.value = 0.55;
	master.connect(analyser);
	analyser.connect(ctx.destination);

	// White-noise buffer for the hats.
	const noise = ctx.createBuffer(1, ctx.sampleRate / 2, ctx.sampleRate);
	const nd = noise.getChannelData(0);
	for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

	const spb = 60 / 120; // seconds per beat
	const BASS = [55, 55, 65.41, 49]; // A1 · A1 · C2 · G1 — one note per beat, 2 bars
	let step = 0; // 8th-note counter
	let nextT = ctx.currentTime + 0.05;

	const scheduleStep = (t: number, s: number) => {
		if (s % 2 === 0) {
			// Kick on the beat: a sine pitch-drop with a fast gain envelope.
			const o = ctx.createOscillator();
			const g = ctx.createGain();
			o.frequency.setValueAtTime(150, t);
			o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
			g.gain.setValueAtTime(1, t);
			g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
			o.connect(g).connect(master);
			o.start(t);
			o.stop(t + 0.3);
		} else {
			// Hat on the offbeat: high-passed noise, very short.
			const src = ctx.createBufferSource();
			src.buffer = noise;
			const hp = ctx.createBiquadFilter();
			hp.type = 'highpass';
			hp.frequency.value = 6500;
			const g = ctx.createGain();
			g.gain.setValueAtTime(0.22, t);
			g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
			src.connect(hp).connect(g).connect(master);
			src.start(t);
			src.stop(t + 0.08);
		}
		// Bass: an 8th-note filtered saw walking the line (octave pop on the last 8th).
		const o = ctx.createOscillator();
		o.type = 'sawtooth';
		o.frequency.value = BASS[(s >> 1) % BASS.length] * (s % 8 === 7 ? 2 : 1);
		const lp = ctx.createBiquadFilter();
		lp.type = 'lowpass';
		lp.frequency.value = 320 + 480 * Math.abs(Math.sin(s * 0.7));
		const g = ctx.createGain();
		g.gain.setValueAtTime(0.2, t);
		g.gain.exponentialRampToValueAtTime(0.02, t + spb * 0.45);
		o.connect(lp).connect(g).connect(master);
		o.start(t);
		o.stop(t + spb / 2);
	};

	const scheduler = setInterval(() => {
		// If the display stopped drawing us (example switched, tab gone), fall silent
		// and tear down — the sound toggle is a fresh gesture if the user comes back.
		if (isStale()) {
			stop();
			onAutoStop();
			return;
		}
		while (nextT < ctx.currentTime + 0.25) {
			scheduleStep(nextT, step++);
			nextT += spb / 2;
		}
	}, 90);

	function stop() {
		clearInterval(scheduler);
		void ctx.close();
	}

	return { audio: makeAudioBands(analyser, { bands: BANDS, maxFreq: 10000 }), stop };
}

/** Bars up front, a radial pulse behind — driven by the synth when `soundOn`, by the
 *  simulated groove otherwise. */
export function makeMusicViz(soundOn: () => boolean): (d: LedDisplay, dt: number) => void {
	const sim = makeSimBands();
	let synth: Synth | null = null;
	let lastDraw = 0;

	// The visualizers bind an AudioBands + a depth at creation, so (re)bind whenever
	// the source flips (sim ↔ synth) or the grid depth changes: radial pulse on a back
	// slice, spectrum bars up front — the parallax reads beautifully in orbit.
	let bars: (d: LedDisplay, dt: number) => void;
	let radial: (d: LedDisplay, dt: number) => void;
	let boundTo: AudioBands | null = null;
	let boundNz = -1;
	const bind = (audio: AudioBands, nz: number) => {
		boundTo = audio;
		boundNz = nz;
		const shared = frozen(audio);
		bars = makeBarsVisualizer(shared, {
			clear: false,
			gain: 2.2,
			depth: Math.min(nz - 1, Math.round(nz * 0.75))
		});
		radial = makeRadialVisualizer(shared, {
			clear: false,
			gain: 1.4,
			depth: Math.max(0, Math.round(nz * 0.2)),
			color: (_band, h) => [0.1, 0.5 + h * 0.5, 1]
		});
	};

	return (d, dt) => {
		lastDraw = typeof performance !== 'undefined' ? performance.now() : 0;
		if (soundOn() && !synth) {
			synth = startSynth(
				() => (synth = null), // auto-stop → next draw rebinds to the sim
				() => performance.now() - lastDraw > 600
			);
		} else if (!soundOn() && synth) {
			synth.stop();
			synth = null;
		}

		const audio = synth?.audio ?? sim;
		if (audio !== boundTo || d.nz !== boundNz) bind(audio, d.nz);
		audio.update();
		d.clear();
		radial(d, dt);
		bars(d, dt);
	};
}
