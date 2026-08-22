// React wrapper around @glowbox/neon's canvas sign. Give it `text` (new glass
// strikes on) plus optional appearance props that mirror the core options and
// update live. The canvas fills its parent — size the parent to size the sign.
// Ships in @glowbox/react alongside <LedGrid> + <NixieTube> + <SevenSegment> +
// <FlipDots> + <SplitFlap>, over the sibling core.
import {
	createNeonSign,
	type NeonSign as NeonSignHandle,
	type NeonSignOptions
} from '@glowbox/neon';
import {
	type CSSProperties,
	forwardRef,
	useEffect,
	useImperativeHandle,
	useRef,
	useState
} from 'react';

export interface NeonSignProps {
	/** The sign's text; '\n' splits lines. A change re-glasses and strikes on. */
	text?: string;
	/** Letterform: 'script' (cursive), 'sans' (block), or a custom NeonFont. */
	font?: NeonSignOptions['font'];
	/** Sign artwork: single-stroke pieces placed behind/beside the text. */
	art?: NeonSignOptions['art'];
	/** Tube colour, or one per text line (overrides the gas preset's colour). */
	color?: NeonSignOptions['color'];
	/** What's in the glass: 'neon', 'argon', 'helium', 'co2', 'green', 'gold', 'rose'. */
	gas?: NeonSignOptions['gas'];
	/** The wall behind the sign; null = transparent canvas. */
	wall?: NeonSignOptions['wall'];
	/** Discharge direction: 'emit' (light) or the invented 'absorb' (dark ink). */
	polarity?: NeonSignOptions['polarity'];
	/** Power — off leaves the unlit glass visible; on re-strikes. */
	on?: boolean;
	/** Per-text-line circuits — a line that switches on its own. */
	lineOn?: boolean[];
	/** Per-word circuits, counted across the text in reading order. */
	wordOn?: boolean[];
	/** Per-word tube colour (`null` entries inherit the line's colour or the gas). */
	wordColor?: NeonSignOptions['wordColor'];
	glow?: number;
	/** Painted letter slabs under the tubes, lit by their own circuit; one per line. */
	face?: NeonSignOptions['face'];
	/** Bend the tube around the letterform — its border, not its centreline. */
	outline?: NeonSignOptions['outline'];
	/** Per-line glyph scale; the tube keeps its regular width. */
	lineScale?: number[];
	/** The unlit tube itself. */
	glass?: NeonSignOptions['glass'];
	/** The electrode caps — metal, not light. */
	electrode?: NeonSignOptions['electrode'];
	/** Wear 0..1: dimming → a flickering tube → dead glass (the MOT L arc). */
	age?: number;
	/** Electrical instability 0..1: sparse dips and re-strike blips. */
	flicker?: number;
	/** A failing transformer: whole-sign dropouts with staggered re-strikes. */
	tired?: boolean;
	/** The flasher cam: 'steady' | 'flash' | 'chase' | 'reveal' (rate-capped). */
	program?: NeonSignOptions['program'];
	speed?: number;
	/** Circuit granularity: 'auto' (= per word) | 'glyph' | 'word' | 'line'. */
	tubes?: NeonSignOptions['tubes'];
	align?: NeonSignOptions['align'];
	lineSpacing?: number;
	letterSpacing?: number;
	/** Text block tilt, degrees (negative rises left-to-right). */
	tilt?: number;
	padding?: number;
	/** One tube's strike sequence, ms (0 = instant). */
	strikeMs?: number;
	/** Transformer hum + strike crackle: true (= 0.5) or a 0..1 volume. */
	sound?: boolean | number;
	/** Mains frequency the transformer sings at (50 or 60). */
	mains?: NeonSignOptions['mains'];
	pixelRatio?: number;
	label?: string;
	/** Colour bundle: 'dark' (default), 'light', or 'auto' to follow the page. */
	theme?: NeonSignOptions['theme'];
	/** Called with the sign after creation, and with null on teardown — the
	 *  Svelte wrapper's `oncreate` contract, for consumers who want a signal
	 *  rather than watching the forwarded ref flip silently. */
	oncreate?: (sign: NeonSignHandle | null) => void;
	className?: string;
	style?: CSSProperties;
}

// The canvas fills its parent by default; give the parent a size.
const baseStyle: CSSProperties = { display: 'block', width: '100%', height: '100%' };

/**
 * `<NeonSign>` mounts a neon sign. Forward a ref to reach the imperative
 * handle (`setText`, `power`, `setOptions`, …).
 */
// forwardRef (not the React-19 ref-as-prop) so the same build works against the React 18 peer.
// eslint-disable-next-line @eslint-react/no-forward-ref
export const NeonSign = forwardRef<NeonSignHandle | null, NeonSignProps>(
	function NeonSign(props, ref) {
		const {
			text,
			font,
			art,
			color,
			gas,
			wall,
			polarity,
			on,
			lineOn,
			wordOn,
			wordColor,
			glow,
			face,
			outline,
			lineScale,
			glass,
			electrode,
			age,
			flicker,
			tired,
			program,
			speed,
			tubes,
			align,
			lineSpacing,
			letterSpacing,
			tilt,
			padding,
			strikeMs,
			sound,
			mains,
			pixelRatio,
			theme,
			label,
			className,
			style
		} = props;
		const canvasRef = useRef<HTMLCanvasElement>(null);
		const [sign, setSign] = useState<NeonSignHandle | null>(null);

		// Latest props, read once at creation (create mount-only; later effects sync).
		const latestRef = useRef(props);
		latestRef.current = props;

		// Create the sign once for the canvas; dispose on unmount.
		useEffect(() => {
			const canvas = canvasRef.current;
			if (!canvas) return;
			const p = latestRef.current;
			const s = createNeonSign(canvas, {
				text: p.text,
				font: p.font,
				art: p.art,
				color: p.color,
				gas: p.gas,
				wall: p.wall,
				polarity: p.polarity,
				on: p.on,
				lineOn: p.lineOn,
				wordOn: p.wordOn,
				wordColor: p.wordColor,
				glow: p.glow,
				face: p.face,
				outline: p.outline,
				lineScale: p.lineScale,
				glass: p.glass,
				electrode: p.electrode,
				age: p.age,
				flicker: p.flicker,
				tired: p.tired,
				program: p.program,
				speed: p.speed,
				tubes: p.tubes,
				align: p.align,
				lineSpacing: p.lineSpacing,
				letterSpacing: p.letterSpacing,
				tilt: p.tilt,
				padding: p.padding,
				strikeMs: p.strikeMs,
				sound: p.sound,
				mains: p.mains,
				pixelRatio: p.pixelRatio,
				theme: p.theme,
				label: p.label
			});
			if (!s) {
				console.warn('NeonSign: 2D canvas unavailable');
				return;
			}
			setSign(s);
			latestRef.current.oncreate?.(s);
			return () => {
				s.dispose();
				setSign(null);
				latestRef.current.oncreate?.(null);
			};
		}, []);

		useImperativeHandle<NeonSignHandle | null, NeonSignHandle | null>(ref, () => sign, [sign]);

		// Live-update the shown text (a change re-glasses and strikes).
		useEffect(() => {
			if (text != null) sign?.setText(text);
		}, [sign, text]);

		// Live-update appearance when any option changes.
		useEffect(() => {
			sign?.setOptions({
				font,
				art,
				color,
				gas,
				wall,
				polarity,
				on,
				lineOn,
				wordOn,
				wordColor,
				glow,
				face,
				outline,
				lineScale,
				glass,
				electrode,
				age,
				flicker,
				tired,
				program,
				speed,
				tubes,
				align,
				lineSpacing,
				letterSpacing,
				tilt,
				padding,
				strikeMs,
				sound,
				mains,
				pixelRatio,
				theme,
				label
			});
		}, [
			sign,
			font,
			art,
			color,
			gas,
			wall,
			polarity,
			on,
			lineOn,
			wordOn,
			wordColor,
			glow,
			face,
			outline,
			lineScale,
			glass,
			electrode,
			age,
			flicker,
			tired,
			program,
			speed,
			tubes,
			align,
			lineSpacing,
			letterSpacing,
			tilt,
			padding,
			strikeMs,
			sound,
			mains,
			pixelRatio,
			theme,
			label
		]);

		return <canvas ref={canvasRef} className={className} style={{ ...baseStyle, ...style }} />;
	}
);
