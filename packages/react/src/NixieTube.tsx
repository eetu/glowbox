// React wrapper around @glowbox/nixie's canvas tube. Give it a `value` (the lit symbol)
// plus optional appearance props that mirror the core NixieOptions and update live. The
// canvas fills its parent — size the parent to size the tube. Ships in @glowbox/react
// alongside <LedGrid>, over the sibling @glowbox/nixie core.
import {
	createNixieTube,
	type NixieOptions,
	type NixieStyle,
	type NixieTube as NixieTubeHandle
} from '@glowbox/nixie';
import {
	type CSSProperties,
	forwardRef,
	useEffect,
	useImperativeHandle,
	useRef,
	useState
} from 'react';

export interface NixieTubeProps {
	/** The lit symbol: a char `0`–`9`, `:`, `-`, or null/'' for all-cathodes-dark. */
	value?: string | number | null;
	/** Physical tube style — maps to the core `style` option (renamed to avoid the DOM `style`). */
	tubeStyle?: NixieStyle;
	color?: NixieOptions['color'];
	glow?: number;
	background?: NixieOptions['background'];
	mesh?: boolean;
	ghost?: boolean;
	pixelRatio?: number;
	/** Accessible name (`aria-label`); defaults to the lit symbol itself. */
	label?: string;
	/** Called with the tube after creation, and with null on teardown — the
	 *  Svelte wrapper's `oncreate` contract, for consumers who want a signal
	 *  rather than watching the forwarded ref flip silently. */
	oncreate?: (tube: NixieTubeHandle | null) => void;
	className?: string;
	style?: CSSProperties;
}

// The canvas fills its parent by default; give the parent a size.
const baseStyle: CSSProperties = { display: 'block', width: '100%', height: '100%' };

/**
 * `<NixieTube>` mounts a single glowing nixie-tube numeral. Forward a ref to reach the
 * imperative `NixieTube` handle (`setValue`, `setOptions`, `resize`, `snapshot`, …).
 */
// forwardRef (not the React-19 ref-as-prop) so the same build works against the React 18 peer.
// eslint-disable-next-line @eslint-react/no-forward-ref
export const NixieTube = forwardRef<NixieTubeHandle | null, NixieTubeProps>(
	function NixieTube(props, ref) {
		const {
			value = null,
			tubeStyle = 'classic',
			color,
			glow,
			background,
			mesh,
			ghost,
			pixelRatio,
			label,
			className,
			style
		} = props;
		const canvasRef = useRef<HTMLCanvasElement>(null);
		const [tube, setTube] = useState<NixieTubeHandle | null>(null);

		// Latest props, read once at creation (create mount-only; later effects sync).
		const latestRef = useRef(props);
		latestRef.current = props;

		// Create the tube once for the canvas; dispose on unmount.
		useEffect(() => {
			const canvas = canvasRef.current;
			if (!canvas) return;
			const p = latestRef.current;
			const t = createNixieTube(canvas, {
				value: p.value,
				style: p.tubeStyle,
				color: p.color,
				glow: p.glow,
				background: p.background,
				mesh: p.mesh,
				ghost: p.ghost,
				pixelRatio: p.pixelRatio,
				label: p.label
			});
			if (!t) {
				console.warn('NixieTube: 2D canvas unavailable');
				return;
			}
			setTube(t);
			latestRef.current.oncreate?.(t);
			return () => {
				t.dispose();
				setTube(null);
				latestRef.current.oncreate?.(null);
			};
		}, []);

		useImperativeHandle<NixieTubeHandle | null, NixieTubeHandle | null>(ref, () => tube, [tube]);

		// Live-update the lit symbol.
		useEffect(() => {
			tube?.setValue(value);
		}, [tube, value]);

		// Live-update appearance when any option changes.
		useEffect(() => {
			tube?.setOptions({
				style: tubeStyle,
				color,
				glow,
				background,
				mesh,
				ghost,
				pixelRatio,
				label
			});
		}, [tube, tubeStyle, color, glow, background, mesh, ghost, pixelRatio, label]);

		return <canvas ref={canvasRef} className={className} style={{ ...baseStyle, ...style }} />;
	}
);
