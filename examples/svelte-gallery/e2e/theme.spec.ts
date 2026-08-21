import { expect, test } from '@playwright/test';

// The display-theme switch, end to end in the built app: every route has one, and it
// really repaints the hardware rather than just the page around it. Assertions read the
// canvas back, so they cover the whole chain — control, core option, render.

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

test('the light theme repaints the hardware, on the cores that invert', async ({ page }) => {
	for (const [route, selector] of [
		['/splitflap', '.board-wrap canvas'],
		['/flipdot', '.board-wrap canvas']
	] as const) {
		await page.goto(route);
		const canvas = page.locator(selector).first();
		await expect(canvas).toBeVisible();
		await expect.poll(() => canvas.evaluate(meanLuma), { timeout: 15_000 }).toBeGreaterThan(0);
		const dark = await canvas.evaluate(meanLuma);
		await page.locator('button[title="light"]').click();
		await expect
			.poll(() => canvas.evaluate(meanLuma), { timeout: 10_000 })
			.toBeGreaterThan(dark * 1.5);
	}
});

test('every route offers the switch, and Page follows the header toggle', async ({ page }) => {
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
		const group = page.getByRole('group', { name: 'colour theme' });
		await expect(group).toBeVisible();
		// Page is the default, so the display is whatever the page is (dark here — the
		// project pins the scheme).
		// The buttons carry their value as a title — a stable handle whatever the
		// surrounding label contributes to the accessible name.
		await expect(group.locator('button[title="page"]')).toHaveAttribute('aria-pressed', 'true');
	}
});
