import { expect, test } from '@playwright/test';

// The theme control, end to end in the built app: one button in the header drives the
// page chrome AND every display on it. Assertions read the canvas back, so they cover
// the whole chain — button, page state, core option, render.

/** Mean luminance over a canvas: a light-theme display reads brighter than a dark one. */
const meanLuma = (el: Element) => {
	const c = el as HTMLCanvasElement;
	const ctx = c.getContext('2d');
	if (!ctx || !c.width) return 0;
	const d = ctx.getImageData(0, 0, c.width, c.height).data;
	let n = 0;
	for (let i = 0; i < d.length; i += 4) n += d[i] + d[i + 1] + d[i + 2];
	return n / (d.length / 4);
};

test('the gallery opens dark whatever the OS says, and the button flips it', async ({ page }) => {
	// The runner's scheme is light here on purpose: the choice is the gallery's, not the
	// visitor's OS — these displays are at their best in the dark.
	await page.emulateMedia({ colorScheme: 'light' });
	await page.goto('/splitflap');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await page.getByRole('button', { name: /switch to the light theme/i }).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
	// And it sticks across a navigation (localStorage).
	await page.goto('/flipdot');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('the theme button repaints the hardware, not just the page', async ({ page }) => {
	for (const [route, selector] of [
		['/splitflap', '.board-wrap canvas'],
		['/flipdot', '.board-wrap canvas']
	] as const) {
		await page.goto(route);
		const canvas = page.locator(selector).first();
		await expect(canvas).toBeVisible();
		await expect.poll(() => canvas.evaluate(meanLuma), { timeout: 15_000 }).toBeGreaterThan(0);
		const dark = await canvas.evaluate(meanLuma);
		await page.getByRole('button', { name: /switch to the light theme/i }).click();
		await expect
			.poll(() => canvas.evaluate(meanLuma), { timeout: 10_000 })
			.toBeGreaterThan(dark * 1.5);
		// Back to dark for the next route (the choice is persisted).
		await page.getByRole('button', { name: /switch to the dark theme/i }).click();
	}
});

test('every route ships the one control, and no route has its own', async ({ page }) => {
	for (const route of [
		'/',
		'/nixie',
		'/seven',
		'/flipdot',
		'/splitflap',
		'/neon',
		'/vfd',
		'/lcd'
	]) {
		await page.goto(route);
		await expect(page.getByRole('button', { name: /switch to the .* theme/i })).toHaveCount(1);
		// The per-route Segmented is gone: one theme per page, decided in the header.
		await expect(page.getByRole('group', { name: 'colour theme' })).toHaveCount(0);
	}
});
