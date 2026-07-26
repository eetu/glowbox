import { expect, test } from 'vitest';

import { createCrtScreen } from '../crt';

const frames = (n: number) =>
	new Promise((r) => {
		const step = () => (n-- > 0 ? requestAnimationFrame(step) : r(null));
		requestAnimationFrame(step);
	});

const litPixels = (canvas: HTMLCanvasElement): number => {
	const gl = canvas.getContext('webgl')!;
	const px = new Uint8Array(canvas.width * canvas.height * 4);
	gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
	let lit = 0;
	for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 60) lit++;
	return lit;
};

test('creation-order: canvas source sized after the screen is created', async () => {
	const src = document.createElement('canvas'); // 0x0, no CSS size yet
	document.body.appendChild(src);
	const crt = createCrtScreen(src, { noise: 0, flicker: 0 });
	if (!crt) return;
	crt.canvas.style.width = '120px';
	crt.canvas.style.height = '90px';
	document.body.appendChild(crt.canvas);
	crt.resize();
	await frames(3);
	// Now the "panel opens": source gets sized and painted.
	src.width = 120;
	src.height = 90;
	src.style.width = '120px';
	src.style.height = '90px';
	const ctx = src.getContext('2d')!;
	ctx.fillStyle = '#fff';
	ctx.fillRect(0, 0, 120, 90);
	await frames(4);
	expect(litPixels(crt.canvas)).toBeGreaterThan(0);
	crt.dispose();
});

test('creation-order: element source empty (size 0) at creation, canvas added later', async () => {
	const box = document.createElement('div');
	box.style.cssText = 'width:200px'; // height 0 — nothing inside yet
	document.body.appendChild(box);
	const crt = createCrtScreen(box, { noise: 0, flicker: 0, curvature: 0 });
	if (!crt) return;
	await frames(3);
	// The "panel" arrives: a painted canvas that gives the container height.
	const src = document.createElement('canvas');
	src.width = 200;
	src.height = 100;
	src.style.cssText = 'display:block;width:200px;height:100px';
	const ctx = src.getContext('2d')!;
	ctx.fillStyle = '#fff';
	ctx.fillRect(0, 0, 200, 100);
	box.appendChild(src);
	await frames(6);
	expect(crt.canvas.width).toBeGreaterThan(10); // output resized to the grown box
	expect(litPixels(crt.canvas)).toBeGreaterThan(0); // and shows the content
	crt.dispose();
});

test('creation-order: element source display:none at creation (closed panel), shown later', async () => {
	const box = document.createElement('div');
	box.style.cssText = 'display:none;width:200px;height:100px';
	const src = document.createElement('canvas');
	src.width = 200;
	src.height = 100;
	src.style.cssText = 'display:block;width:200px;height:100px';
	const ctx = src.getContext('2d')!;
	ctx.fillStyle = '#fff';
	ctx.fillRect(0, 0, 200, 100);
	box.appendChild(src);
	document.body.appendChild(box);

	const crt = createCrtScreen(box, { noise: 0, flicker: 0, curvature: 0 });
	if (!crt) return;
	await frames(3);
	box.style.display = 'block'; // the panel opens
	await frames(6);
	expect(crt.canvas.width).toBeGreaterThan(10);
	expect(litPixels(crt.canvas)).toBeGreaterThan(0);
	crt.dispose();
});
