// React wrapper around @glowbox/flip-dot's canvas board. Give it a `frame` (row-major
// 0/1 bits or an (x, y) => on function) plus optional appearance props that mirror the
// core options and update live. The canvas fills its parent — size the parent to size
// the board. Ships in @glowbox/react alongside <LedGrid> + <NixieTube> +
// <SevenSegment>, over the sibling core.
import {
	createFlipDots,
	type FlipDotBoard,
	type FlipDotShape,
	type FlipDotsOptions,
	type FlipDotStagger
} from '@glowbox/flip-dot';
import {
	type CSSProperties,
	forwardRef,
	useEffect,
	useImperativeHandle,
	useRef,
	useState
} from 'react';

export interface FlipDotsProps {
	/** The shown frame: row-major 0/1 bits (`ditherFrame` output fits) or an
	 *  (x, y) => on function. Only dots that actually change flip. */
	frame?: ArrayLike<number> | ((x: number, y: number) => number | boolean);
	cols?: number;
	rows?: number;
	shape?: FlipDotShape;
	onColor?: FlipDotsOptions['onColor'];
	offColor?: FlipDotsOptions['offColor'];
	/** Board plastic behind the dots. */
	board?: FlipDotsOptions['board'];
	gap?: number;
	/** Opt-in lighting story (gradients, socket wells, glint); flat matte default. */
	shaded?: boolean;
	flipMs?: number;
	/** Pivot-axis angle in degrees. */
	axis?: number;
	stagger?: FlipDotStagger;
	scanMs?: number;
	/** Solenoid click: true (= 0.5) or a 0..1 volume. */
	sound?: boolean | number;
	pixelRatio?: number;
	label?: string;
	className?: string;
	style?: CSSProperties;
}

// The canvas fills its parent by default; give the parent a size.
const baseStyle: CSSProperties = { display: 'block', width: '100%', height: '100%' };

/**
 * `<FlipDots>` mounts a flip-dot board. Forward a ref to reach the imperative
 * `FlipDotBoard` handle (`set`, `setFrame`, `setOptions`, `resize`, …).
 */
// forwardRef (not the React-19 ref-as-prop) so the same build works against the React 18 peer.
// eslint-disable-next-line @eslint-react/no-forward-ref
export const FlipDots = forwardRef<FlipDotBoard | null, FlipDotsProps>(
	function FlipDots(props, ref) {
		const {
			frame,
			cols,
			rows,
			shape,
			onColor,
			offColor,
			board,
			gap,
			shaded,
			flipMs,
			axis,
			stagger,
			scanMs,
			sound,
			pixelRatio,
			label,
			className,
			style
		} = props;
		const canvasRef = useRef<HTMLCanvasElement>(null);
		const [dots, setDots] = useState<FlipDotBoard | null>(null);

		// Latest props, read once at creation (create mount-only; later effects sync).
		const latestRef = useRef(props);
		latestRef.current = props;

		// Create the board once for the canvas; dispose on unmount.
		useEffect(() => {
			const canvas = canvasRef.current;
			if (!canvas) return;
			const p = latestRef.current;
			const b = createFlipDots(canvas, {
				cols: p.cols,
				rows: p.rows,
				shape: p.shape,
				onColor: p.onColor,
				offColor: p.offColor,
				board: p.board,
				gap: p.gap,
				shaded: p.shaded,
				flipMs: p.flipMs,
				axis: p.axis,
				stagger: p.stagger,
				scanMs: p.scanMs,
				sound: p.sound,
				pixelRatio: p.pixelRatio,
				label: p.label
			});
			if (!b) {
				console.warn('FlipDots: 2D canvas unavailable');
				return;
			}
			if (p.frame) b.setFrame(p.frame);
			setDots(b);
			return () => {
				b.dispose();
				setDots(null);
			};
		}, []);

		useImperativeHandle<FlipDotBoard | null, FlipDotBoard | null>(ref, () => dots, [dots]);

		// Live-update the shown frame.
		useEffect(() => {
			if (frame) dots?.setFrame(frame);
		}, [dots, frame]);

		// Live-update appearance when any option changes.
		useEffect(() => {
			dots?.setOptions({
				cols,
				rows,
				shape,
				onColor,
				offColor,
				board,
				gap,
				shaded,
				flipMs,
				axis,
				stagger,
				scanMs,
				sound,
				pixelRatio,
				label
			});
		}, [
			dots,
			cols,
			rows,
			shape,
			onColor,
			offColor,
			board,
			gap,
			shaded,
			flipMs,
			axis,
			stagger,
			scanMs,
			sound,
			pixelRatio,
			label
		]);

		return <canvas ref={canvasRef} className={className} style={{ ...baseStyle, ...style }} />;
	}
);
