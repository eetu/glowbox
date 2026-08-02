// Vue 3 wrapper around @glowbox/split-flap's canvas board. Give it `text` (a string
// or one string per row — modules spin forward to it) plus optional appearance props
// that mirror the core options and update live. The canvas fills its parent — size
// the parent to size the board. A render-function component (no SFC). Ships in
// @glowbox/vue alongside <LedGrid> + <NixieTube> + <SevenSegment> + <FlipDots>,
// over the sibling core.
import { createSplitFlap, type SplitFlapBoard, type SplitFlapOptions } from '@glowbox/split-flap';
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
 * `<SplitFlap>` mounts a split-flap board. `expose()`s the imperative
 * `SplitFlapBoard` handle as `board` (`setText`, `setLine`, `setChar`, …).
 */
export const SplitFlap = defineComponent({
	name: 'SplitFlap',
	props: {
		/** The shown text: a string (newlines split rows) or one string per row.
		 *  Only modules whose character changes spin — forward, wrapping the drum. */
		text: { type: [String, Array] as PropType<string | string[]>, default: undefined },
		cols: { type: Number, default: undefined },
		rows: { type: Number, default: undefined },
		/** The drum: flap sequence in rotation order. */
		charset: { type: String, default: undefined },
		/** Drum zones: rectangles of modules with their own drum (digit fields etc). */
		drums: { type: Array as PropType<SplitFlapOptions['drums']>, default: undefined },
		/** Per-flap faces: solid paint (chroma flaps) or re-inked glyphs. */
		palette: { type: Object as PropType<SplitFlapOptions['palette']>, default: undefined },
		card: { type: [String, Array] as PropType<SplitFlapOptions['card']>, default: undefined },
		ink: { type: [String, Array] as PropType<SplitFlapOptions['ink']>, default: undefined },
		/** Frame behind/between the modules. */
		board: { type: [String, Array] as PropType<SplitFlapOptions['board']>, default: undefined },
		gap: { type: Number, default: undefined },
		font: { type: String, default: undefined },
		// default: undefined (not the Boolean-absent → false cast) so the core's own
		// defaults apply when the prop is omitted.
		/** Opt-in lighting story (wells, clips, the fallen pile); flat matte default. */
		shaded: { type: Boolean, default: undefined },
		flipMs: { type: Number, default: undefined },
		/** Card slap: true (= 0.5) or a 0..1 volume. */
		sound: { type: [Boolean, Number], default: undefined },
		pixelRatio: { type: Number, default: undefined },
		label: { type: String, default: undefined },
		/** Called with the board after creation, and with null on teardown — the same
		 *  contract as the Svelte wrapper. Bind as `:oncreate="fn"` (an `@create`
		 *  listener would camelize to `onCreate` and miss it). */
		oncreate: {
			type: Function as PropType<(board: SplitFlapBoard | null) => void>,
			default: undefined
		}
	},
	setup(props, { expose }) {
		const canvas = ref<HTMLCanvasElement | null>(null);
		let flaps: SplitFlapBoard | null = null;

		const options = () => ({
			cols: props.cols,
			rows: props.rows,
			charset: props.charset,
			drums: props.drums,
			palette: props.palette,
			card: props.card,
			ink: props.ink,
			board: props.board,
			gap: props.gap,
			font: props.font,
			shaded: props.shaded,
			flipMs: props.flipMs,
			sound: props.sound,
			pixelRatio: props.pixelRatio,
			label: props.label
		});

		onMounted(() => {
			if (!canvas.value) return;
			flaps = createSplitFlap(canvas.value, options());
			if (!flaps) {
				console.warn('SplitFlap: 2D canvas unavailable');
				return;
			}
			if (props.text != null) flaps.setText(props.text);
			props.oncreate?.(flaps);
		});

		// Live-update the shown text.
		watch(
			() => props.text,
			(t) => {
				if (t != null) flaps?.setText(t);
			}
		);

		// Live-update appearance when any option changes.
		watch(
			() => options(),
			() => flaps?.setOptions(options()),
			{ deep: true }
		);

		onUnmounted(() => {
			if (!flaps) return;
			flaps.dispose();
			flaps = null;
			props.oncreate?.(null);
		});

		// Expose the live board handle for imperative access via the component ref.
		expose({
			get board() {
				return flaps;
			}
		});

		return () => h('canvas', { ref: canvas, style: baseStyle });
	}
});
