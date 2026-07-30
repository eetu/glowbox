import { expect, test } from '@playwright/test';

// The /neon route: the sign canvas paints (the default 'Cocktails' show lands lit
// on first paint — no boot animation) and the show selector swaps content. Loading
// /neon directly also exercises the prerendered per-route shell page.

const litPixels = (el: Element) => {
	const c = el as HTMLCanvasElement;
	const ctx = c.getContext('2d');
	if (!ctx || !c.width) return 0;
	const d = ctx.getImageData(0, 0, c.width, c.height).data;
	let n = 0;
	for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 120) n++;
	return n;
};

test('the sign paints lit tubes', async ({ page }) => {
	await page.goto('/neon');
	const sign = page.locator('.sign-wrap canvas');
	await expect(sign).toBeVisible();
	// Poll: the sign sizes via ResizeObserver, and the hero show power-cycles —
	// a sample can land in the dark second; polling rides through it.
	await expect.poll(() => sign.evaluate(litPixels), { timeout: 15_000 }).toBeGreaterThan(200);
});

test('switching shows re-glasses the sign', async ({ page }) => {
	await page.goto('/neon');
	const sign = page.locator('.sign-wrap canvas');
	await expect.poll(() => sign.evaluate(litPixels), { timeout: 15_000 }).toBeGreaterThan(200);
	await page.getByLabel('show').selectOption('marquee');
	// The marquee is gold block letters on a chase — it paints and keeps painting.
	await expect.poll(() => sign.evaluate(litPixels), { timeout: 15_000 }).toBeGreaterThan(200);
});
