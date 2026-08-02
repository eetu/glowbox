// Vue 3 wrapper around @glowbox/vfd's canvas panel. Declare the hardware once
// (`frame` + `layout`) and drive the content — either declaratively through `values`,
// or imperatively through the exposed handle, which is what an animated spectrum wants.
// The canvas fills its parent — size the parent to size the panel. A render-function
// component (no SFC). Ships in @glowbox/vue alongside <LedGrid> + <NixieTube> +
// <SevenSegment> + <FlipDots> + <SplitFlap> + <NeonSign>, over the sibling core.
import {
	createVfdPanel,
	type VfdPanel as VfdPanelHandle,
	type VfdPanelOptions
} from '@glowbox/vfd';
import {
	defineComponent,
	h,
	onMounted,
	onUnmounted,
	type PropType,
	ref,
	type StyleValue,
	watch
} from 'vue';

/** What a panel element can be told to show, dispatched by the value's own type. */
export type VfdValue = string | number | boolean | number[];

// The canvas fills its parent by default; give the parent a size.
const baseStyle: StyleValue = { display: 'block', width: '100%', height: '100%' };

/**
 * `<VfdPanel>` mounts a vacuum-fluorescent display panel. `expose()`s the imperative
 * handle as `panel` (`set`, `light`, `bars`, `selfTest`, `elementAt`, …).
 */
export const VfdPanel = defineComponent({
	name: 'VfdPanel',
	props: {
		/** The panel design frame, `[width, height]` — the units every element box is in. */
		frame: { type: Array as unknown as PropType<VfdPanelOptions['frame']>, default: undefined },
		/** The elements printed on the plate. Fixed hardware: a change re-compiles the whole
		 *  anode inventory, so hand over a stable array rather than rebuilding it inline. */
		layout: { type: Array as PropType<VfdPanelOptions['layout']>, default: undefined },
		/** Content by element name, pushed on change: a string/number drives a `digits`
		 *  field or a `scale` cursor, a boolean switches a `legend`/`icon`, a number[]
		 *  feeds a `bars` element. Only changed entries are pushed. */
		values: { type: Object as PropType<Record<string, VfdValue>>, default: undefined },
		/** Anode phosphor: 'zn-o' (the stereo cyan-green), 'blue', 'amber', 'white'. */
		phosphor: { type: String as PropType<VfdPanelOptions['phosphor']>, default: undefined },
		/** The tinted window: 'none' | 'green' | 'smoke' | 'amber', or any colour. */
		filter: {
			type: [String, Array] as PropType<VfdPanelOptions['filter']>,
			default: undefined
		},
		/** Extra tinted windows over regions of the glass — a zone belongs to the panel, not
		 *  to an element, because that is what it is: plastic laid over a rectangle. */
		zones: { type: Array as PropType<VfdPanelOptions['zones']>, default: undefined },
		/** THE DIMMER 0..1 — the whole panel at once, non-linearly. 0 is DISPLAY OFF. */
		brightness: { type: Number, default: undefined },
		/** Phosphor persistence 0..1 — the smear a falling bar leaves behind it. */
		persistence: { type: Number, default: undefined },
		// default: undefined (not the Boolean-absent → false cast) so the core's own
		// defaults apply when the prop is omitted.
		/** The filament wires across the glass, over everything. */
		filament: { type: Boolean, default: undefined },
		/** The control-grid mesh, continuous across the panel. */
		grid: { type: Boolean, default: undefined },
		/** Wear 0..1: per-anode dimming → a dim multiplex column → flicker → dead. */
		age: { type: Number, default: undefined },
		glow: { type: Number, default: undefined },
		/** The faceplate around the glass; null = transparent outside the glass. */
		bezel: { type: [String, Array] as PropType<VfdPanelOptions['bezel']>, default: undefined },
		/** The unlit glass itself. */
		glass: { type: [String, Array] as PropType<VfdPanelOptions['glass']>, default: undefined },
		/** Power — off leaves the glass and its ghosts visible. */
		on: { type: Boolean, default: undefined },
		/** Light every anode for ~1 s on power-on before settling. */
		selfTest: { type: Boolean, default: undefined },
		pixelRatio: { type: Number, default: undefined },
		label: { type: String, default: undefined },
		/** Called with the panel after creation, and with null on teardown — the same
		 *  contract as the Svelte wrapper. Bind as `:oncreate="fn"` (an `@create`
		 *  listener would camelize to `onCreate` and miss it). */
		oncreate: {
			type: Function as PropType<(panel: VfdPanelHandle | null) => void>,
			default: undefined
		}
	},
	setup(props, { expose }) {
		const canvas = ref<HTMLCanvasElement | null>(null);
		let panel: VfdPanelHandle | null = null;
		// Last-pushed content, so an unchanged value never re-drives the envelope.
		let pushed: Record<string, string> = {};

		// The hardware is deliberately NOT in here: re-compiling the anode inventory is the one
		// expensive call, so it goes through `setLayout` on its own watcher.
		const options = () => ({
			phosphor: props.phosphor,
			filter: props.filter,
			zones: props.zones,
			brightness: props.brightness,
			persistence: props.persistence,
			filament: props.filament,
			grid: props.grid,
			age: props.age,
			glow: props.glow,
			bezel: props.bezel,
			glass: props.glass,
			on: props.on,
			selfTest: props.selfTest,
			pixelRatio: props.pixelRatio,
			label: props.label
		});

		// Push changed content. The value's own type says which wire it goes down, so the
		// caller never has to restate the element's kind.
		const pushValues = () => {
			if (!panel || !props.values) return;
			for (const [name, value] of Object.entries(props.values)) {
				const key = JSON.stringify(value);
				if (pushed[name] === key) continue;
				pushed[name] = key;
				if (typeof value === 'boolean') panel.light(name, value);
				else if (Array.isArray(value)) panel.setBars(name, value);
				else panel.set(name, value);
			}
		};

		onMounted(() => {
			if (!canvas.value) return;
			panel = createVfdPanel(canvas.value, {
				...options(),
				frame: props.frame,
				layout: props.layout
			});
			if (!panel) {
				console.warn('VfdPanel: 2D canvas unavailable');
				return;
			}
			pushed = {};
			pushValues();
			props.oncreate?.(panel);
		});

		watch(() => props.values, pushValues, { deep: true });

		// The hardware, on its own watcher and its own call — the one expensive one.
		watch(
			() => [props.layout, props.frame] as const,
			() => {
				if (props.layout) panel?.setLayout(props.layout, props.frame);
			}
		);

		// Live-update appearance. Nothing here re-compiles.
		watch(
			() => options(),
			() => panel?.setOptions(options()),
			{ deep: true }
		);

		onUnmounted(() => {
			if (!panel) return;
			panel.dispose();
			panel = null;
			props.oncreate?.(null);
		});

		// Expose the live panel handle for imperative access via the component ref.
		expose({
			get panel() {
				return panel;
			}
		});

		return () => h('canvas', { ref: canvas, style: baseStyle });
	}
});
