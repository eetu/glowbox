import { expect, test } from '@playwright/test';

// The /lcd route: the module inks its glass (dark dots on a light pane — the
// reflective one), the attract loop keeps writing, and switching to the negative
// STN blue glass flips the ink to light-through. Sampling stays inside the central
// glass box so the dark plastic bezel never counts as ink. Loading /lcd directly
// also exercises the prerendered shell page.

const sample = (el: Element) => {
	const c = el as HTMLCanvasElement;
	const ctx = c.getContext('2d');
	if (!ctx || !c.width) return { dark: 0, light: 0 };
	// The central 50% box — glass, never bezel.
	const x = c.width >> 2;
	const y = c.height >> 2;
	const d = ctx.getImageData(x, y, c.width >> 1, c.height >> 1).data;
	let dark = 0;
	let light = 0;
	for (let i = 0; i < d.length; i += 4) {
		const sum = d[i] + d[i + 1] + d[i + 2];
		if (sum < 220) dark++;
		else if (sum > 550) light++;
	}
	return { dark, light };
};

test('the module inks the glass and the attract loop keeps writing', async ({ page }) => {
	await page.goto('/lcd');
	const glass = page.locator('.stage canvas');
	await expect(glass).toBeVisible();
	// Poll: the crystals are slow on purpose, and the loop power-cycles — a sample
	// can land mid-drain; polling rides through it.
	await expect
		.poll(async () => (await glass.evaluate(sample)).dark, { timeout: 15_000 })
		.toBeGreaterThan(150);
});

test('tapping the glass keeps the module alive (the cursor tap wiring)', async ({ page }) => {
	await page.goto('/lcd');
	const glass = page.locator('.stage canvas');
	await expect
		.poll(async () => (await glass.evaluate(sample)).dark, { timeout: 15_000 })
		.toBeGreaterThan(150);
	// A tap parks the block cursor via cellAt — the page listens, the module
	// answers geometry. It must not blank anything.
	await glass.click({ position: { x: 60, y: 60 } });
	await expect
		.poll(async () => (await glass.evaluate(sample)).dark, { timeout: 15_000 })
		.toBeGreaterThan(150);
});

test('type mode: keystrokes land on the glass', async ({ page }) => {
	await page.goto('/lcd');
	const glass = page.locator('.stage canvas');
	await expect(glass).toBeVisible();
	await page.getByRole('group', { name: 'mode' }).getByText('Type').click();
	// The bench: one input per module row; the bound value drives setText.
	await page.getByLabel('module row 1').fill('WOMBAT 123');
	// The module reads as what it shows — the typed line lands in the aria-label...
	await expect(glass).toHaveAttribute('aria-label', /WOMBAT 123/);
	// ...and the crystals chase it onto the glass.
	await expect
		.poll(async () => (await glass.evaluate(sample)).dark, { timeout: 15_000 })
		.toBeGreaterThan(100);
});

test('the 20×4 module regrids and keeps writing', async ({ page }) => {
	await page.goto('/lcd');
	const glass = page.locator('.stage canvas');
	await expect
		.poll(async () => (await glass.evaluate(sample)).dark, { timeout: 15_000 })
		.toBeGreaterThan(150);
	// cols/rows are a setOptions patch: same glass, more cells; the attract loop
	// reads the width live and keeps writing.
	await page.getByRole('group', { name: 'module size' }).getByText('20×4').click();
	await expect
		.poll(async () => (await glass.evaluate(sample)).dark, { timeout: 15_000 })
		.toBeGreaterThan(150);
});

test('the STN blue glass flips the image to light-through ink', async ({ page }) => {
	await page.goto('/lcd');
	const glass = page.locator('.stage canvas');
	await expect
		.poll(async () => (await glass.evaluate(sample)).dark, { timeout: 15_000 })
		.toBeGreaterThan(150);
	await page.getByRole('group', { name: 'panel glass' }).getByText('STN blue').click();
	// Negative transmissive glass: the ink is now LIGHT on a deep blue pane.
	await expect
		.poll(async () => (await glass.evaluate(sample)).light, { timeout: 15_000 })
		.toBeGreaterThan(50);
});
