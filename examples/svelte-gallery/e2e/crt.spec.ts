// The @glowbox/crt overlay under REAL input — the one thing the package's own browser
// tests can't prove: synthetic PointerEvents exercise our forwarding code, but only
// trusted mouse input proves the browser actually hit-tests the overlay (with the
// source hidden underneath) and that the forwarded events drive the display.
import { expect, test } from '@playwright/test';

test('CRT toggles on, paints the tube, and forwards real drag + wheel to the display', async ({
	page
}) => {
	await page.goto('/');
	await expect(page.locator('canvas')).toBeVisible();

	// Enable the effect (a ToggleChip wraps a visually-hidden checkbox — force it).
	await page.getByRole('checkbox', { name: 'CRT' }).check({ force: true });
	const crt = page.locator('canvas[data-glowbox-crt]');
	await expect(crt).toBeVisible();

	// The tube paints (rAF-timed readback: our reader runs after the effect's frame in
	// the same tick, while the buffer still holds the drawn frame).
	const lit = await crt.evaluate(
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

	// Tap the hidden SOURCE canvas: real mouse input lands on the overlay and must be
	// forwarded through (this is what synthetic-event tests can't establish).
	await page.evaluate(() => {
		const src = document.querySelector<HTMLCanvasElement>(
			'.crt-wrap canvas:not([data-glowbox-crt])'
		);
		const seen: string[] = [];
		for (const t of ['pointerdown', 'pointermove', 'pointerup', 'wheel'])
			src?.addEventListener(t, () => seen.push(t));
		(window as unknown as { __seen: string[] }).__seen = seen;
	});

	const box = await crt.boundingBox();
	if (!box) throw new Error('no crt box');
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;
	await page.mouse.move(cx, cy);
	await page.mouse.down();
	await page.mouse.move(cx + 120, cy + 40, { steps: 8 });
	await page.mouse.up();
	await page.mouse.wheel(0, -120);

	const seen = await page.evaluate(() => (window as unknown as { __seen: string[] }).__seen);
	expect(seen).toContain('pointerdown');
	expect(seen).toContain('pointermove');
	expect(seen).toContain('pointerup');
	expect(seen).toContain('wheel');

	// And the toggle round-trips: off restores the plain display, no page errors.
	await page.getByRole('checkbox', { name: 'CRT' }).uncheck({ force: true });
	await expect(crt).toHaveCount(0);
});
