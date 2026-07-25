// A row of nixie tubes on one container — the multi-tube half of the core. A clock or
// counter is a string (`'12:34:56'`, `'3.14'`): one tube per character, with the narrow
// separators (`:` `.` `-`) in slimmer slots, exactly the way a hand-built row does it.
// The row owns slot sizing (fit the container, keep the digit aspect), keeps the tubes
// in sync on setValue/setOptions, and reads to assistive tech as ONE image ("12:34:56"),
// not eight — the per-tube canvases sit under an aria-hidden wrapper.
//
// Deliberately framework-free (like createNixieTube): give it any block element. The
// wrappers' components stay single-tube; a row is composition, and this is the
// composition done once, correctly.
import { createNixieTube, type NixieOptions, type NixieTube } from './nixie';

/** Characters that get a narrow slot (their ink is a dot column, not a digit). */
const SEPARATORS = new Set([':', '.', '-']);

export interface NixieRowOptions extends Omit<NixieOptions, 'value' | 'label' | 'bare'> {
	/** The string to light — one tube per character (e.g. `'12:34'`, `'3.14'`, `'-42'`).
	 *  `null`/`''` = an empty row (no tubes). */
	value?: string | number | null;
	/** Accessible name for the whole row (one `img`, not one per tube). Defaults to the
	 *  lit string itself. */
	label?: string;
	/** Gap between tubes in px (default 6). */
	gap?: number;
	/** A digit tube's width:height ratio (default 0.56 — an IN-14-ish proportion).
	 *  Height comes from the container; width follows this, shrunk to fit. */
	digitAspect?: number;
	/** Separator (`:` `.` `-`) slot width as a fraction of a digit slot's (default 0.47). */
	separatorScale?: number;
}

export interface NixieRow {
	/** Relight the row: same-length strings just relight tubes; a different length
	 *  rebuilds the slots. */
	setValue(v: string | number | null): void;
	/** Live-update any option; appearance options fan out to every tube. */
	setOptions(patch: Partial<NixieRowOptions>): void;
	/** Re-fit the slots to the container box (also runs automatically on resize). */
	resize(): void;
	/** The live tubes, in display order — escape hatch for per-tube tweaks. */
	readonly tubes: readonly NixieTube[];
	dispose(): void;
}

/** Create a row of nixie tubes inside `container` (any block element — the row fills
 *  its box). Returns null where DOM/2D canvas is unavailable (node/SSR). */
export function createNixieRow(
	container: HTMLElement,
	opts: NixieRowOptions = {}
): NixieRow | null {
	if (typeof document === 'undefined') return null;
	// Probe 2D-canvas support once up front (jsdom, headless oddities) — the same
	// null-contract as createNixieTube, before touching the container.
	if (!document.createElement('canvas').getContext('2d')) return null;

	let value = norm(opts.value);
	let label = opts.label;
	let gap = opts.gap ?? 6;
	let digitAspect = opts.digitAspect ?? 0.56;
	let separatorScale = opts.separatorScale ?? 0.47;
	// The appearance options every tube shares (value/label/layout keys stay row-level).
	let tubeOpts = pickTubeOptions(opts);

	// One aria-hidden flex wrapper holds the canvases, so the row can be a single named
	// image while each tube still self-labels (harmlessly) underneath.
	const wrap = document.createElement('div');
	wrap.setAttribute('aria-hidden', 'true');
	wrap.style.display = 'flex';
	wrap.style.alignItems = 'center';
	wrap.style.justifyContent = 'center';
	wrap.style.width = '100%';
	wrap.style.height = '100%';
	container.appendChild(wrap);

	const tubes: NixieTube[] = [];
	const slots: HTMLCanvasElement[] = [];

	function applyAria() {
		container.setAttribute('role', 'img');
		const name = label ?? value;
		if (name) {
			container.setAttribute('aria-label', name);
			container.removeAttribute('aria-hidden');
		} else {
			container.setAttribute('aria-hidden', 'true');
			container.removeAttribute('aria-label');
		}
	}

	// Fit the slots: digit width follows the container height via digitAspect, then the
	// whole row shrinks (never grows) to fit the container width. Tubes repaint via
	// their own per-canvas observers when their style box changes.
	function layout() {
		const r = container.getBoundingClientRect();
		const cw = Math.max(1, r.width || container.clientWidth || 1);
		const ch = Math.max(1, r.height || container.clientHeight || 1);
		if (!value.length) return;
		const weights = [...value].map((c) => (SEPARATORS.has(c) ? separatorScale : 1));
		const totalWeight = weights.reduce((a, b) => a + b, 0);
		const gaps = gap * (value.length - 1);
		let digitW = ch * digitAspect;
		if (digitW * totalWeight + gaps > cw) digitW = Math.max(1, (cw - gaps) / totalWeight);
		const tubeH = Math.min(ch, digitW / digitAspect);
		wrap.style.gap = `${gap}px`;
		for (let i = 0; i < slots.length; i++) {
			slots[i].style.width = `${weights[i] * digitW}px`;
			slots[i].style.height = `${tubeH}px`;
			slots[i].style.flex = '0 0 auto';
		}
	}

	// Rebuild the slot list to match the value's length, reusing existing tubes in
	// place (a ticking clock relights, it doesn't recreate canvases).
	function sync() {
		const chars = [...value];
		while (slots.length > chars.length) {
			tubes.pop()?.dispose();
			slots.pop()?.remove();
		}
		while (slots.length < chars.length) {
			const canvas = document.createElement('canvas');
			wrap.appendChild(canvas);
			const tube = createNixieTube(canvas, { ...tubeOpts, value: chars[slots.length] });
			if (!tube) {
				// Context creation failed mid-flight (probed OK at create) — stop rather
				// than spin; the row shows the tubes it managed.
				canvas.remove();
				break;
			}
			slots.push(canvas);
			tubes.push(tube);
		}
		for (let i = 0; i < tubes.length; i++) tubes[i].setValue(chars[i]);
		applyAria();
		layout();
	}

	const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => layout()) : null;
	ro?.observe(container);
	sync();

	return {
		setValue(v) {
			value = norm(v);
			sync();
		},
		setOptions(patch) {
			if (patch.gap != null) gap = patch.gap;
			if (patch.digitAspect != null) digitAspect = patch.digitAspect;
			if (patch.separatorScale != null) separatorScale = patch.separatorScale;
			if (patch.label !== undefined) label = patch.label;
			if (patch.value !== undefined) value = norm(patch.value);
			const tubePatch = pickTubeOptions(patch);
			if (Object.keys(tubePatch).length) {
				tubeOpts = { ...tubeOpts, ...tubePatch };
				for (const t of tubes) t.setOptions(tubePatch);
			}
			sync();
		},
		resize() {
			layout();
			for (const t of tubes) t.resize();
		},
		get tubes() {
			return tubes;
		},
		dispose() {
			ro?.disconnect();
			for (const t of tubes) t.dispose();
			tubes.length = 0;
			slots.length = 0;
			wrap.remove();
			container.removeAttribute('role');
			container.removeAttribute('aria-label');
		}
	};
}

const norm = (v: string | number | null | undefined): string => (v == null ? '' : String(v));

// The subset of a row patch that belongs to every tube (never value/label — those are
// per-row — and never the row's own layout keys).
function pickTubeOptions(o: Partial<NixieRowOptions>): Partial<NixieOptions> {
	const out: Partial<NixieOptions> = {};
	if (o.style != null) out.style = o.style;
	if (o.color != null) out.color = o.color;
	if (o.glow != null) out.glow = o.glow;
	if (o.background != null) out.background = o.background;
	if (o.mesh != null) out.mesh = o.mesh;
	if (o.ghost != null) out.ghost = o.ghost;
	if (o.pixelRatio != null) out.pixelRatio = o.pixelRatio;
	return out;
}
