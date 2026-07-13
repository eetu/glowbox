// Golden renders: fixed camera, fixed content, four looks — the visual safety net for
// any future renderer work (pixel-count assertions can't catch "the bloom looks
// wrong"). This project is pinned to SwiftShader (see vite.config.ts) so one committed
// baseline is valid on every platform; the generous mismatch ratio absorbs residual
// raster drift. Regenerate after an intentional visual change:
//   yarn workspace @glowbox/led-grid test --project golden -u
import { page } from '@vitest/browser/context';
import { afterEach, expect, test } from 'vitest';

import { createLedDisplay, type LedDisplayOptions } from '../led-display';

const cleanups: (() => void)[] = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

// A deterministic scene: asymmetric content (shell + axis line + box) at a fixed
// camera, paused, pixelRatio 1, no MSAA — nothing time- or platform-dependent.
function scene(opts: Partial<LedDisplayOptions> = {}) {
	const canvas = document.createElement('canvas');
	canvas.width = 160;
	canvas.height = 120;
	canvas.style.width = '160px';
	canvas.style.height = '120px';
	canvas.style.display = 'block';
	document.body.appendChild(canvas);
	const d = createLedDisplay(canvas, {
		size: [9, 9, 9],
		camera: { yaw: 0.6, pitch: 0.4, autoOrbit: false },
		quality: { paused: true, pixelRatio: 1, antialias: false },
		color: { background: '#05050a' },
		...opts
	});
	if (!d) throw new Error('WebGL unavailable');
	cleanups.push(() => {
		d.dispose();
		canvas.remove();
	});
	d.clear();
	d.sphere([4, 4, 4], 3, [0, 0.7, 1]);
	d.line([0, 0, 0], [8, 0, 0], [1, 0.3, 0.1]);
	d.box([6, 6, 6], [8, 8, 8], [1, 0.8, 0]);
	d.render();
	return canvas;
}

test('hologram (HDR bloom) matches its golden', async () => {
	await expect(page.elementLocator(scene())).toMatchScreenshot('hologram');
});

test('comic (cel + outline) matches its golden', async () => {
	await expect(
		page.elementLocator(scene({ led: { style: 'comic', outline: 0.3 } }))
	).toMatchScreenshot('comic');
});

test('rgb sub-emitters (triad) match their golden', async () => {
	await expect(page.elementLocator(scene({ led: { rgb: true, size: 0.9 } }))).toMatchScreenshot(
		'rgb-triad'
	);
});

test('off-LED lattice matches its golden', async () => {
	await expect(
		page.elementLocator(scene({ led: { offColor: '#16161e', offSize: 0.4 } }))
	).toMatchScreenshot('lattice');
});
