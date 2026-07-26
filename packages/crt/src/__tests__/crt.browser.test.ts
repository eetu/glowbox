import { expect, test } from 'vitest';

import { createCrtScreen } from '../crt';

// A bright source canvas the CRT pass can be verified against.
const makeSource = (fill = '#ff8800') => {
	const c = document.createElement('canvas');
	c.width = 120;
	c.height = 90;
	const ctx = c.getContext('2d')!;
	ctx.fillStyle = fill;
	ctx.fillRect(0, 0, c.width, c.height);
	document.body.appendChild(c);
	return c;
};

const mountOutput = (crt: { canvas: HTMLCanvasElement }) => {
	crt.canvas.style.width = '120px';
	crt.canvas.style.height = '90px';
	document.body.appendChild(crt.canvas);
};

const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

const readPixels = (canvas: HTMLCanvasElement) => {
	const gl = canvas.getContext('webgl')!;
	const px = new Uint8Array(canvas.width * canvas.height * 4);
	gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
	return px;
};

test('renders the source through the tube: lit centre, dark curved corners', async () => {
	const src = makeSource();
	const crt = createCrtScreen(src, { noise: 0, flicker: 0 });
	expect(crt).not.toBeNull();
	if (!crt) return;
	mountOutput(crt);
	crt.resize();
	await frame();
	const px = readPixels(crt.canvas);
	const w = crt.canvas.width;
	const h = crt.canvas.height;
	const at = (x: number, y: number) => {
		const i = (y * w + x) * 4;
		return px[i] + px[i + 1] + px[i + 2];
	};
	expect(at(w >> 1, h >> 1)).toBeGreaterThan(120); // centre shows the source
	expect(at(1, 1)).toBeLessThan(30); // corner is outside the curved face
	crt.dispose();
});

test('forwards pointer and wheel events to the source canvas', () => {
	const src = makeSource();
	const crt = createCrtScreen(src);
	if (!crt) return;
	mountOutput(crt);
	const seen: string[] = [];
	for (const t of ['pointerdown', 'pointermove', 'pointerup', 'wheel'])
		src.addEventListener(t, () => seen.push(t));
	crt.canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, clientY: 10 }));
	crt.canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: 20, clientY: 12 }));
	crt.canvas.dispatchEvent(new PointerEvent('pointerup', { clientX: 20, clientY: 12 }));
	crt.canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -3, cancelable: true }));
	expect(seen).toEqual(['pointerdown', 'pointermove', 'pointerup', 'wheel']);

	crt.setOptions({ events: false });
	crt.canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 5, clientY: 5 }));
	expect(seen).toHaveLength(4); // opt-out respected
	crt.dispose();
});

test('persistence ghosts: a cleared source keeps glowing for a few frames', async () => {
	const src = makeSource('#ffffff');
	const crt = createCrtScreen(src, { persistence: 0.9, noise: 0, flicker: 0, band: 0 });
	if (!crt) return;
	mountOutput(crt);
	crt.resize();
	await frame();
	// Black out the source; the phosphor history should still carry light.
	const ctx = src.getContext('2d')!;
	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, src.width, src.height);
	await frame();
	const px = readPixels(crt.canvas);
	const w = crt.canvas.width;
	const h = crt.canvas.height;
	const i = ((h >> 1) * w + (w >> 1)) * 4;
	expect(px[i] + px[i + 1] + px[i + 2]).toBeGreaterThan(60); // ghost, not black
	crt.dispose();
});

test('dispose stops the loop and removes the output canvas', () => {
	const src = makeSource();
	const crt = createCrtScreen(src);
	if (!crt) return;
	mountOutput(crt);
	expect(document.body.contains(crt.canvas)).toBe(true);
	crt.dispose();
	expect(document.body.contains(crt.canvas)).toBe(false);
});

test('element mode: slaps over a container, composites child canvases, restores on dispose', async () => {
	const box = document.createElement('div');
	box.style.cssText = 'width:200px;height:100px';
	const left = makeSource('#ff0000');
	const right = makeSource('#00ff00');
	for (const [c, x] of [
		[left, '0px'],
		[right, '100px']
	] as const) {
		c.style.cssText = `position:absolute;left:${x};top:0;width:100px;height:100px`;
		box.appendChild(c);
	}
	document.body.appendChild(box);

	const crt = createCrtScreen(box, { noise: 0, flicker: 0, curvature: 0 });
	expect(crt).not.toBeNull();
	if (!crt) return;
	// Auto-mounted into the container, container promoted to a positioned box,
	// sources hidden but laid out.
	expect(crt.canvas.parentElement).toBe(box);
	expect(getComputedStyle(box).position).toBe('relative');
	expect(left.style.visibility).toBe('hidden');
	crt.resize();
	await frame();
	const px = readPixels(crt.canvas);
	const w = crt.canvas.width;
	const h = crt.canvas.height;
	const at = (fx: number) => {
		const i = ((h >> 1) * w + Math.floor(w * fx)) * 4;
		return [px[i], px[i + 1], px[i + 2]];
	};
	expect(at(0.25)[0]).toBeGreaterThan(80); // left half shows the red canvas
	expect(at(0.75)[1]).toBeGreaterThan(80); // right half the green one

	// Hit-tested forwarding: an event over the right half reaches the right canvas.
	const seen: string[] = [];
	left.addEventListener('pointerdown', () => seen.push('left'));
	right.addEventListener('pointerdown', () => seen.push('right'));
	const r = crt.canvas.getBoundingClientRect();
	crt.canvas.dispatchEvent(
		new PointerEvent('pointerdown', { clientX: r.left + 150, clientY: r.top + 50 })
	);
	expect(seen).toEqual(['right']);

	crt.dispose();
	expect(box.contains(crt.canvas)).toBe(false);
	expect(left.style.visibility).not.toBe('hidden'); // handed back as found
});

test('orientation survives the no-flip upload path (top stays top), both pipelines', async () => {
	// Top half red, bottom half green — a flip would swap them.
	const src = document.createElement('canvas');
	src.width = 100;
	src.height = 100;
	src.style.cssText = 'width:100px;height:100px';
	const ctx = src.getContext('2d')!;
	ctx.fillStyle = '#f00';
	ctx.fillRect(0, 0, 100, 50);
	ctx.fillStyle = '#0f0';
	ctx.fillRect(0, 50, 100, 50);
	document.body.appendChild(src);

	for (const persistence of [0, 0.5]) {
		const crt = createCrtScreen(src, { persistence, noise: 0, flicker: 0, curvature: 0 });
		if (!crt) return;
		mountOutput(crt);
		crt.resize();
		await frame();
		const px = readPixels(crt.canvas);
		const w = crt.canvas.width;
		const h = crt.canvas.height;
		// readPixels rows are bottom-up: row h-4 is near the TOP of the screen.
		const top = ((h - 4) * w + (w >> 1)) * 4;
		const bottom = (4 * w + (w >> 1)) * 4;
		expect(px[top]).toBeGreaterThan(px[top + 1]); // top is red (persistence " + persistence + ")
		expect(px[bottom + 1]).toBeGreaterThan(px[bottom]); // bottom is green
		crt.dispose();
	}
});
