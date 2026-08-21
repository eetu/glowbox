// Vue 3 wrapper around @glowbox/seven-segment's canvas digit. Give it a `value` (the
// shown symbol) plus optional appearance props that mirror the core options and update
// live. The canvas fills its parent — size the parent to size the digit. A
// render-function component (no SFC). Ships in @glowbox/vue alongside <LedGrid> +
// <NixieTube>, over the sibling core.
import {
	createSevenSegment,
	type SevenSegmentDisplay,
	type SevenSegmentOptions,
	type SevenSegmentStyle
} from '@glowbox/seven-segment';
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

// The canvas fills its parent by default; give the parent a size.
const baseStyle: StyleValue = { display: 'block', width: '100%', height: '100%' };

/**
 * `<SevenSegment>` mounts a single seven-segment digit. `expose()`s the imperative
 * `SevenSegmentDisplay` handle as `display` (`setValue`, `setOptions`, `resize`, …).
 */
export const SevenSegment = defineComponent({
	name: 'SevenSegment',
	props: {
		/** The shown symbol: `0`–`9`, `-`, hex `A b C d E F`, `:`, or null/'' for dark. */
		value: { type: [String, Number] as PropType<string | number | null>, default: null },
		/** Display material — maps to the core `style` option (renamed to avoid Vue's `style`). */
		displayStyle: { type: String as PropType<SevenSegmentStyle>, default: 'led' },
		// default: undefined (not the Boolean-absent → false cast) so the core's own
		// defaults (dp = false, ghost = true) apply when the prop is omitted.
		dp: { type: Boolean, default: undefined },
		color: { type: [String, Array] as PropType<SevenSegmentOptions['color']>, default: undefined },
		glow: { type: Number, default: undefined },
		background: {
			type: [String, Array] as PropType<SevenSegmentOptions['background']>,
			default: undefined
		},
		ghost: { type: Boolean, default: undefined },
		/** Drop the window module — segments on a transparent canvas. */
		bare: { type: Boolean, default: undefined },
		/** Wear 0..1 — per-segment dimming, then flicker, then a dead segment. */
		age: { type: Number, default: undefined },
		/** Per-segment cross-fade ms on value changes. */
		transition: { type: Number, default: undefined },
		pixelRatio: { type: Number, default: undefined },
		/** Accessible name (`aria-label`); defaults to the shown symbol itself. */
		label: { type: String, default: undefined },
		/** Colour bundle: 'dark' (default), 'light', or 'auto' to follow the page. */
		theme: { type: String as PropType<SevenSegmentOptions['theme']>, default: undefined },
		/** Called with the display after creation, and with null on teardown — the same
		 *  contract as the Svelte wrapper. Bind as `:oncreate="fn"` (an `@create`
		 *  listener would camelize to `onCreate` and miss it). */
		oncreate: {
			type: Function as PropType<(display: SevenSegmentDisplay | null) => void>,
			default: undefined
		}
	},
	setup(props, { expose }) {
		const canvas = ref<HTMLCanvasElement | null>(null);
		let display: SevenSegmentDisplay | null = null;

		const options = () => ({
			style: props.displayStyle,
			dp: props.dp,
			color: props.color,
			glow: props.glow,
			background: props.background,
			ghost: props.ghost,
			bare: props.bare,
			age: props.age,
			transition: props.transition,
			pixelRatio: props.pixelRatio,
			theme: props.theme,
			label: props.label
		});

		onMounted(() => {
			if (!canvas.value) return;
			display = createSevenSegment(canvas.value, { value: props.value, ...options() });
			if (!display) {
				console.warn('SevenSegment: 2D canvas unavailable');
				return;
			}
			props.oncreate?.(display);
		});

		// Live-update the shown symbol.
		watch(
			() => props.value,
			(v) => display?.setValue(v)
		);

		// Live-update appearance when any option changes.
		watch(
			() => options(),
			() => display?.setOptions(options()),
			{ deep: true }
		);

		onUnmounted(() => {
			if (!display) return;
			display.dispose();
			display = null;
			props.oncreate?.(null);
		});

		// Expose the live display handle for imperative access via the component ref.
		expose({
			get display() {
				return display;
			}
		});

		return () => h('canvas', { ref: canvas, style: baseStyle });
	}
});
