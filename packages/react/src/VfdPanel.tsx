// React wrapper around @glowbox/vfd's canvas panel. Declare the hardware once
// (`frame` + `layout`) and drive the content — either declaratively through `values`,
// or imperatively through a forwarded ref, which is what an animated spectrum wants.
// The canvas fills its parent — size the parent to size the panel. Ships in
// @glowbox/react alongside <LedGrid> + <NixieTube> + <SevenSegment> + <FlipDots> +
// <SplitFlap> + <NeonSign>, over the sibling core.
import {
	createVfdPanel,
	type VfdPanel as VfdPanelHandle,
	type VfdPanelOptions
} from '@glowbox/vfd';
import {
	type CSSProperties,
	forwardRef,
	useEffect,
	useImperativeHandle,
	useRef,
	useState
} from 'react';

/** What a panel element can be told to show, dispatched by the value's own type. */
export type VfdValue = string | number | boolean | number[];

export interface VfdPanelProps {
	/** The panel design frame, `[width, height]` — the units every element box is in. */
	frame?: VfdPanelOptions['frame'];
	/** The elements printed on the plate. Fixed hardware: a change re-compiles the whole
	 *  anode inventory, so memoize it rather than rebuilding it inline on every render. */
	layout?: VfdPanelOptions['layout'];
	/** Content by element name, pushed on change: a string/number drives a `digits`
	 *  field or a `scale` cursor, a boolean switches a `legend`/`icon`, a number[] feeds
	 *  a `bars` element. Only changed entries are pushed. */
	values?: Record<string, VfdValue>;
	/** Anode phosphor: 'zn-o' (the stereo cyan-green), 'blue', 'amber', 'white'. */
	phosphor?: VfdPanelOptions['phosphor'];
	/** The tinted window: 'none' | 'green' | 'smoke' | 'amber', or any colour. */
	filter?: VfdPanelOptions['filter'];
	/** Extra tinted windows over regions of the glass — a zone belongs to the panel, not to
	 *  an element, because that is what it is: plastic laid over a rectangle. */
	zones?: VfdPanelOptions['zones'];
	/** THE DIMMER 0..1 — the whole panel at once, non-linearly. 0 is DISPLAY OFF. */
	brightness?: number;
	/** Phosphor persistence 0..1 — the smear a falling bar leaves behind it. */
	persistence?: number;
	/** The filament wires across the glass, over everything. */
	filament?: boolean;
	/** The control-grid mesh, continuous across the panel. */
	grid?: boolean;
	/** Wear 0..1: per-anode dimming → a dim multiplex column → flicker → dead. */
	age?: number;
	glow?: number;
	/** The faceplate around the glass; null = transparent outside the glass. */
	bezel?: VfdPanelOptions['bezel'];
	/** The unlit glass itself. */
	glass?: VfdPanelOptions['glass'];
	/** Power — off leaves the glass and its ghosts visible. */
	on?: boolean;
	/** Light every anode for ~1 s on power-on before settling. */
	selfTest?: boolean;
	pixelRatio?: number;
	label?: string;
	className?: string;
	style?: CSSProperties;
}

// The canvas fills its parent by default; give the parent a size.
const baseStyle: CSSProperties = { display: 'block', width: '100%', height: '100%' };

/**
 * `<VfdPanel>` mounts a vacuum-fluorescent display panel. Forward a ref to reach the
 * imperative handle (`set`, `light`, `bars`, `selfTest`, `elementAt`, …).
 */
// forwardRef (not the React-19 ref-as-prop) so the same build works against the React 18 peer.
// eslint-disable-next-line @eslint-react/no-forward-ref
export const VfdPanel = forwardRef<VfdPanelHandle | null, VfdPanelProps>(
	function VfdPanel(props, ref) {
		const {
			frame,
			layout,
			values,
			phosphor,
			filter,
			zones,
			brightness,
			persistence,
			filament,
			grid,
			age,
			glow,
			bezel,
			glass,
			on,
			selfTest,
			pixelRatio,
			label,
			className,
			style
		} = props;
		const canvasRef = useRef<HTMLCanvasElement>(null);
		const [panel, setPanel] = useState<VfdPanelHandle | null>(null);
		// Last-pushed content, so an unchanged value never re-drives the envelope.
		const pushedRef = useRef<Record<string, string>>({});

		// Latest props, read once at creation (create mount-only; later effects sync).
		const latestRef = useRef(props);
		latestRef.current = props;

		// Create the panel once for the canvas; dispose on unmount.
		useEffect(() => {
			const canvas = canvasRef.current;
			if (!canvas) return;
			const p = latestRef.current;
			const created = createVfdPanel(canvas, {
				frame: p.frame,
				layout: p.layout,
				phosphor: p.phosphor,
				filter: p.filter,
				zones: p.zones,
				brightness: p.brightness,
				persistence: p.persistence,
				filament: p.filament,
				grid: p.grid,
				age: p.age,
				glow: p.glow,
				bezel: p.bezel,
				glass: p.glass,
				on: p.on,
				selfTest: p.selfTest,
				pixelRatio: p.pixelRatio,
				label: p.label
			});
			if (!created) {
				console.warn('VfdPanel: 2D canvas unavailable');
				return;
			}
			pushedRef.current = {};
			setPanel(created);
			return () => {
				created.dispose();
				setPanel(null);
			};
		}, []);

		useImperativeHandle<VfdPanelHandle | null, VfdPanelHandle | null>(ref, () => panel, [panel]);

		// Push changed content. The value's own type says which wire it goes down, so the
		// caller never has to restate the element's kind.
		useEffect(() => {
			if (!panel || !values) return;
			for (const [name, value] of Object.entries(values)) {
				const key = JSON.stringify(value);
				if (pushedRef.current[name] === key) continue;
				pushedRef.current[name] = key;
				if (typeof value === 'boolean') panel.light(name, value);
				else if (Array.isArray(value)) panel.setBars(name, value);
				else panel.set(name, value);
			}
		}, [panel, values]);

		// The hardware gets its own effect and its own call: re-compiling the anode inventory
		// is the one expensive thing here, so it must not ride along with the appearance patch
		// below, which is cheap and fires on every prop change.
		useEffect(() => {
			if (layout) panel?.setLayout(layout, frame);
		}, [panel, layout, frame]);

		// Live-update appearance. Nothing here re-compiles.
		useEffect(() => {
			panel?.setOptions({
				phosphor,
				filter,
				zones,
				brightness,
				persistence,
				filament,
				grid,
				age,
				glow,
				bezel,
				glass,
				on,
				selfTest,
				pixelRatio,
				label
			});
		}, [
			panel,
			phosphor,
			filter,
			zones,
			brightness,
			persistence,
			filament,
			grid,
			age,
			glow,
			bezel,
			glass,
			on,
			selfTest,
			pixelRatio,
			label
		]);

		return <canvas ref={canvasRef} className={className} style={{ ...baseStyle, ...style }} />;
	}
);
