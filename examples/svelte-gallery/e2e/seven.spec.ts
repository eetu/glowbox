// The seven-segment route: the clock paints, and the countdown rig runs its
// three endings — the timer, the wire that saves you, the wire that doesn't.
import { expect, test } from '@playwright/test';

// Lit pixels in the digit canvases: the sum a dark display can't fake.
const litSum = (c: HTMLCanvasElement) => {
	const g = c.getContext('2d');
	if (!g) return 0;
	const d = g.getImageData(0, 0, c.width, c.height).data;
	let sum = 0;
	for (let i = 0; i < d.length; i += 64) sum += d[i] + d[i + 1] + d[i + 2];
	return sum;
};

const armCountdown = async (page: import('@playwright/test').Page) => {
	await page.goto('/seven');
	await page.getByLabel('show').selectOption('bomb');
	await expect(page.getByRole('button', { name: /cut the red wire/i })).toBeVisible();
};

test('the clock paints its digits', async ({ page }) => {
	await page.goto('/seven');
	const digit = page.locator('.clock canvas').first();
	await expect(digit).toBeVisible();
	await expect.poll(() => digit.evaluate(litSum), { timeout: 15_000 }).toBeGreaterThan(0);
});

test('the countdown runs, and the right wire stops it', async ({ page }) => {
	await armCountdown(page);
	const readout = page.locator('.readout');
	await expect(readout).toContainText('armed');
	// The clock is actually counting: a later read is a smaller number.
	const secs = async () => Number((await readout.innerText()).split(':').pop());
	const first = await secs();
	await expect.poll(secs, { timeout: 8000 }).toBeLessThan(first);

	// Blue is one of the two that save you: the timer stops, the glass stays lit.
	await page.getByRole('button', { name: /cut the blue wire/i }).press('Enter');
	await expect(readout).toHaveText('defused');
	const digit = page.locator('.clock canvas').first();
	await expect.poll(() => digit.evaluate(litSum), { timeout: 5000 }).toBeGreaterThan(0);
	// A cut wire stays cut.
	await expect(page.getByRole('button', { name: /blue wire, cut/i })).toBeVisible();
});

test('the red wire ends the show, and re-arming brings it back', async ({ page }) => {
	await armCountdown(page);
	const digit = page.locator('.clock canvas').first();
	await expect.poll(() => digit.evaluate(litSum), { timeout: 15_000 }).toBeGreaterThan(0);

	await page.getByRole('button', { name: /cut the red wire/i }).press('Enter');
	await expect(page.locator('.readout')).toHaveText('detonated');
	// Dead display: the segment ghosts are all that is left.
	const lit = await digit.evaluate(litSum);
	await page.getByRole('button', { name: /^re-arm$/i }).click();
	await expect(page.locator('.readout')).toContainText('armed');
	await expect.poll(() => digit.evaluate(litSum), { timeout: 5000 }).toBeGreaterThan(lit);
	// Fresh tape: every wire is whole again.
	await expect(page.getByRole('button', { name: /cut the red wire/i })).toBeVisible();
});
