// Vue 3 wrapper around the plain-JS LED display. Give it a `size` and an optional
// `draw(d, dt)` callback; the grouped option props (led/color/camera/interaction/
// quality) mirror @glowbox/led-grid's options 1:1 and update live. All content is the
// client's — this ships no programs. A render-function component (no SFC), so it
// mirrors @glowbox/svelte over the same core with no template compiler.
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
const baseStyle: StyleValue = {
	display: 'block',
	width: '100%',
	height: '100%',
	touchAction: 'none' // let drag-orbit work without the page panning
};

/**
 * `<LedGrid>` mounts a 3D WebGL LED-grid display and runs your per-frame draw
 * callback. `expose()`s the imperative `LedDisplay` handle as `display`
 * (`snapshot()`, `stats`, `setCamera`, …) on the component ref.
 */
export const LedGrid = defineComponent({
	name: 'LedGrid',
	props: {
		/** Grid size [nx, ny, nz]. Changing it resizes in place (no remount). */
		size: { type: Array as unknown as PropType<[number, number, number]>, required: true },
		/** Called every frame; write voxels here. */
		draw: { type: Function as PropType<(d: LedDisplay, dt: number) => void>, default: undefined },
		led: { type: Object as PropType<LedOptions>, default: undefined },
		color: { type: Object as PropType<ColorOptions>, default: undefined },
		camera: { type: Object as PropType<CameraOptions>, default: undefined },
		interaction: { type: Object as PropType<InteractionOptions>, default: undefined },
		quality: { type: Object as PropType<QualityOptions>, default: undefined },
		/** Accessible name for the canvas (`aria-label`; default 'LED grid'). */
		label: { type: String, default: undefined }
	},
	setup(props, { expose }) {
		const canvas = ref<HTMLCanvasElement | null>(null);
		let display: LedDisplay | null = null;
		let stopFrame: (() => void) | null = null;

		const bindDraw = () => {
			stopFrame?.();
			stopFrame = null;
			if (display && props.draw) stopFrame = display.onFrame(props.draw);
		};

		onMounted(() => {
			if (!canvas.value) return;
			display = createLedDisplay(canvas.value, {
				size: props.size,
				led: props.led,
				color: props.color,
				camera: props.camera,
				interaction: props.interaction,
				quality: props.quality,
				label: props.label
			});
			if (!display) {
				console.warn('LedGrid: WebGL unavailable');
				return;
			}
			bindDraw();
		});

		// Resize the grid in place when the dimensions change (no remount / context loss).
		watch(
			() => [props.size[0], props.size[1], props.size[2]] as [number, number, number],
			(s) => display?.resize(s)
		);

		// Live-update each option group *independently*. Patching all groups on any one
		// change would re-send `camera` (yaw/pitch/distance) on, say, a colour tweak —
		// snapping the view back and fighting drag / auto-orbit. One watch per group.
		watch(
			() => props.led,
			() => display?.setOptions({ led: props.led }),
			{ deep: true }
		);
		watch(
			() => props.color,
			() => display?.setOptions({ color: props.color }),
			{ deep: true }
		);
		watch(
			() => props.camera,
			() => display?.setOptions({ camera: props.camera }),
			{ deep: true }
		);
		watch(
			() => props.interaction,
			() => display?.setOptions({ interaction: props.interaction }),
			{
				deep: true
			}
		);
		watch(
			() => props.quality,
			() => display?.setOptions({ quality: props.quality }),
			{
				deep: true
			}
		);
		watch(
			() => props.label,
			() => display?.setOptions({ label: props.label })
		);

		// (Re)bind the per-frame draw callback.
		watch(
			() => props.draw,
			() => bindDraw()
		);

		onUnmounted(() => {
			stopFrame?.();
			display?.dispose();
			display = null;
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
