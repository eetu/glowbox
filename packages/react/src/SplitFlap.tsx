// React wrapper around @glowbox/split-flap's canvas board. Give it `text` (a string
// or one string per row — modules spin forward to it) plus optional appearance props
// that mirror the core options and update live. The canvas fills its parent — size
// the parent to size the board. Ships in @glowbox/react alongside <LedGrid> +
// <NixieTube> + <SevenSegment> + <FlipDots>, over the sibling core.
import { createSplitFlap, type SplitFlapBoard, type SplitFlapOptions } from '@glowbox/split-flap';
import {
	type CSSProperties,
	forwardRef,
	useEffect,
	useImperativeHandle,
	useRef,
	useState
} from 'react';

export interface SplitFlapProps {
	/** The shown text: a string (newlines split rows) or one string per row.
	 *  Only modules whose character changes spin — forward, wrapping the drum. */
	text?: string | string[];
	cols?: number;
	rows?: number;
	/** The drum: flap sequence in rotation order. */
	charset?: string;
	/** Per-flap faces: solid paint (chroma flaps) or re-inked glyphs. */
	palette?: SplitFlapOptions['palette'];
	card?: SplitFlapOptions['card'];
	ink?: SplitFlapOptions['ink'];
	/** Frame behind/between the modules. */
	board?: SplitFlapOptions['board'];
	gap?: number;
	font?: string;
	/** Opt-in lighting story (wells, clips, the fallen pile); flat matte default. */
	shaded?: boolean;
	flipMs?: number;
	/** Card slap: true (= 0.5) or a 0..1 volume. */
	sound?: boolean | number;
	pixelRatio?: number;
	label?: string;
	className?: string;
	style?: CSSProperties;
}

// The canvas fills its parent by default; give the parent a size.
const baseStyle: CSSProperties = { display: 'block', width: '100%', height: '100%' };

/**
 * `<SplitFlap>` mounts a split-flap board. Forward a ref to reach the imperative
 * `SplitFlapBoard` handle (`setText`, `setLine`, `setChar`, `setOptions`, …).
 */
// forwardRef (not the React-19 ref-as-prop) so the same build works against the React 18 peer.
// eslint-disable-next-line @eslint-react/no-forward-ref
export const SplitFlap = forwardRef<SplitFlapBoard | null, SplitFlapProps>(
	function SplitFlap(props, ref) {
		const {
			text,
			cols,
			rows,
			charset,
			palette,
			card,
			ink,
			board,
			gap,
			font,
			shaded,
			flipMs,
			sound,
			pixelRatio,
			label,
			className,
			style
		} = props;
		const canvasRef = useRef<HTMLCanvasElement>(null);
		const [flaps, setFlaps] = useState<SplitFlapBoard | null>(null);

		// Latest props, read once at creation (create mount-only; later effects sync).
		const latestRef = useRef(props);
		latestRef.current = props;

		// Create the board once for the canvas; dispose on unmount.
		useEffect(() => {
			const canvas = canvasRef.current;
			if (!canvas) return;
			const p = latestRef.current;
			const b = createSplitFlap(canvas, {
				cols: p.cols,
				rows: p.rows,
				charset: p.charset,
				palette: p.palette,
				card: p.card,
				ink: p.ink,
				board: p.board,
				gap: p.gap,
				font: p.font,
				shaded: p.shaded,
				flipMs: p.flipMs,
				sound: p.sound,
				pixelRatio: p.pixelRatio,
				label: p.label
			});
			if (!b) {
				console.warn('SplitFlap: 2D canvas unavailable');
				return;
			}
			if (p.text != null) b.setText(p.text);
			setFlaps(b);
			return () => {
				b.dispose();
				setFlaps(null);
			};
		}, []);

		useImperativeHandle<SplitFlapBoard | null, SplitFlapBoard | null>(ref, () => flaps, [flaps]);

		// Live-update the shown text.
		useEffect(() => {
			if (text != null) flaps?.setText(text);
		}, [flaps, text]);

		// Live-update appearance when any option changes.
		useEffect(() => {
			flaps?.setOptions({
				cols,
				rows,
				charset,
				palette,
				card,
				ink,
				board,
				gap,
				font,
				shaded,
				flipMs,
				sound,
				pixelRatio,
				label
			});
		}, [
			flaps,
			cols,
			rows,
			charset,
			palette,
			card,
			ink,
			board,
			gap,
			font,
			shaded,
			flipMs,
			sound,
			pixelRatio,
			label
		]);

		return <canvas ref={canvasRef} className={className} style={{ ...baseStyle, ...style }} />;
	}
);
