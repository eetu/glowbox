// React wrapper around the plain-JS LED display. Give it a `size` and an optional
// `draw(d, dt)` callback; the grouped option props (led/color/camera/interaction/
// quality) mirror @glowbox/led-grid's options 1:1 and update live. All content is the
// client's — this ships no programs. Mirrors @glowbox/svelte over the same core.
import {
	type CameraOptions,
	type ColorOptions,
	createLedDisplay,
	type InteractionOptions,
	type LedDisplay,
	type LedOptions,
	type QualityOptions
} from '@glowbox/led-grid';
import {
	type CSSProperties,
	forwardRef,
	useEffect,
	useImperativeHandle,
	useRef,
	useState
} from 'react';

export interface LedGridProps {
	/** Grid size [nx, ny, nz]. Changing it resizes in place (no remount). */
	size: [number, number, number];
	/** Called every frame; write voxels here. */
	draw?: (d: LedDisplay, dt: number) => void;
	led?: LedOptions;
	color?: ColorOptions;
	camera?: CameraOptions;
	interaction?: InteractionOptions;
	quality?: QualityOptions;
	className?: string;
	style?: CSSProperties;
}

// The canvas fills its parent by default; give the parent a size.
const baseStyle: CSSProperties = {
	display: 'block',
	width: '100%',
	height: '100%',
	touchAction: 'none' // let drag-orbit work without the page panning
};

/**
 * `<LedGrid>` mounts a 3D WebGL LED-grid display and runs your per-frame draw
 * callback. Forward a ref to reach the imperative `LedDisplay` handle
 * (`snapshot()`, `stats`, `setCamera`, …).
 */
// forwardRef (not the React-19 ref-as-prop) so the same build works against the
// React 18 peer too.
// eslint-disable-next-line @eslint-react/no-forward-ref
export const LedGrid = forwardRef<LedDisplay | null, LedGridProps>(function LedGrid(props, ref) {
	const { size, draw, led, color, camera, interaction, quality, className, style } = props;
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [display, setDisplay] = useState<LedDisplay | null>(null);

	// Latest props, read once at creation (so the create effect can run mount-only
	// while later effects keep everything in sync).
	const latestRef = useRef(props);
	latestRef.current = props;

	// Create the display once for the canvas; dispose on unmount.
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const p = latestRef.current;
		const d = createLedDisplay(canvas, {
			size: p.size,
			led: p.led,
			color: p.color,
			camera: p.camera,
			interaction: p.interaction,
			quality: p.quality
		});
		if (!d) {
			console.warn('LedGrid: WebGL unavailable');
			return;
		}
		setDisplay(d);
		return () => {
			d.dispose();
			setDisplay(null);
		};
	}, []);

	// Expose the display via the forwarded ref (null until it exists).
	useImperativeHandle<LedDisplay | null, LedDisplay | null>(ref, () => display, [display]);

	// Resize the grid in place when the dimensions change (no remount / context loss).
	const [sx, sy, sz] = size;
	useEffect(() => {
		display?.resize([sx, sy, sz]);
	}, [display, sx, sy, sz]);

	// Live-update each option group *independently*. Patching all groups on any one change
	// would re-send `camera` (yaw/pitch/distance) on, say, a colour tweak — snapping the
	// view back and fighting drag / auto-orbit. One effect per group patches only what changed.
	useEffect(() => {
		display?.setOptions({ led });
	}, [display, led]);
	useEffect(() => {
		display?.setOptions({ color });
	}, [display, color]);
	useEffect(() => {
		display?.setOptions({ camera });
	}, [display, camera]);
	useEffect(() => {
		display?.setOptions({ interaction });
	}, [display, interaction]);
	useEffect(() => {
		display?.setOptions({ quality });
	}, [display, quality]);

	// (Re)bind the per-frame draw callback.
	useEffect(() => {
		if (!display || !draw) return;
		return display.onFrame(draw);
	}, [display, draw]);

	return <canvas ref={canvasRef} className={className} style={{ ...baseStyle, ...style }} />;
});
