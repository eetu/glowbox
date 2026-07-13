import { expect, test } from '@playwright/test';

// The /nixie route: the 2D clock (a row of @glowbox/nixie canvases) and the 3D scene
// (three.js tubes extruded from the same glyph paths). Loading /nixie directly also
// exercises the prerendered per-route shell page (GitHub Pages has no rewrites).

test('2D clock boots with eight tubes that paint', async ({ page }) => {
	await page.goto('/nixie');
	const tubes = page.locator('.clock canvas');
	await expect(tubes).toHaveCount(8);
	// Poll: the tubes size via ResizeObserver, so the first paint can land a tick late.
	await expect
		.poll(() =>
			tubes.first().evaluate((el) => {
				const c = el as HTMLCanvasElement;
				const ctx = c.getContext('2d');
				if (!ctx || !c.width) return 0;
				const d = ctx.getImageData(0, 0, c.width, c.height).data;
				let n = 0;
				for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 40) n++;
				return n;
			})
		)
		.toBeGreaterThan(50);
});

test('3D mode renders the three.js tube scene', async ({ page }) => {
	test.setTimeout(60_000); // software-GL bloom compile can be slow on CI
	await page.goto('/nixie');
	await page.getByRole('button', { name: '3D' }).click();
	const scene = page.locator('.scene3d canvas');
	await expect(scene).toBeVisible();
	// Read inside rAF ticks so the buffer still holds the frame (no preserveDrawingBuffer);
	// the scene caps itself to 40 fps, so poll until a read coincides with a rendered frame.
	await expect
		.poll(
			() =>
				scene.evaluate(
					(el) =>
						new Promise<number>((resolve) => {
							const c = el as HTMLCanvasElement;
							requestAnimationFrame(() => {
								requestAnimationFrame(() => {
									const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as
										WebGLRenderingContext | WebGL2RenderingContext | null;
									if (!gl) return resolve(-1);
									const px = new Uint8Array(c.width * c.height * 4);
									gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
									let n = 0;
									for (let i = 0; i < px.length; i += 4)
										if (px[i] + px[i + 1] + px[i + 2] > 30) n++;
									resolve(n);
								});
							});
						})
				),
			{ timeout: 45_000 }
		)
		.toBeGreaterThan(0);
});
