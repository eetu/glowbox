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
	/** Power — off leaves the unlit glass visible; on re-strikes. */
	on?: boolean;
	/** Per-text-line circuits (the motel sign's separately switched NO). */
	lineOn?: boolean[];
	glow?: number;
	/** Wear 0..1: dimming → a flickering tube → dead glass (the MOT L arc). */
	age?: number;
	/** Electrical instability 0..1: sparse dips and re-strike blips. */
	flicker?: number;
	/** A failing transformer: whole-sign dropouts with staggered re-strikes. */
	tired?: boolean;
	/** The flasher cam: 'steady' | 'flash' | 'chase' | 'reveal' (rate-capped). */
	program?: NeonSignOptions['program'];
	speed?: number;
	/** Tube sectioning: 'auto' | 'glyph' | 'word' | 'line'. */
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
			on,
			lineOn,
			glow,
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
				on: p.on,
				lineOn: p.lineOn,
				glow: p.glow,
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
				label: p.label
			});
			if (!s) {
				console.warn('NeonSign: 2D canvas unavailable');
				return;
			}
			setSign(s);
			return () => {
				s.dispose();
				setSign(null);
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
				on,
				lineOn,
				glow,
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
				label
			});
		}, [
			sign,
			font,
			art,
			color,
			gas,
			wall,
			on,
			lineOn,
			glow,
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
			label
		]);

		return <canvas ref={canvasRef} className={className} style={{ ...baseStyle, ...style }} />;
	}
);
