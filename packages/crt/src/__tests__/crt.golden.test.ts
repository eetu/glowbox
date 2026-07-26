// Golden render: a deterministic source pattern through the tube at fixed knobs — the
// visual safety net for shader work (the V-flip/uniform re-plumbing class of change).
// Temporal artifacts (noise/flicker/band) and persistence are off, so every frame is
// identical; the static look (curvature, scanlines, mask, convergence, vignette) is
// what the baseline locks. SwiftShader-pinned (see vite.config.ts). Regenerate after
// an intentional visual change:
//   yarn workspace @glowbox/crt test --project golden -u
import { page } from '@vitest/browser/context';
import { afterEach, expect, test } from 'vitest';

import { createCrtScreen } from '../crt';

const cleanups: (() => void)[] = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

// An asymmetric test card: colour blocks, a white grid, a diagonal — orientation,
// convergence fringes, and scanline phase are all visible against it.
function testCard(): HTMLCanvasElement {
	const c = document.createElement('canvas');
	c.width = 240;
	c.height = 180;
	c.style.cssText = 'width:240px;height:180px;display:block';
	const g = c.getContext('2d')!;
	g.fillStyle = '#000';
	g.fillRect(0, 0, 240, 180);
	const bars = ['#f00', '#0f0', '#00f', '#ff0', '#0ff', '#fff'];
	bars.forEach((col, i) => {
		g.fillStyle = col;
		g.fillRect(i * 40, 0, 40, 90);
	});
	g.strokeStyle = '#888';
	for (let x = 0; x <= 240; x += 24) {
		g.beginPath();
		g.moveTo(x, 90);
		g.lineTo(x, 180);
		g.stroke();
	}
	g.strokeStyle = '#fff';
	g.lineWidth = 3;
	g.beginPath();
	g.moveTo(0, 180);
	g.lineTo(240, 90);
	g.stroke();
	document.body.appendChild(c);
	return c;
}

const settle = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

test('the tube look matches its golden (static knobs, temporal off)', async () => {
	const src = testCard();
	const crt = createCrtScreen(src, {
		noise: 0,
		flicker: 0,
		band: 0,
		persistence: 0,
		pixelRatio: 1
	});
	if (!crt) throw new Error('WebGL unavailable');
	crt.canvas.style.cssText += ';width:240px;height:180px';
	document.body.appendChild(crt.canvas);
	cleanups.push(() => {
		crt.dispose();
		src.remove();
	});
	crt.resize();
	await settle();
	await expect(page.elementLocator(crt.canvas)).toMatchScreenshot('tube');
});
