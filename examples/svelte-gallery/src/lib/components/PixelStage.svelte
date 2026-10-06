<script lang="ts" module>
	/** Fills a rect of the 1× buffer; `lit` pixels also feed the glow. */
	export type PixelFill = (
		colour: string,
		x: number,
		y: number,
		w?: number,
		h?: number,
		lit?: boolean
	) => void;
	/** Paints one frame: called every animation frame with seconds since the stage mounted. */
	export type PixelPaint = (fill: PixelFill, t: number) => void;

	const channels = (hex: string) => {
		const n = parseInt(hex.slice(1), 16);
		return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
	};
	/** `#rrggbb` between `a` and `b`, `t` of the way. */
	export const mixHex = (a: string, b: string, t: number): string => {
		const [x, y] = [channels(a), channels(b)];
		const k = Math.max(0, Math.min(1, t));
		return `#${x
			.map((v, i) =>
				Math.round(v + (y[i] - v) * k)
					.toString(16)
					.padStart(2, '0')
			)
			.join('')}`;
	};
</script>

<script lang="ts">
	// A pixel display the way a game would draw it: the core's pixel export painted into a
	// buffer at one pixel per pixel, then scaled up by a whole number to fit the stage, so
	// every pixel stays square and sharp. The glow is the lit pixels again, blurred, on top:
	// what a game's own lighting would add round a self-lit sign.
	let {
		width,
		height,
		paint,
		glow = 0,
		background = '#000000',
		maxScale = 24,
		label
	}: {
		/** The buffer's size, in the display's own pixels. */
		width: number;
		height: number;
		paint: PixelPaint;
		/** 0 none … 1 strong. */
		glow?: number;
		background?: string;
		maxScale?: number;
		label?: string;
	} = $props();

	let box = $state<HTMLDivElement>();
	let canvas = $state<HTMLCanvasElement>();
	let scale = $state(1);

	$effect(() => {
		if (!box) return;
		const fit = () => {
			const s = Math.floor(Math.min(box!.clientWidth / width, box!.clientHeight / height));
			scale = Math.max(1, Math.min(maxScale, s));
		};
		fit();
		const ro = new ResizeObserver(fit);
		ro.observe(box);
		return () => ro.disconnect();
	});

	$effect(() => {
		if (!canvas) return;
		const buffer = document.createElement('canvas');
		const lit = document.createElement('canvas');
		const b = buffer.getContext('2d')!;
		const l = lit.getContext('2d')!;
		const out = canvas.getContext('2d')!;
		const t0 = performance.now();
		let raf = 0;
		const frame = (now: number) => {
			const w = Math.max(1, Math.round(width));
			const h = Math.max(1, Math.round(height));
			if (buffer.width !== w || buffer.height !== h) {
				buffer.width = lit.width = w;
				buffer.height = lit.height = h;
			}
			b.fillStyle = background;
			b.fillRect(0, 0, w, h);
			l.clearRect(0, 0, w, h);
			paint(
				(colour, x, y, rw = 1, rh = 1, on = false) => {
					b.fillStyle = colour;
					b.fillRect(x, y, rw, rh);
					if (on) {
						l.fillStyle = colour;
						l.fillRect(x, y, rw, rh);
					}
				},
				(now - t0) / 1000
			);
			const W = w * scale;
			const H = h * scale;
			if (canvas!.width !== W || canvas!.height !== H) {
				canvas!.width = W;
				canvas!.height = H;
			}
			out.imageSmoothingEnabled = false;
			out.globalCompositeOperation = 'source-over';
			out.globalAlpha = 1;
			out.filter = 'none';
			out.drawImage(buffer, 0, 0, W, H);
			if (glow > 0) {
				out.imageSmoothingEnabled = true;
				out.globalCompositeOperation = 'lighter';
				out.globalAlpha = Math.min(1, glow);
				out.filter = `blur(${Math.max(2, scale * 1.4)}px)`;
				out.drawImage(lit, 0, 0, W, H);
			}
			raf = requestAnimationFrame(frame);
		};
		raf = requestAnimationFrame(frame);
		return () => cancelAnimationFrame(raf);
	});
</script>

<div class="pixel-stage" bind:this={box} role="img" aria-label={label}>
	<canvas bind:this={canvas} aria-hidden="true"></canvas>
</div>

<style>
	.pixel-stage {
		width: 100%;
		height: 100%;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	canvas {
		image-rendering: pixelated;
	}
</style>
