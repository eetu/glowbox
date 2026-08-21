// Vue 3 wrapper around @glowbox/lcd's canvas module. Give it `text` (the crystals
// chase it at their own speed) plus optional appearance props that mirror the core
// options and update live. CGRAM glyphs and the cursor position are imperative — use
// the exposed handle or `:oncreate`. The canvas fills its parent — size the parent to
// size the module. A render-function component (no SFC). Ships in @glowbox/vue
// alongside the other seven displays, over the sibling @glowbox/lcd core.
import {
	createLcdModule,
	type LcdCursor,
	type LcdModule as LcdModuleHandle,
	type LcdModuleOptions,
	type PanelName
} from '@glowbox/lcd';
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
 * `<LcdModule>` mounts a character LCD module (HD44780-class). `expose()`s the
 * imperative `LcdModule` handle as `lcd` (`setText`, `setGlyph`, `setCursor`,
 * `power`, …).
 */
export const LcdModule = defineComponent({
	name: 'LcdModule',
	props: {
		/** The shown text: a string (newlines split rows) or one string per row.
		 *  The shutters take real time to move — new text smears in. */
		text: { type: [String, Array] as PropType<string | string[]>, default: undefined },
		cols: { type: Number, default: undefined },
		rows: { type: Number, default: undefined },
		/** The glass: 'green' (STN, readable unlit), 'blue' (negative), 'white' (FSTN). */
		panel: { type: String as PropType<PanelName>, default: undefined },
		/** true/false or a 0..1 level; the negative blue glass needs it to read at all. */
		backlight: { type: [Boolean, Number], default: undefined },
		/** The trimmer 0..1; past ~0.85 the lattice darkens and crosstalk streaks grow. */
		contrast: { type: Number, default: undefined },
		/** Liquid-crystal speed 0..1 (0 snaps, 1 is cold glass). */
		response: { type: Number, default: undefined },
		// default: undefined (not the Boolean-absent → false cast) so the core's own
		// defaults (ghost/on/boot = true) apply when the prop is omitted.
		/** The resting dot lattice. */
		ghost: { type: Boolean, default: undefined },
		/** 'none' | 'line' | 'block' (blinking); position via the handle's setCursor. */
		cursor: { type: String as PropType<LcdCursor>, default: undefined },
		/** Wear 0..1: dimming, then a flickering column, then a dead column. */
		age: { type: Number, default: undefined },
		/** Extension glyphs over the vendored ASCII face — character → 5×7 ASCII art
		 *  (the core exports LATIN_5X7 ready-made); null resets to the plain face. */
		glyphs: {
			type: [Object, null] as PropType<LcdModuleOptions['glyphs']>,
			default: undefined
		},
		/** Power — off drains the ink at crystal speed. */
		on: { type: Boolean, default: undefined },
		/** The uninitialised boot row of solid blocks on power-up. */
		boot: { type: Boolean, default: undefined },
		/** The plastic frame; null = no plastic, and the glass takes the room. */
		bezel: {
			type: [String, Array, null] as PropType<LcdModuleOptions['bezel']>,
			default: undefined
		},
		/** Frame thickness in dot pitches (default 3); 0 is the same as null. */
		bezelWidth: { type: Number, default: undefined },
		pixelRatio: { type: Number, default: undefined },
		label: { type: String, default: undefined },
		/** Called with the module after creation, and with null on teardown — the same
		 *  contract as the Svelte wrapper. Bind as `:oncreate="fn"` (an `@create`
		 *  listener would camelize to `onCreate` and miss it). */
		oncreate: {
			type: Function as PropType<(lcd: LcdModuleHandle | null) => void>,
			default: undefined
		}
	},
	setup(props, { expose }) {
		const canvas = ref<HTMLCanvasElement | null>(null);
		let lcd: LcdModuleHandle | null = null;

		const options = () => ({
			cols: props.cols,
			rows: props.rows,
			panel: props.panel,
			backlight: props.backlight,
			contrast: props.contrast,
			response: props.response,
			ghost: props.ghost,
			cursor: props.cursor,
			age: props.age,
			glyphs: props.glyphs,
			on: props.on,
			boot: props.boot,
			bezel: props.bezel,
			bezelWidth: props.bezelWidth,
			pixelRatio: props.pixelRatio,
			label: props.label
		});

		onMounted(() => {
			if (!canvas.value) return;
			lcd = createLcdModule(canvas.value, { ...options(), text: props.text });
			if (!lcd) {
				console.warn('LcdModule: 2D canvas unavailable');
				return;
			}
			props.oncreate?.(lcd);
		});

		// Live-update the shown text.
		watch(
			() => props.text,
			(t) => {
				if (t != null) lcd?.setText(t);
			}
		);

		// Live-update appearance when any option changes.
		watch(
			() => options(),
			() => lcd?.setOptions(options()),
			{ deep: true }
		);

		onUnmounted(() => {
			if (!lcd) return;
			lcd.dispose();
			lcd = null;
			props.oncreate?.(null);
		});

		// Expose the live module handle for imperative access via the component ref.
		expose({
			get lcd() {
				return lcd;
			}
		});

		return () => h('canvas', { ref: canvas, style: baseStyle });
	}
});
