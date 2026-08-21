// Vue 3 wrapper around @glowbox/flip-dot's canvas board. Give it a `frame` (row-major
// 0/1 bits or an (x, y) => on function) plus optional appearance props that mirror the
// core options and update live. The canvas fills its parent — size the parent to size
// the board. A render-function component (no SFC). Ships in @glowbox/vue alongside
// <LedGrid> + <NixieTube> + <SevenSegment>, over the sibling core.
import {
	createFlipDots,
	type FlipDotBoard,
	type FlipDotShape,
	type FlipDotsOptions,
	type FlipDotStagger
} from '@glowbox/flip-dot';
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

/** What `<FlipDots frame>` accepts: row-major 0/1 bits or an (x, y) => on function. */
export type Frame = ArrayLike<number> | ((x: number, y: number) => number | boolean);

/**
 * `<FlipDots>` mounts a flip-dot board. `expose()`s the imperative `FlipDotBoard`
 * handle as `board` (`set`, `setFrame`, `setOptions`, `resize`, …).
 */
export const FlipDots = defineComponent({
	name: 'FlipDots',
	props: {
		/** The shown frame: row-major 0/1 bits (`ditherFrame` output fits) or an
		 *  (x, y) => on function. Only dots that actually change flip. */
		frame: { type: [Object, Function, Array] as PropType<Frame>, default: undefined },
		cols: { type: Number, default: undefined },
		rows: { type: Number, default: undefined },
		shape: { type: String as PropType<FlipDotShape>, default: undefined },
		onColor: { type: [String, Array] as PropType<FlipDotsOptions['onColor']>, default: undefined },
		offColor: {
			type: [String, Array] as PropType<FlipDotsOptions['offColor']>,
			default: undefined
		},
		/** Board plastic behind the dots. */
		board: { type: [String, Array] as PropType<FlipDotsOptions['board']>, default: undefined },
		gap: { type: Number, default: undefined },
		// default: undefined (not the Boolean-absent → false cast) so the core's own
		// defaults apply when the prop is omitted.
		/** Opt-in lighting story (gradients, socket wells, glint); flat matte default. */
		shaded: { type: Boolean, default: undefined },
		flipMs: { type: Number, default: undefined },
		/** Pivot-axis angle in degrees. */
		axis: { type: Number, default: undefined },
		stagger: { type: String as PropType<FlipDotStagger>, default: undefined },
		scanMs: { type: Number, default: undefined },
		/** Solenoid click: true (= 0.5) or a 0..1 volume. */
		sound: { type: [Boolean, Number], default: undefined },
		pixelRatio: { type: Number, default: undefined },
		label: { type: String, default: undefined },
		/** Colour bundle: 'dark' (default), 'light', or 'auto' to follow the page. */
		theme: { type: String as PropType<FlipDotsOptions['theme']>, default: undefined },
		/** Called with the board after creation, and with null on teardown — the same
		 *  contract as the Svelte wrapper. Bind as `:oncreate="fn"` (an `@create`
		 *  listener would camelize to `onCreate` and miss it). */
		oncreate: {
			type: Function as PropType<(board: FlipDotBoard | null) => void>,
			default: undefined
		}
	},
	setup(props, { expose }) {
		const canvas = ref<HTMLCanvasElement | null>(null);
		let dots: FlipDotBoard | null = null;

		const options = () => ({
			cols: props.cols,
			rows: props.rows,
			shape: props.shape,
			onColor: props.onColor,
			offColor: props.offColor,
			board: props.board,
			gap: props.gap,
			shaded: props.shaded,
			flipMs: props.flipMs,
			axis: props.axis,
			stagger: props.stagger,
			scanMs: props.scanMs,
			sound: props.sound,
			pixelRatio: props.pixelRatio,
			theme: props.theme,
			label: props.label
		});

		onMounted(() => {
			if (!canvas.value) return;
			dots = createFlipDots(canvas.value, options());
			if (!dots) {
				console.warn('FlipDots: 2D canvas unavailable');
				return;
			}
			if (props.frame) dots.setFrame(props.frame);
			props.oncreate?.(dots);
		});

		// Live-update the shown frame.
		watch(
			() => props.frame,
			(f) => {
				if (f) dots?.setFrame(f);
			}
		);

		// Live-update appearance when any option changes.
		watch(
			() => options(),
			() => dots?.setOptions(options()),
			{ deep: true }
		);

		onUnmounted(() => {
			if (!dots) return;
			dots.dispose();
			dots = null;
			props.oncreate?.(null);
		});

		// Expose the live board handle for imperative access via the component ref.
		expose({
			get board() {
				return dots;
			}
		});

		return () => h('canvas', { ref: canvas, style: baseStyle });
	}
});
