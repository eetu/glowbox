import { expect, test } from '@playwright/test';

test('boots, mounts the LED-grid canvas, and paints non-black pixels', async ({ page }) => {
	await page.goto('/');
	const canvas = page.locator('canvas');
	await expect(canvas).toBeVisible();

	// Read the framebuffer inside a rAF tick (after the display's own render for
	// the frame) so the buffer still holds the drawn LEDs before compositing.
	const lit = await canvas.evaluate(
		(el) =>
			new Promise<number>((resolve) => {
				const c = el as HTMLCanvasElement;
				requestAnimationFrame(() => {
					const gl = c.getContext('webgl');
					if (!gl) return resolve(-1);
					const px = new Uint8Array(c.width * c.height * 4);
					gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
					let n = 0;
					for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 30) n++;
					resolve(n);
				});
			})
	);
	expect(lit).toBeGreaterThan(0);
});

test('switches between example programs', async ({ page }) => {
	await page.goto('/');
	await page.getByLabel('example').selectOption('Spinning torus');
	await expect(page.locator('canvas')).toBeVisible();
});

test('customization controls drive the live display', async ({ page }) => {
	await page.goto('/');
	const canvas = page.locator('canvas');
	await expect(canvas).toBeVisible();

	// Exercise the grouped-prop controls (auto-orbit, projection) — these update
	// the display live via setOptions, no remount. auto-orbit is a chip wrapping a
	// visually-hidden checkbox, so toggle it with force (the label icon overlays it).
	await page.getByRole('checkbox', { name: 'auto-orbit' }).uncheck({ force: true });
	await page.getByLabel('projection').selectOption('orthographic');

	// Still paints after the option changes (same rAF-timed readback as above).
	const lit = await canvas.evaluate(
		(el) =>
			new Promise<number>((resolve) => {
				const c = el as HTMLCanvasElement;
				requestAnimationFrame(() => {
					const gl = c.getContext('webgl');
					if (!gl) return resolve(-1);
					const px = new Uint8Array(c.width * c.height * 4);
					gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
					let n = 0;
					for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 30) n++;
					resolve(n);
				});
			})
	);
	expect(lit).toBeGreaterThan(0);
});
