// Vue 3 wrapper around @glowbox/nixie's canvas tube. Give it a `value` (the lit symbol)
// plus optional appearance props that mirror the core NixieOptions and update live. The
// canvas fills its parent — size the parent to size the tube. A render-function component
// (no SFC). Ships in @glowbox/vue alongside <LedGrid>, over the sibling @glowbox/nixie core.
import {
	createNixieTube,
	type NixieOptions,
	type NixieStyle,
	type NixieTube as NixieTubeHandle
} from '@glowbox/nixie';
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
 * `<NixieTube>` mounts a single glowing nixie-tube numeral. `expose()`s the imperative
 * `NixieTube` handle as `tube` (`setValue`, `setOptions`, `resize`, `snapshot`, …).
 */
export const NixieTube = defineComponent({
	name: 'NixieTube',
	props: {
		/** The lit symbol: a char `0`–`9`, `:`, `-`, or null/'' for all-cathodes-dark. */
		value: { type: [String, Number] as PropType<string | number | null>, default: null },
		/** Physical tube style — maps to the core `style` option (renamed to avoid Vue's `style`). */
		tubeStyle: { type: String as PropType<NixieStyle>, default: 'classic' },
		color: { type: [String, Array] as PropType<NixieOptions['color']>, default: undefined },
		glow: { type: Number, default: undefined },
		background: {
			type: [String, Array] as PropType<NixieOptions['background']>,
			default: undefined
		},
		// default: undefined (not the Boolean-absent → false cast) so the core's own
		// defaults (mesh/ghost = true) apply when the prop is omitted.
		mesh: { type: Boolean, default: undefined },
		ghost: { type: Boolean, default: undefined },
		pixelRatio: { type: Number, default: undefined }
	},
	setup(props, { expose }) {
		const canvas = ref<HTMLCanvasElement | null>(null);
		let tube: NixieTubeHandle | null = null;

		const options = () => ({
			style: props.tubeStyle,
			color: props.color,
			glow: props.glow,
			background: props.background,
			mesh: props.mesh,
			ghost: props.ghost,
			pixelRatio: props.pixelRatio
		});

		onMounted(() => {
			if (!canvas.value) return;
			tube = createNixieTube(canvas.value, { value: props.value, ...options() });
			if (!tube) console.warn('NixieTube: 2D canvas unavailable');
		});

		// Live-update the lit symbol.
		watch(
			() => props.value,
			(v) => tube?.setValue(v)
		);

		// Live-update appearance when any option changes.
		watch(
			() => [
				props.tubeStyle,
				props.color,
				props.glow,
				props.background,
				props.mesh,
				props.ghost,
				props.pixelRatio
			],
			() => tube?.setOptions(options()),
			{ deep: true }
		);

		onUnmounted(() => {
			tube?.dispose();
			tube = null;
		});

		// Expose the live tube handle for imperative access via the component ref.
		expose({
			get tube() {
				return tube;
			}
		});

		return () => h('canvas', { ref: canvas, style: baseStyle });
	}
});
