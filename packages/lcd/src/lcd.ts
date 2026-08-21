// @glowbox/lcd — a character LCD *module* (HD44780-class), a sibling rendering core to
// the vfd panel — and the family's first REFLECTIVE display: dark ink on a lit pane,
// native to a light page the way every emissive sibling is native to a dark one. The
// bar for existing at all (a div grid + an LCD webfont renders the layout for free) is
// the LIQUID CRYSTAL, not the character grid:
//   • A dot is a SHUTTER, not an emitter — and shutters are slow. Every dot's state
//     chases its target over real tens of milliseconds (rise faster than fall, so
//     moving text drags a trailing ghost), which is the one thing a webfont
//     structurally cannot do. Cutting the power doesn't blank the glass; the ink
//     drains out at the same crystal speed.
//   • The CONTRAST POT is a knob, not a colour: too low and the ink sinks into the
//     ghost lattice, the sweet spot is honest, and overdriving it past ~0.85 raises
//     the undriven dots and grows passive-matrix CROSSTALK — faint streaks down
//     heavily driven columns, exactly what twisting the trimmer too far does.
//   • The undriven dot lattice stays faintly visible (`ghost`) — you can read the
//     whole 5×8 grid on any STN at an angle.
//   • BOOT is the uninitialised controller: power-up shows the top row as solid
//     blocks until the module "initialises" — the most recognisable 16×2 symptom
//     there is.
//   • CGRAM: 8 custom glyph slots (`setGlyph`), addressed from text by code
//     point 0-7, 5x8 like the hardware - the bar-chart/animation party trick
//     every real module gets used for.
//   • `age` runs the franchise wear arc at COLUMN granularity — a failing column
//     driver dims, then flickers, then leaves a blank stripe of undriven lattice
//     (the LCD's own banding, like vfd's dim grid column).
// No sound module, deliberately: an LED-backlit module is silent (the EL-inverter
// whine of older glass is a niche we can add the day someone misses it).
// Give it a canvas + text; drive it with setText/setLine/setGlyph/setCursor/power.
// Import-safe under node/SSR (no browser globals at module scope).
import { type Color, parseColor, type RGB } from './color';
import { compile5x7, FONT_5X7, glyph5x7 } from './font5x7';
import { type PanelName, PANELS, type PanelSpec } from './panels';

/** The cursor the controller draws over a cell: none, the steady underline, or the
 *  blinking solid block (blink is steady under prefers-reduced-motion). */
export type LcdCursor = 'none' | 'line' | 'block';

export interface LcdModuleOptions {
	/** Character columns (default 16). */
	cols?: number;
	/** Character rows (default 2). */
	rows?: number;
	/** The shown text; '\n' splits rows, or one string per row. Longer lines are
	 *  truncated, missing rows blank — a module has exactly the cells it has. */
	text?: string | string[];
	/** Extension glyphs layered over the vendored ASCII face — character → 5×7
	 *  ASCII art ('#' = ink, 7 rows of 5, the face's own authoring format). Import
	 *  a ready table (`LATIN_5X7`) or draw your own; CGRAM code points 0–7 still
	 *  win. Patch with null to reset to the plain face. */
	glyphs?: Record<string, string> | null;
	/** The glass: 'green' (STN yellow-green, dark ink, readable unlit), 'blue'
	 *  (STN negative — light ink that needs its backlight), 'white' (FSTN).
	 *  Default 'green'. */
	panel?: PanelName;
	/** Backlight: true (= 1), false, or a 0..1 level (default true). On a positive
	 *  panel this only relights the pane; on the negative blue glass it IS the image. */
	backlight?: boolean | number;
	/** The contrast trimmer 0..1 (default 0.8). Low sinks the ink into the ghost
	 *  lattice; past ~0.85 the undriven dots darken and crosstalk streaks appear. */
	contrast?: number;
	/** Liquid-crystal response 0..1 (default 0.4 ≈ 100 ms rise — an honest STN).
	 *  0 is an instant impossible crystal; 1 is cold glass in a parked car. */
	response?: number;
	/** The undriven dot lattice (default true — it's what LCD glass looks like). */
	ghost?: boolean;
	/** Cursor style (default 'none'); position via `setCursor`. */
	cursor?: LcdCursor;
	/** Wear 0..1 (default 0): per-column dimming; past ~0.7 the most-worn column
	 *  flickers, from ~0.95 its driver is dead — a blank stripe of bare lattice. */
	age?: number;
	/** Power (default true). Off is not blank instantly: the ink drains out at
	 *  crystal speed, then the pane sits unlit. */
	on?: boolean;
	/** The uninitialised boot row: power-up shows the top row as solid blocks for a
	 *  moment (default true; skipped under prefers-reduced-motion). */
	boot?: boolean;
	/** The plastic frame around the glass; null = no plastic at all (default
	 *  near-black plastic). The frame is a fixed strip hugging the glass, not a
	 *  fill — canvas left over past it stays transparent whatever this is set to,
	 *  so a module in an over-tall box is a module, not a letterbox. */
	bezel?: Color | null;
	/** Cap on devicePixelRatio (default 2). */
	pixelRatio?: number;
	/** Accessible name (default 'lcd display'; '' hides from the a11y tree). The
	 *  shown text is appended so the module reads as what it says. */
	label?: string;
}

export interface LcdModule {
	readonly cols: number;
	readonly rows: number;
	/** Replace the whole text: '\n' splits rows, or one string per row. */
	setText(text: string | string[]): void;
	/** Set one row. */
	setLine(row: number, text: string): void;
	/** Write a CGRAM slot (0–7): 8 rows of 5-bit masks, bit 4 = leftmost dot — the
	 *  hardware's own convention. Text addresses it as '\u0000'…'\u0007'. */
	setGlyph(slot: number, rows: ArrayLike<number>): void;
	/** Park the cursor on a cell (clamped to the grid). Style is the `cursor` option. */
	setCursor(col: number, row: number): void;
	/** The power switch. Off drains the ink at crystal speed and unlights the pane;
	 *  on re-runs the boot row if the module was built with one. */
	power(on: boolean): void;
	/** The character cell under a viewport point — pass `e.clientX`/`e.clientY`
	 *  straight from a pointer event. Null off the glass. The library owns the
	 *  layout maths; consumers own the listeners (the module attaches none — it's
	 *  a display). */
	cellAt(clientX: number, clientY: number): { x: number; y: number } | null;
	/** A character cell's 5×8 ink block in viewport coordinates — position a DOM
	 *  overlay (a focusable control, a tooltip) over a cell with it. Null out of
	 *  range. */
	cellRect(
		x: number,
		y: number
	): { left: number; top: number; width: number; height: number } | null;
	setOptions(patch: Partial<LcdModuleOptions>): void;
	resize(): void;
	snapshot(): string;
	dispose(): void;
}

const c255 = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
const rgba = (c: RGB, a: number) =>
	`rgba(${c255(c[0])},${c255(c[1])},${c255(c[2])},${Math.max(0, Math.min(1, a))})`;
const mix = (a: RGB, b: RGB, t: number): RGB => [
	a[0] + (b[0] - a[0]) * t,
	a[1] + (b[1] - a[1]) * t,
	a[2] + (b[2] - a[2]) * t
];
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// One character cell is 5×8 dots (the 5×7 face + the cursor/descender row); the
// advance adds one dot pitch between characters and two between rows — module glass,
// not a text grid.
const CELL_W = FONT_5X7.width; // 5
const CELL_H = 8;
const ADV_X = CELL_W + 1;
const ADV_Y = CELL_H + 2;
// Glass margin around the character field, in dot pitches.
const GLASS_PAD = 2;
// The plastic frame around the glass, in dot pitches. A module's bezel is a FINITE
// strip of plastic — it hugs the glass and stops. Anything the canvas has left over
// past it is not hardware, so it stays transparent: a reflective module on a pale
// page must not sit in a black letterbox (a VFD's faceplate genuinely is the whole
// panel, which is why that core fills instead).
const BEZEL_PAD = 3;
// The wear arc thresholds — the franchise's, at column-driver granularity.
const FLICKER_AT = 0.7;
const DIE_AT = 0.95;
// The uninitialised boot row's dwell.
const BOOT_MS = 800;
// The block cursor's blink half-period (the controller's ~1 Hz).
const BLINK_MS = 530;

/** Lay text onto a `cols`×`rows` module: '\n' splits a string, arrays are one entry
 *  per row; every line is truncated/padded to exactly `cols`. Pure — the module's
 *  character arithmetic is node-testable by design. */
export function layLines(
	text: string | string[] | null | undefined,
	cols: number,
	rows: number
): string[] {
	const src = text == null ? [] : Array.isArray(text) ? text : String(text).split('\n');
	const out: string[] = [];
	for (let r = 0; r < rows; r++) {
		const line = src[r] ?? '';
		out.push(line.length >= cols ? line.slice(0, cols) : line.padEnd(cols, ' '));
	}
	return out;
}

/** Create a character LCD module on a 2D canvas. Returns null if 2D is unavailable. */
export function createLcdModule(
	canvas: HTMLCanvasElement,
	opts: LcdModuleOptions = {}
): LcdModule | null {
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;

	let cols = Math.max(1, Math.floor(opts.cols ?? 16));
	let rows = Math.max(1, Math.floor(opts.rows ?? 2));
	let spec: PanelSpec = PANELS[opts.panel ?? 'green'] ?? PANELS.green;
	let backlight = opts.backlight === undefined ? 1 : clamp01(Number(opts.backlight) || 0);
	let contrast = clamp01(opts.contrast ?? 0.8);
	let response = clamp01(opts.response ?? 0.4);
	let ghost = opts.ghost ?? true;
	let cursorStyle: LcdCursor = opts.cursor ?? 'none';
	let age = clamp01(opts.age ?? 0);
	let on = opts.on ?? true;
	let boot = opts.boot ?? true;
	let bezel =
		opts.bezel === undefined
			? parseColor('#14161a')
			: opts.bezel == null
				? null
				: parseColor(opts.bezel);
	let bezelOn = opts.bezel !== null;
	let pixelRatio = opts.pixelRatio ?? 2;
	let label = opts.label ?? 'lcd display';
	// The extension face, compiled once per table — null means the plain face.
	const compileGlyphs = (t: Record<string, string> | null | undefined) => {
		if (!t) return null;
		const m = new Map<string, readonly number[]>();
		for (const [ch, art] of Object.entries(t)) m.set(ch, compile5x7(art));
		return m.size ? m : null;
	};
	let extra = compileGlyphs(opts.glyphs);

	const reduced =
		typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	// --- module state -----------------------------------------------------------
	let lines = layLines(opts.text, cols, rows);
	const cgram = new Uint8Array(8 * CELL_H); // 8 slots × 8 rows of 5-bit masks
	let cursorX = 0;
	let cursorY = 0;
	let blinkOn = true;
	let booting = false;

	// One flat dot inventory (the vfd lesson): `target` is what the controller is
	// driving, `state` is where the crystals actually are. Index = global dot.
	let dotCols = cols * CELL_W;
	let dotRows = rows * CELL_H;
	let target = new Uint8Array(dotCols * dotRows);
	let state = new Float32Array(dotCols * dotRows);
	// Per-column drive density, for the crosstalk streaks.
	let colDrive = new Float32Array(dotCols);

	// Deterministic per-column wear fingerprint (seven-segment's pattern).
	const seed = Math.random() * 1000;
	const wear = (c: number) => {
		const x = Math.sin(seed + c * 12.9898) * 43758.5453;
		return x - Math.floor(x);
	};
	let dying = 0;
	let second = 0;
	const pickDying = () => {
		let best = -1;
		let next = -1;
		for (let c = 0; c < dotCols; c++) {
			const w = wear(c);
			if (best < 0 || w > wear(best)) {
				next = best;
				best = c;
			} else if (next < 0 || w > wear(next)) next = c;
		}
		dying = Math.max(0, best);
		second = Math.max(0, next);
	};
	pickDying();
	let flickerDim = 0; // >0 while the dying column is mid-dip

	// --- geometry (CSS px, baked by resize) -------------------------------------
	let w = 0;
	let h = 0;
	let dpr = 1;
	let pitch = 0; // one dot pitch
	let ox = 0; // character-field origin
	let oy = 0;
	let glass = { x: 0, y: 0, w: 0, h: 0 };
	let frame = { x: 0, y: 0, w: 0, h: 0 };

	// --- targets ------------------------------------------------------------------
	const glyphRow = (ch: string, r: number): number => {
		const code = ch.codePointAt(0) ?? 32;
		if (code < 8) return cgram[code * CELL_H + r]; // CGRAM slot
		if (r >= FONT_5X7.height) return 0; // the descender/cursor row is the font's gap
		return (extra?.get(ch) ?? glyph5x7(ch))[r];
	};

	function retarget() {
		target.fill(0);
		if (on) {
			if (booting) {
				// The uninitialised controller: DDRAM full of 0xFF on the top row.
				for (let cx = 0; cx < cols; cx++)
					for (let ry = 0; ry < CELL_H; ry++)
						for (let rx = 0; rx < CELL_W; rx++) target[ry * dotCols + cx * CELL_W + rx] = 1;
			} else {
				for (let cy = 0; cy < rows; cy++) {
					const line = lines[cy];
					for (let cx = 0; cx < cols; cx++) {
						const ch = line[cx] ?? ' ';
						for (let ry = 0; ry < CELL_H; ry++) {
							const bits = glyphRow(ch, ry);
							if (!bits) continue;
							const row = (cy * CELL_H + ry) * dotCols + cx * CELL_W;
							for (let rx = 0; rx < CELL_W; rx++)
								if (bits & (1 << (CELL_W - 1 - rx))) target[row + rx] = 1;
						}
					}
				}
				// The cursor is drawn by the controller OVER the glyph (union), at
				// crystal speed like everything else — a blink genuinely smears.
				if (cursorStyle !== 'none' && cursorX < cols && cursorY < rows) {
					const base = cursorX * CELL_W;
					if (cursorStyle === 'line') {
						const row = (cursorY * CELL_H + CELL_H - 1) * dotCols + base;
						for (let rx = 0; rx < CELL_W; rx++) target[row + rx] = 1;
					} else if (blinkOn || reduced) {
						for (let ry = 0; ry < CELL_H; ry++) {
							const row = (cursorY * CELL_H + ry) * dotCols + base;
							for (let rx = 0; rx < CELL_W; rx++) target[row + rx] = 1;
						}
					}
				}
			}
		}
		colDrive.fill(0);
		for (let i = 0; i < target.length; i++) if (target[i]) colDrive[i % dotCols]++;
		for (let c = 0; c < dotCols; c++) colDrive[c] /= dotRows;
		animate();
	}

	// --- the crystals ---------------------------------------------------------------
	let raf = 0;
	let lastT = 0;
	function step(now: number) {
		raf = 0;
		const dt = Math.min(0.05, (now - lastT) / 1000);
		lastT = now;
		// Rise beats fall: a moving message drags its ghost behind it.
		const base = 0.015 + response * 0.32;
		const kUp = 1 - Math.exp(-dt / (base * 0.75));
		const kDn = 1 - Math.exp(-dt / (base * 1.35));
		let moving = false;
		for (let i = 0; i < state.length; i++) {
			const t = target[i];
			const s = state[i];
			const d = t - s;
			if (d === 0) continue;
			const n = s + d * (d > 0 ? kUp : kDn);
			state[i] = Math.abs(t - n) < 0.004 ? t : ((moving = true), n);
		}
		draw();
		if (moving) {
			raf = requestAnimationFrame(step);
		}
	}
	function animate() {
		if (reduced || response <= 0) {
			state.set(target);
			draw();
			return;
		}
		if (!raf) {
			lastT = performance.now();
			raf = requestAnimationFrame(step);
		}
	}

	// --- schedulers (timers, not rAF — an idle module costs nothing) -----------------
	let blinkTimer: ReturnType<typeof setTimeout> | undefined;
	function syncBlink() {
		clearTimeout(blinkTimer);
		blinkTimer = undefined;
		if (reduced || !on || cursorStyle !== 'block') {
			blinkOn = true;
			return;
		}
		blinkTimer = setTimeout(() => {
			blinkOn = !blinkOn;
			retarget();
			syncBlink();
		}, BLINK_MS);
	}

	let flickerTimer: ReturnType<typeof setTimeout> | undefined;
	function syncFlicker() {
		clearTimeout(flickerTimer);
		flickerTimer = undefined;
		if (reduced || age < FLICKER_AT) {
			flickerDim = 0;
			return;
		}
		flickerTimer = setTimeout(
			() => {
				// Past DIE_AT the most-worn driver is gone for good — the runner-up
				// inherits the instability.
				flickerDim = 0.3 + Math.random() * 0.5;
				draw();
				setTimeout(
					() => {
						flickerDim = 0;
						draw();
						syncFlicker();
					},
					60 + Math.random() * 160
				);
			},
			400 + Math.random() * 2000
		);
	}
	const flickerCol = () => (age >= DIE_AT ? second : dying);

	// --- boot -------------------------------------------------------------------------
	let bootTimer: ReturnType<typeof setTimeout> | undefined;
	function beginBoot() {
		clearTimeout(bootTimer);
		if (!boot || reduced) {
			booting = false;
			retarget();
			return;
		}
		booting = true;
		retarget();
		bootTimer = setTimeout(() => {
			booting = false;
			retarget();
		}, BOOT_MS);
	}

	// --- ARIA ---------------------------------------------------------------------------
	function applyAria() {
		if (!label) {
			canvas.setAttribute('aria-hidden', 'true');
			canvas.removeAttribute('aria-label');
			return;
		}
		canvas.removeAttribute('aria-hidden');
		canvas.setAttribute('role', 'img');
		const shown = on
			? lines
					.map((l) => l.trim())
					.filter(Boolean)
					.join(' / ')
			: '';
		canvas.setAttribute('aria-label', shown ? `${label}: ${shown}` : label);
	}

	// --- render ---------------------------------------------------------------------------
	function draw() {
		if (!w || !h) return;
		const g = ctx!;
		g.setTransform(dpr, 0, 0, dpr, 0, 0);
		g.clearRect(0, 0, w, h);

		if (bezelOn && bezel) {
			g.fillStyle = rgba(bezel, 1);
			g.fillRect(frame.x, frame.y, frame.w, frame.h);
		}
		if (glass.w <= 4 || glass.h <= 4) return; // sub-legible: plastic only, never negative maths

		// The pane: backlight level mixes the unlit reflection toward the lit glass.
		// Power off is an unlit pane regardless of the option.
		const lit = on ? backlight : 0;
		const pane = mix(spec.paneOff, spec.pane, lit);
		g.fillStyle = rgba(pane, 1);
		g.fillRect(glass.x, glass.y, glass.w, glass.h);
		// Viewing-angle shading: STN contrast is never uniform top-to-bottom.
		const grad = g.createLinearGradient(0, glass.y, 0, glass.y + glass.h);
		grad.addColorStop(0, 'rgba(0,0,0,0.10)');
		grad.addColorStop(0.25, 'rgba(0,0,0,0)');
		grad.addColorStop(1, 'rgba(0,0,0,0.06)');
		g.fillStyle = grad;
		g.fillRect(glass.x, glass.y, glass.w, glass.h);

		// The pot: ink strength saturates near the top of the sweet spot; overdrive
		// past it raises the resting lattice and feeds the crosstalk streaks.
		const sag = 1 - age * 0.15;
		const ink = clamp01((contrast - 0.08) / 0.72) ** 0.9 * sag;
		const over = Math.max(0, contrast - 0.85) / 0.15;
		const rest = ghost ? spec.ghost * (1 + over * 1.6) : 0;
		// A negative panel's ink is light THROUGH the glass — no backlight, no image.
		const through = spec.negative ? 0.12 + 0.88 * lit : 1;

		const dot = pitch * 0.86; // dots almost touch — STN, not LED
		const inkCol = spec.ink;
		g.fillStyle = rgba(inkCol, 1);
		const die = age >= DIE_AT ? dying : -1;
		const flick = flickerCol();
		for (let dy = 0; dy < dotRows; dy++) {
			const cy = (dy / CELL_H) | 0;
			const ry = dy % CELL_H;
			const py = oy + (cy * ADV_Y + ry) * pitch;
			const rowBase = dy * dotCols;
			for (let dx = 0; dx < dotCols; dx++) {
				const c = dx;
				let s = die === c ? 0 : state[rowBase + dx];
				if (age > 0 && s > 0) {
					s *= 1 - wear(c) * age * 0.5;
					if (flickerDim > 0 && c === flick) s *= 1 - flickerDim;
				}
				let a = rest + (ink - rest) * s;
				// Crosstalk: undriven dots in a hard-driven column pick up a shadow.
				if (s < 1) a += colDrive[c] * (0.02 + over * 0.22) * (1 - s);
				a *= through;
				if (a <= 0.004) continue;
				const cx = (dx / CELL_W) | 0;
				const rx = dx % CELL_W;
				g.globalAlpha = Math.min(1, a);
				g.fillRect(ox + (cx * ADV_X + rx) * pitch, py, dot, dot);
			}
		}
		g.globalAlpha = 1;
	}

	// --- layout -----------------------------------------------------------------------------
	function resize() {
		const r = canvas.getBoundingClientRect();
		dpr = Math.min(pixelRatio > 0 ? pixelRatio : 1, globalThis.devicePixelRatio || 1);
		w = Math.max(1, r.width || canvas.clientWidth || 1);
		h = Math.max(1, r.height || canvas.clientHeight || 1);
		canvas.width = Math.max(1, Math.round(w * dpr));
		canvas.height = Math.max(1, Math.round(h * dpr));
		// The character field in dot pitches (the last cell drops its trailing gap).
		// The bezel is part of the module, so it is fitted with the glass — the
		// plastic never depends on how much canvas happens to be left over.
		const fieldW = cols * ADV_X - 1;
		const fieldH = rows * ADV_Y - 2;
		const pad = (GLASS_PAD + BEZEL_PAD) * 2;
		pitch = Math.min(w / (fieldW + pad), h / (fieldH + pad));
		const gw = (fieldW + GLASS_PAD * 2) * pitch;
		const gh = (fieldH + GLASS_PAD * 2) * pitch;
		glass = { x: (w - gw) / 2, y: (h - gh) / 2, w: gw, h: gh };
		const bp = BEZEL_PAD * pitch;
		frame = { x: glass.x - bp, y: glass.y - bp, w: gw + bp * 2, h: gh + bp * 2 };
		ox = glass.x + GLASS_PAD * pitch;
		oy = glass.y + GLASS_PAD * pitch;
		draw();
	}

	function regrid() {
		dotCols = cols * CELL_W;
		dotRows = rows * CELL_H;
		target = new Uint8Array(dotCols * dotRows);
		state = new Float32Array(dotCols * dotRows);
		colDrive = new Float32Array(dotCols);
		lines = layLines(lines, cols, rows);
		cursorX = Math.min(cursorX, cols - 1);
		cursorY = Math.min(cursorY, rows - 1);
		pickDying();
		resize();
		retarget();
		applyAria();
	}

	// Drive-time contracts warn, never throw (the vfd rule).
	let warnedGlyph = false;

	const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
	ro?.observe(canvas);
	applyAria();
	resize();
	syncBlink();
	syncFlicker();
	if (on) beginBoot();
	else retarget();

	return {
		get cols() {
			return cols;
		},
		get rows() {
			return rows;
		},
		setText(text) {
			lines = layLines(text, cols, rows);
			applyAria();
			if (!booting) retarget();
		},
		setLine(row, text) {
			row = Math.floor(row);
			if (!(row >= 0 && row < rows)) return;
			lines[row] = layLines(text, cols, 1)[0];
			applyAria();
			if (!booting) retarget();
		},
		setGlyph(slot, glyphRows) {
			slot = Math.floor(slot);
			if (!(slot >= 0 && slot < 8)) {
				if (!warnedGlyph) {
					warnedGlyph = true;
					console.warn(`glowbox/lcd: CGRAM has 8 slots (0–7); got ${slot}`);
				}
				return;
			}
			for (let r = 0; r < CELL_H; r++)
				cgram[slot * CELL_H + r] = (Number(glyphRows[r]) || 0) & 0x1f;
			if (!booting) retarget();
		},
		setCursor(col, row) {
			cursorX = Math.max(0, Math.min(cols - 1, Math.floor(col) || 0));
			cursorY = Math.max(0, Math.min(rows - 1, Math.floor(row) || 0));
			if (!booting) retarget();
		},
		power(v) {
			if (v === on) return;
			on = v;
			applyAria();
			if (on) beginBoot();
			else retarget(); // targets drop to 0; the ink drains at crystal speed
			syncBlink();
		},
		cellAt(clientX, clientY) {
			const r = canvas.getBoundingClientRect();
			if (!r.width || !r.height || !pitch) return null;
			// Viewport → canvas CSS px → the character lattice (cell-granular: a
			// fingertip doesn't aim between dots).
			const px = ((clientX - r.left) / r.width) * w;
			const py = ((clientY - r.top) / r.height) * h;
			const x = Math.floor((px - ox) / (ADV_X * pitch));
			const y = Math.floor((py - oy) / (ADV_Y * pitch));
			return x >= 0 && x < cols && y >= 0 && y < rows ? { x, y } : null;
		},
		cellRect(x, y) {
			x = Math.floor(x);
			y = Math.floor(y);
			if (!(x >= 0 && x < cols) || !(y >= 0 && y < rows)) return null;
			const r = canvas.getBoundingClientRect();
			if (!r.width || !r.height || !pitch) return null;
			// The baked metrics live in the canvas's CSS space; scale into the live
			// rect (the two only differ mid-layout or under CSS transforms).
			const kx = r.width / w;
			const ky = r.height / h;
			return {
				left: r.left + (ox + x * ADV_X * pitch) * kx,
				top: r.top + (oy + y * ADV_Y * pitch) * ky,
				width: CELL_W * pitch * kx,
				height: CELL_H * pitch * ky
			};
		},
		setOptions(patch) {
			let doRegrid = false;
			if (patch.cols != null && Math.max(1, Math.floor(patch.cols)) !== cols) {
				cols = Math.max(1, Math.floor(patch.cols));
				doRegrid = true;
			}
			if (patch.rows != null && Math.max(1, Math.floor(patch.rows)) !== rows) {
				rows = Math.max(1, Math.floor(patch.rows));
				doRegrid = true;
			}
			if (patch.panel != null) spec = PANELS[patch.panel] ?? spec;
			if (patch.backlight !== undefined) backlight = clamp01(Number(patch.backlight ?? 1) || 0);
			if (patch.contrast != null) contrast = clamp01(patch.contrast);
			if (patch.response != null) response = clamp01(patch.response);
			if (patch.ghost != null) ghost = patch.ghost;
			if (patch.age != null) {
				age = clamp01(patch.age);
				syncFlicker();
			}
			if (patch.boot != null) boot = patch.boot;
			if (patch.bezel !== undefined) {
				bezelOn = patch.bezel !== null;
				bezel = patch.bezel == null ? null : parseColor(patch.bezel);
			}
			if (patch.label !== undefined) {
				label = patch.label;
				applyAria();
			}
			if (patch.pixelRatio != null) {
				pixelRatio = patch.pixelRatio;
				resize();
			}
			if (doRegrid) regrid();
			if (patch.cursor != null && patch.cursor !== cursorStyle) {
				cursorStyle = patch.cursor;
				syncBlink();
				if (!booting) retarget();
			}
			if (patch.glyphs !== undefined) {
				extra = compileGlyphs(patch.glyphs);
				if (!booting) retarget();
			}
			if (patch.text !== undefined) this.setText(patch.text ?? '');
			if (patch.on != null) this.power(patch.on);
			draw();
		},
		resize,
		snapshot() {
			draw();
			return canvas.toDataURL('image/png');
		},
		dispose() {
			ro?.disconnect();
			if (raf) cancelAnimationFrame(raf);
			clearTimeout(blinkTimer);
			clearTimeout(flickerTimer);
			clearTimeout(bootTimer);
			canvas.removeAttribute('role');
			canvas.removeAttribute('aria-label');
			canvas.removeAttribute('aria-hidden');
		}
	};
}
