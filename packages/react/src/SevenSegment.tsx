// React wrapper around @glowbox/seven-segment's canvas digit. Give it a `value` (the
// shown symbol) plus optional appearance props that mirror the core options and update
// live. The canvas fills its parent — size the parent to size the digit. Ships in
// @glowbox/react alongside <LedGrid> + <NixieTube>, over the sibling core.
import {
	createSevenSegment,
	type SevenSegmentDisplay,
	type SevenSegmentOptions,
	type SevenSegmentStyle
} from '@glowbox/seven-segment';
import {
	type CSSProperties,
	forwardRef,
	useEffect,
	useImperativeHandle,
	useRef,
	useState
} from 'react';

export interface SevenSegmentProps {
	/** The shown symbol: `0`–`9`, `-`, hex `A b C d E F`, `:`, or null/'' for dark. */
	value?: string | number | null;
	/** Display material — maps to the core `style` option (renamed to avoid the DOM `style`). */
	displayStyle?: SevenSegmentStyle;
	/** Light the decimal point. */
	dp?: boolean;
	color?: SevenSegmentOptions['color'];
	glow?: number;
	background?: SevenSegmentOptions['background'];
	ghost?: boolean;
	/** Drop the window module — segments on a transparent canvas. */
	bare?: boolean;
	/** Wear 0..1 — per-segment dimming, then flicker, then a dead segment. */
	age?: number;
	/** Per-segment cross-fade ms on value changes. */
	transition?: number;
	pixelRatio?: number;
	/** Accessible name (`aria-label`); defaults to the shown symbol itself. */
	label?: string;
	/** Called with the display after creation, and with null on teardown — the
	 *  Svelte wrapper's `oncreate` contract, for consumers who want a signal
	 *  rather than watching the forwarded ref flip silently. */
	oncreate?: (display: SevenSegmentDisplay | null) => void;
	className?: string;
	style?: CSSProperties;
}

// The canvas fills its parent by default; give the parent a size.
const baseStyle: CSSProperties = { display: 'block', width: '100%', height: '100%' };

/**
 * `<SevenSegment>` mounts a single seven-segment digit. Forward a ref to reach the
 * imperative `SevenSegmentDisplay` handle (`setValue`, `setOptions`, `resize`, …).
 */
// forwardRef (not the React-19 ref-as-prop) so the same build works against the React 18 peer.
// eslint-disable-next-line @eslint-react/no-forward-ref
export const SevenSegment = forwardRef<SevenSegmentDisplay | null, SevenSegmentProps>(
	function SevenSegment(props, ref) {
		const {
			value = null,
			displayStyle = 'led',
			dp,
			color,
			glow,
			background,
			ghost,
			bare,
			age,
			transition,
			pixelRatio,
			label,
			className,
			style
		} = props;
		const canvasRef = useRef<HTMLCanvasElement>(null);
		const [display, setDisplay] = useState<SevenSegmentDisplay | null>(null);

		// Latest props, read once at creation (create mount-only; later effects sync).
		const latestRef = useRef(props);
		latestRef.current = props;

		// Create the display once for the canvas; dispose on unmount.
		useEffect(() => {
			const canvas = canvasRef.current;
			if (!canvas) return;
			const p = latestRef.current;
			const d = createSevenSegment(canvas, {
				value: p.value,
				style: p.displayStyle,
				dp: p.dp,
				color: p.color,
				glow: p.glow,
				background: p.background,
				ghost: p.ghost,
				bare: p.bare,
				age: p.age,
				transition: p.transition,
				pixelRatio: p.pixelRatio,
				label: p.label
			});
			if (!d) {
				console.warn('SevenSegment: 2D canvas unavailable');
				return;
			}
			setDisplay(d);
			latestRef.current.oncreate?.(d);
			return () => {
				d.dispose();
				setDisplay(null);
				latestRef.current.oncreate?.(null);
			};
		}, []);

		useImperativeHandle<SevenSegmentDisplay | null, SevenSegmentDisplay | null>(
			ref,
			() => display,
			[display]
		);

		// Live-update the shown symbol.
		useEffect(() => {
			display?.setValue(value);
		}, [display, value]);

		// Live-update appearance when any option changes.
		useEffect(() => {
			display?.setOptions({
				style: displayStyle,
				dp,
				color,
				glow,
				background,
				ghost,
				bare,
				age,
				transition,
				pixelRatio,
				label
			});
		}, [
			display,
			displayStyle,
			dp,
			color,
			glow,
			background,
			ghost,
			bare,
			age,
			transition,
			pixelRatio,
			label
		]);

		return <canvas ref={canvasRef} className={className} style={{ ...baseStyle, ...style }} />;
	}
);
