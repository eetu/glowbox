// A tiny mechanical-sound synth over the Web Audio API — the audible half of an
// electromechanical display. Deliberately generic: a *tick* is one transient
// (a resonant ping + a filtered noise burst), and every mechanical core is a recipe
// over it — the flip-dot solenoid click, the split-flap card slap. Like `color.ts`,
// this file is vendor-copied between sibling cores (a core must not depend on a
// sibling for one helper); keep the copies identical. The noise burst is fully
// shapeable (`noiseLpHz`, `noiseDecay`): a solenoid click is a bright snap, a
// card slap a soft band-limited flutter — same transient, different recipe.
//
// One AudioContext for EVERYTHING: browsers cap live contexts (iOS Safari is the
// tight one), and a dashboard of boards must not burn one each. All channels share
// a module-level context + noise buffer, refcounted — the last dispose() closes it.
//
// Autoplay-policy honest: the context is created lazily on the first tick and, if
// the browser boots it suspended, a one-time pointer/key listener resumes it —
// sound simply starts on the first user gesture, no API for the consumer to call.
// Import-safe under node/SSR: no AudioContext at module scope, and
// `createMechSound` returns a silent no-op implementation where Web Audio
// doesn't exist.

export interface MechTick {
	/** Resonant ping frequency, Hz (default ~2400 with per-tick jitter). */
	freq?: number;
	/** Ping decay, seconds (default 0.014). */
	decay?: number;
	/** Noise-burst level 0..1 relative to the ping (default 0.8). */
	noise?: number;
	/** Noise highpass cutoff, Hz (default 2800). */
	noiseHz?: number;
	/** Noise lowpass cutoff, Hz (default none — full bandwidth). Band-limiting
	 *  the burst from above is what turns a sharp click into a soft, papery
	 *  slap: white noise through only a highpass always carries full top end. */
	noiseLpHz?: number;
	/** Noise-burst decay, seconds (default 0.006). Longer reads softer. */
	noiseDecay?: number;
	/** Tick gain 0..1 (default 1; scaled by the master volume). */
	gain?: number;
	/** Stereo position -1..1 (default 0). */
	pan?: number;
	/** Schedule offset in seconds from now (default 0). */
	delay?: number;
}

export interface MechSound {
	/** Play one transient. Safe to call at any rate — ticks beyond ~250/s per
	 *  channel are dropped (the ear reads dense rattle anyway; the audio graph
	 *  shouldn't pay for it). The ceiling leaves room for a floppotron-style
	 *  voice: a mechanical "note" is a click stream at the pitch's repetition
	 *  rate, which wants up to ~200 ticks/s. */
	tick(t?: MechTick): void;
	/** Master volume 0..1. 0 keeps the channel alive but silent. */
	setVolume(v: number): void;
	/** Release this channel; the shared AudioContext closes with the last one. */
	dispose(): void;
}

const MAX_RATE = 250; // ticks/second hard cap per channel

// --- the shared engine (module state, created lazily, refcounted) ---------------
let sharedCtx: AudioContext | null = null;
let sharedNoise: AudioBuffer | null = null;
let channels = 0; // booted channels holding the context open
let live = 0; // channels created and not yet disposed (may not have booted)
let gestureArmed = false;

// Has the page seen a real user gesture? An AudioContext created before one is
// guaranteed-suspended console noise AND a slot against the browser's context
// cap — rude to a host page already running its own audio. Where the API is
// missing (old WebKit), err on creating; the resume listener still unlocks.
// NB for probes: a CDP `evaluate` (Playwright/Puppeteer, the DevTools console)
// runs with userGesture:true and PERMANENTLY activates the page — an autoplay
// audit driven that way measures its own gesture and reports a false positive
// here. Instrument passively (console.log out of the page) instead.
const pageActivated = (): boolean =>
	typeof navigator === 'undefined' || (navigator.userActivation?.hasBeenActive ?? true);

const onGesture = () => {
	// The gesture either unlocks the existing context or is our cue to finally
	// create it (in-gesture creation starts running everywhere).
	if (sharedCtx) void sharedCtx.resume().catch(() => undefined);
	else if (live > 0) engine();
	disarmGesture();
};
const disarmGesture = () => {
	if (!gestureArmed) return;
	removeEventListener('pointerdown', onGesture);
	removeEventListener('keydown', onGesture);
	gestureArmed = false;
};
const armGesture = () => {
	if (gestureArmed) return;
	gestureArmed = true;
	addEventListener('pointerdown', onGesture);
	addEventListener('keydown', onGesture);
};

// Hidden/minimized tabs get their context suspended (WebKit reports a
// non-standard 'interrupted' state) and it does NOT resume itself on return —
// without this, sound stays dead until a reload. A resume after a prior
// user-gesture unlock needs no new gesture, so coming back just works.
const onVisible = () => {
	if (!document.hidden && sharedCtx && sharedCtx.state !== 'running')
		void sharedCtx.resume().catch(() => undefined);
};

const engine = (): AudioContext | null => {
	if (sharedCtx) return sharedCtx;
	const AC = typeof AudioContext !== 'undefined' ? AudioContext : null;
	if (!AC) return null; // SSR / ancient browser → stay a silent no-op
	sharedCtx = new AC();
	document.addEventListener('visibilitychange', onVisible);
	addEventListener('pageshow', onVisible);
	// One shared 100ms white-noise buffer; every burst plays a random slice of it.
	sharedNoise = sharedCtx.createBuffer(
		1,
		Math.ceil(sharedCtx.sampleRate * 0.1),
		sharedCtx.sampleRate
	);
	const data = sharedNoise.getChannelData(0);
	for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
	if (sharedCtx.state === 'suspended') armGesture();
	return sharedCtx;
};

/** Create a mechanical-sound channel. `volume` 0..1 (default 0.5). */
export function createMechSound(opts: { volume?: number } = {}): MechSound {
	let volume = Math.max(0, Math.min(1, opts.volume ?? 0.5));
	let master: GainNode | null = null; // this channel's gain into the shared context
	let disposed = false;
	let windowStart = 0; // 1s rate-limit window
	let windowCount = 0;
	live++;

	const boot = (): boolean => {
		if (disposed) return false;
		if (master) return true;
		if (!sharedCtx && !pageActivated()) {
			// No context yet and no gesture seen: don't create one — it would sit
			// suspended and burn a context slot on the host page. The gesture
			// listener creates it the moment the user first interacts.
			armGesture();
			return false;
		}
		const ctx = engine();
		if (!ctx) return false;
		master = ctx.createGain();
		master.gain.value = volume * volume; // perceptual-ish volume curve
		master.connect(ctx.destination);
		channels++;
		return true;
	};

	return {
		tick(t = {}) {
			if (volume <= 0 || !boot() || !sharedCtx || !master || !sharedNoise) return;
			const ctx = sharedCtx;
			if (ctx.state !== 'running') {
				// Covers both the autoplay lock ('suspended' before any gesture) and a
				// tab-hidden suspension (including WebKit's 'interrupted'). A direct
				// resume works once audio was ever unlocked; the gesture listener is
				// the backstop for the never-unlocked case. This tick is dropped —
				// the next one lands.
				void ctx.resume().catch(() => undefined);
				armGesture();
				return;
			}
			const now = ctx.currentTime;
			if (now - windowStart >= 1) {
				windowStart = now;
				windowCount = 0;
			}
			if (++windowCount > MAX_RATE) return;

			const when = now + Math.max(0, t.delay ?? 0);
			const gain = Math.max(0, Math.min(1, t.gain ?? 1));
			// StereoPanner is missing in a few older WebKits — pan is a nicety; also
			// skipped near centre to save a node on most ticks.
			let dest: AudioNode = master;
			const pan = t.pan ?? 0;
			if (typeof StereoPannerNode !== 'undefined' && Math.abs(pan) > 0.05) {
				const p = ctx.createStereoPanner();
				p.pan.value = Math.max(-1, Math.min(1, pan));
				p.connect(master);
				dest = p;
			}

			// The resonant ping: the disc/armature ringing after the strike. A sine —
			// measured against a real board the resonances are narrow (a 10.1 kHz
			// spike, not a harmonic stack), and triangle harmonics up there alias.
			// The tick gain is folded into the envelope peaks — no per-tick out node.
			const decay = t.decay ?? 0.014;
			const osc = ctx.createOscillator();
			osc.type = 'sine';
			osc.frequency.value = t.freq ?? 2400 * (0.85 + Math.random() * 0.3);
			const env = ctx.createGain();
			env.gain.setValueAtTime(0.5 * gain, when);
			env.gain.exponentialRampToValueAtTime(0.001, when + decay);
			osc.connect(env);
			env.connect(dest);
			osc.start(when);
			osc.stop(when + decay + 0.01);

			// The strike itself: a burst of band-shaped noise. The highpass keeps
			// the rumble out; the optional lowpass keeps the sharpness out.
			const noise = t.noise ?? 0.8;
			if (noise > 0) {
				const nDecay = t.noiseDecay ?? 0.006;
				const src = ctx.createBufferSource();
				src.buffer = sharedNoise;
				const hp = ctx.createBiquadFilter();
				hp.type = 'highpass';
				hp.frequency.value = t.noiseHz ?? 2800;
				const nEnv = ctx.createGain();
				nEnv.gain.setValueAtTime(noise * gain, when);
				nEnv.gain.exponentialRampToValueAtTime(0.001, when + nDecay);
				src.connect(hp);
				let tail: AudioNode = hp;
				if (t.noiseLpHz != null) {
					const lp = ctx.createBiquadFilter();
					lp.type = 'lowpass';
					lp.frequency.value = t.noiseLpHz;
					hp.connect(lp);
					tail = lp;
				}
				tail.connect(nEnv);
				nEnv.connect(dest);
				src.start(when, Math.random() * 0.07, nDecay + 0.02);
			}
		},
		setVolume(v) {
			volume = Math.max(0, Math.min(1, v));
			if (master) master.gain.value = volume * volume;
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			live--;
			// Nobody left waiting for a gesture-deferred context → don't create one.
			if (live <= 0 && !sharedCtx) disarmGesture();
			if (master) {
				master.disconnect();
				master = null;
				channels--;
				if (channels <= 0) {
					// Last channel out closes the shared context and frees its thread.
					disarmGesture();
					document.removeEventListener('visibilitychange', onVisible);
					removeEventListener('pageshow', onVisible);
					void sharedCtx?.close().catch(() => undefined);
					sharedCtx = null;
					sharedNoise = null;
				}
			}
		}
	};
}
