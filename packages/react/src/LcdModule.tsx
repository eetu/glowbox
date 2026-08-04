// React wrapper around @glowbox/lcd's canvas module. Give it `text` (the crystals
// chase it at their own speed) plus optional appearance props that mirror the core
// options and update live. CGRAM glyphs and the cursor position are imperative — use
// the ref or `oncreate`. The canvas fills its parent — size the parent to size the
// module. Ships in @glowbox/react alongside the other seven displays, over the
// sibling @glowbox/lcd core.
import {
	createLcdModule,
	type LcdModule as LcdModuleHandle,
	type LcdModuleOptions
} from '@glowbox/lcd';
import {
	type CSSProperties,
	forwardRef,
	useEffect,
	useImperativeHandle,
	useRef,
	useState
} from 'react';

export interface LcdModuleProps {
	/** The shown text: a string (newlines split rows) or one string per row.
	 *  The shutters take real time to move — new text smears in. */
	text?: string | string[];
	cols?: number;
	rows?: number;
	/** The glass: 'green' (STN, readable unlit), 'blue' (negative), 'white' (FSTN). */
	panel?: LcdModuleOptions['panel'];
	/** true/false or a 0..1 level; the negative blue glass needs it to read at all. */
	backlight?: boolean | number;
	/** The trimmer 0..1; past ~0.85 the lattice darkens and crosstalk streaks grow. */
	contrast?: number;
	/** Liquid-crystal speed 0..1 (0 snaps, 1 is cold glass). */
	response?: number;
	/** The resting dot lattice. */
	ghost?: boolean;
	/** 'none' | 'line' | 'block' (blinking); position via the handle's setCursor. */
	cursor?: LcdModuleOptions['cursor'];
	/** Wear 0..1: dimming, then a flickering column, then a dead column. */
	age?: number;
	/** Extension glyphs over the vendored ASCII face — character → 5×7 ASCII art
	 *  (the core exports LATIN_5X7 ready-made); null resets to the plain face. */
	glyphs?: LcdModuleOptions['glyphs'];
	/** Power — off drains the ink at crystal speed. */
	on?: boolean;
	/** The uninitialised boot row of solid blocks on power-up. */
	boot?: boolean;
	/** The plastic frame; null = transparent outside the glass. */
	bezel?: LcdModuleOptions['bezel'];
	pixelRatio?: number;
	label?: string;
	/** Called with the module after creation, and with null on teardown — the
	 *  Svelte wrapper's `oncreate` contract, for consumers who want a signal
	 *  rather than watching the forwarded ref flip silently. */
	oncreate?: (lcd: LcdModuleHandle | null) => void;
	className?: string;
	style?: CSSProperties;
}

// The canvas fills its parent by default; give the parent a size.
const baseStyle: CSSProperties = { display: 'block', width: '100%', height: '100%' };

/**
 * `<LcdModule>` mounts a character LCD module (HD44780-class). Forward a ref to reach
 * the imperative `LcdModule` handle (`setText`, `setGlyph`, `setCursor`, `power`, …).
 */
// forwardRef (not the React-19 ref-as-prop) so the same build works against the React 18 peer.
// eslint-disable-next-line @eslint-react/no-forward-ref
export const LcdModule = forwardRef<LcdModuleHandle | null, LcdModuleProps>(
	function LcdModule(props, ref) {
		const {
			text,
			cols,
			rows,
			panel,
			backlight,
			contrast,
			response,
			ghost,
			cursor,
			age,
			glyphs,
			on,
			boot,
			bezel,
			pixelRatio,
			label,
			className,
			style
		} = props;
		const canvasRef = useRef<HTMLCanvasElement>(null);
		const [lcd, setLcd] = useState<LcdModuleHandle | null>(null);

		// Latest props, read once at creation (create mount-only; later effects sync).
		const latestRef = useRef(props);
		latestRef.current = props;

		// Create the module once for the canvas; dispose on unmount.
		useEffect(() => {
			const canvas = canvasRef.current;
			if (!canvas) return;
			const p = latestRef.current;
			const m = createLcdModule(canvas, {
				text: p.text,
				cols: p.cols,
				rows: p.rows,
				panel: p.panel,
				backlight: p.backlight,
				contrast: p.contrast,
				response: p.response,
				ghost: p.ghost,
				cursor: p.cursor,
				age: p.age,
				glyphs: p.glyphs,
				on: p.on,
				boot: p.boot,
				bezel: p.bezel,
				pixelRatio: p.pixelRatio,
				label: p.label
			});
			if (!m) {
				console.warn('LcdModule: 2D canvas unavailable');
				return;
			}
			setLcd(m);
			latestRef.current.oncreate?.(m);
			return () => {
				m.dispose();
				setLcd(null);
				latestRef.current.oncreate?.(null);
			};
		}, []);

		useImperativeHandle<LcdModuleHandle | null, LcdModuleHandle | null>(ref, () => lcd, [lcd]);

		// Live-update the shown text.
		useEffect(() => {
			if (text != null) lcd?.setText(text);
		}, [lcd, text]);

		// Live-update appearance when any option changes.
		useEffect(() => {
			lcd?.setOptions({
				cols,
				rows,
				panel,
				backlight,
				contrast,
				response,
				ghost,
				cursor,
				age,
				glyphs,
				on,
				boot,
				bezel,
				pixelRatio,
				label
			});
		}, [
			lcd,
			cols,
			rows,
			panel,
			backlight,
			contrast,
			response,
			ghost,
			cursor,
			age,
			glyphs,
			on,
			boot,
			bezel,
			pixelRatio,
			label
		]);

		return <canvas ref={canvasRef} className={className} style={{ ...baseStyle, ...style }} />;
	}
);
