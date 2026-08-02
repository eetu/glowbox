// Vue 3 wrapper around @glowbox/neon's canvas sign. Give it `text` (new glass
// strikes on) plus optional appearance props that mirror the core options and
// update live. The canvas fills its parent — size the parent to size the sign.
// A render-function component (no SFC). Ships in @glowbox/vue alongside
// <LedGrid> + <NixieTube> + <SevenSegment> + <FlipDots> + <SplitFlap>, over the
// sibling core.
import {
	createNeonSign,
	type NeonSign as NeonSignHandle,
	type NeonSignOptions
} from '@glowbox/neon';
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
 * `<NeonSign>` mounts a neon sign. `expose()`s the imperative handle as `sign`
 * (`setText`, `power`, `setOptions`, …).
 */
export const NeonSign = defineComponent({
	name: 'NeonSign',
	props: {
		/** The sign's text; '\n' splits lines. A change re-glasses and strikes on. */
		text: { type: String, default: undefined },
		/** Letterform: 'script' (cursive), 'sans' (block), or a custom NeonFont. */
		font: { type: [String, Object] as PropType<NeonSignOptions['font']>, default: undefined },
		/** Sign artwork: single-stroke pieces placed behind/beside the text. */
		art: { type: Array as PropType<NeonSignOptions['art']>, default: undefined },
		/** Tube colour, or one per text line (overrides the gas preset's colour). */
		color: { type: [String, Array] as PropType<NeonSignOptions['color']>, default: undefined },
		/** What's in the glass: 'neon', 'argon', 'helium', 'co2', 'green', 'gold', 'rose'. */
		gas: { type: String as PropType<NeonSignOptions['gas']>, default: undefined },
		/** The wall behind the sign; null = transparent canvas. */
		wall: { type: [String, Array] as PropType<NeonSignOptions['wall']>, default: undefined },
		/** Discharge direction: emit (light) or the invented absorb (dark ink). */
		polarity: { type: String as PropType<NeonSignOptions['polarity']>, default: undefined },
		// default: undefined (not the Boolean-absent → false cast) so the core's own
		// defaults apply when the prop is omitted.
		/** Power — off leaves the unlit glass visible; on re-strikes. */
		on: { type: Boolean, default: undefined },
		/** Per-text-line circuits (the motel sign's separately switched NO). */
		lineOn: { type: Array as PropType<boolean[]>, default: undefined },
		glow: { type: Number, default: undefined },
		/** The unlit tube itself. */
		glass: { type: [String, Array] as PropType<NeonSignOptions['glass']>, default: undefined },
		/** The electrode caps — metal, not light. */
		electrode: {
			type: [String, Array] as PropType<NeonSignOptions['electrode']>,
			default: undefined
		},
		/** Wear 0..1: dimming → a flickering tube → dead glass (the MOT L arc). */
		age: { type: Number, default: undefined },
		/** Electrical instability 0..1: sparse dips and re-strike blips. */
		flicker: { type: Number, default: undefined },
		/** A failing transformer: whole-sign dropouts with staggered re-strikes. */
		tired: { type: Boolean, default: undefined },
		/** The flasher cam: 'steady' | 'flash' | 'chase' | 'reveal' (rate-capped). */
		program: { type: String as PropType<NeonSignOptions['program']>, default: undefined },
		speed: { type: Number, default: undefined },
		/** Tube sectioning: 'auto' | 'glyph' | 'word' | 'line'. */
		tubes: { type: String as PropType<NeonSignOptions['tubes']>, default: undefined },
		align: { type: String as PropType<NeonSignOptions['align']>, default: undefined },
		lineSpacing: { type: Number, default: undefined },
		letterSpacing: { type: Number, default: undefined },
		/** Text block tilt, degrees (negative rises left-to-right). */
		tilt: { type: Number, default: undefined },
		padding: { type: Number, default: undefined },
		/** One tube's strike sequence, ms (0 = instant). */
		strikeMs: { type: Number, default: undefined },
		/** Transformer hum + strike crackle: true (= 0.5) or a 0..1 volume. */
		sound: { type: [Boolean, Number], default: undefined },
		/** Mains frequency the transformer sings at (50 or 60). */
		mains: { type: Number as PropType<NeonSignOptions['mains']>, default: undefined },
		pixelRatio: { type: Number, default: undefined },
		label: { type: String, default: undefined },
		/** Called with the sign after creation, and with null on teardown — the same
		 *  contract as the Svelte wrapper. Bind as `:oncreate="fn"` (an `@create`
		 *  listener would camelize to `onCreate` and miss it). */
		oncreate: {
			type: Function as PropType<(sign: NeonSignHandle | null) => void>,
			default: undefined
		}
	},
	setup(props, { expose }) {
		const canvas = ref<HTMLCanvasElement | null>(null);
		let sign: NeonSignHandle | null = null;

		const options = () => ({
			font: props.font,
			art: props.art,
			color: props.color,
			gas: props.gas,
			wall: props.wall,
			polarity: props.polarity,
			on: props.on,
			lineOn: props.lineOn,
			glow: props.glow,
			glass: props.glass,
			electrode: props.electrode,
			age: props.age,
			flicker: props.flicker,
			tired: props.tired,
			program: props.program,
			speed: props.speed,
			tubes: props.tubes,
			align: props.align,
			lineSpacing: props.lineSpacing,
			letterSpacing: props.letterSpacing,
			tilt: props.tilt,
			padding: props.padding,
			strikeMs: props.strikeMs,
			sound: props.sound,
			mains: props.mains,
			pixelRatio: props.pixelRatio,
			label: props.label
		});

		onMounted(() => {
			if (!canvas.value) return;
			sign = createNeonSign(canvas.value, { ...options(), text: props.text });
			if (!sign) {
				console.warn('NeonSign: 2D canvas unavailable');
				return;
			}
			props.oncreate?.(sign);
		});

		// Live-update the shown text (a change re-glasses and strikes).
		watch(
			() => props.text,
			(t) => {
				if (t != null) sign?.setText(t);
			}
		);

		// Live-update appearance when any option changes.
		watch(
			() => options(),
			() => sign?.setOptions(options()),
			{ deep: true }
		);

		onUnmounted(() => {
			if (!sign) return;
			sign.dispose();
			sign = null;
			props.oncreate?.(null);
		});

		// Expose the live sign handle for imperative access via the component ref.
		expose({
			get sign() {
				return sign;
			}
		});

		return () => h('canvas', { ref: canvas, style: baseStyle });
	}
});
