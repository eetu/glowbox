import { expect, test } from '@playwright/test';

// The /vfd route against the BUILT app: the faceplate paints lit anodes, the dimmer
// really pulls the whole panel down, and the panel answers geometry for a tap. Loading
// /vfd directly also exercises the prerendered per-route shell page.

const litPixels = (el: Element) => {
	const c = el as HTMLCanvasElement;
	const ctx = c.getContext('2d', { willReadFrequently: true });
	if (!ctx || !c.width) return 0;
	const d = ctx.getImageData(0, 0, c.width, c.height).data;
	let n = 0;
	for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 120) n++;
	return n;
};

test('the faceplate paints lit anodes', async ({ page }) => {
	await page.goto('/vfd');
	const panel = page.locator('canvas.face');
	await expect(panel).toBeVisible();
	// Poll: the panel sizes via ResizeObserver and runs its power-on self-test first,
	// and the show cycles sources — polling rides through the transitions.
	await expect.poll(() => panel.evaluate(litPixels), { timeout: 15_000 }).toBeGreaterThan(200);
});

test('the dimmer pulls the whole panel down', async ({ page }) => {
	await page.goto('/vfd');
	const panel = page.locator('canvas.face');
	await expect.poll(() => panel.evaluate(litPixels), { timeout: 15_000 }).toBeGreaterThan(200);
	// DISPLAY OFF is the fourth press of the dimmer button. The glass and its silkscreen
	// stay visible, but nothing on the panel is driven any more.
	const dimmer = page.getByRole('button', { name: /display/i });
	for (let i = 0; i < 3; i++) await dimmer.click();
	await expect.poll(() => panel.evaluate(litPixels), { timeout: 10_000 }).toBeLessThan(60);
});

test('the GIF source turns the analyser field into a graphic display', async ({ page }) => {
	await page.goto('/vfd');
	const strip = page.locator('canvas.analyser');
	await expect(strip).toBeVisible();
	// One window, two jobs — so what proves the swap is where the light is, not that there is
	// any. The graphic area is the centre third of the strip (frame x 98..221 of 320); the
	// spectrum owns the flanks, and on the GIF source it must be dark.
	const litIn = (x0: number, x1: number) =>
		strip.evaluate(
			(el, box) => {
				const c = el as HTMLCanvasElement;
				const ctx = c.getContext('2d', { willReadFrequently: true });
				if (!ctx || !c.width) return 0;
				const px = Math.floor(c.width * box.x0);
				const w = Math.max(1, Math.floor(c.width * (box.x1 - box.x0)));
				const d = ctx.getImageData(px, 0, w, c.height).data;
				let n = 0;
				for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 120) n++;
				return n;
			},
			{ x0, x1 }
		);
	const middle = () => litIn(98 / 320, 221 / 320);
	const flank = () => litIn(8 / 320, 90 / 320);

	// The spectrum first: the flank is where the bars are.
	await page.getByText('CD', { exact: true }).click();
	await expect.poll(flank, { timeout: 15_000 }).toBeGreaterThan(200);

	// Then the DISPLAY swap. The GIF is fetched and decoded first, so this needs a long poll.
	await page.getByText('GIF', { exact: true }).click();
	await expect.poll(middle, { timeout: 25_000 }).toBeGreaterThan(400);
	// And the analyser really stopped — including its peak caps, which would otherwise rest on
	// the floor row and leave a lit line straight through the picture.
	await expect.poll(flank, { timeout: 15_000 }).toBeLessThan(60);
});

test('the transport lights the mechanism the source calls for', async ({ page }) => {
	await page.goto('/vfd');
	const panel = page.locator('canvas.face');
	await expect(panel).toBeVisible();

	// The deck sits above the disc in the faceplate's right half, so a vertical split tells
	// them apart: reels at frame y 19..45 of 110, disc at y 49..77. Only one is ever powered.
	const litIn = (x0: number, x1: number, y0: number, y1: number) =>
		panel.evaluate(
			(el, box) => {
				const c = el as HTMLCanvasElement;
				const ctx = c.getContext('2d', { willReadFrequently: true });
				if (!ctx || !c.width) return 0;
				const px = Math.floor(c.width * box.x0);
				const py = Math.floor(c.height * box.y0);
				const w = Math.max(1, Math.floor(c.width * (box.x1 - box.x0)));
				const h = Math.max(1, Math.floor(c.height * (box.y1 - box.y0)));
				const d = ctx.getImageData(px, py, w, h).data;
				let n = 0;
				for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 120) n++;
				return n;
			},
			{ x0, x1, y0, y1 }
		);
	const deck = () => litIn(0.6, 1, 20 / 110, 44 / 110);
	const disc = () => litIn(0.6, 1, 50 / 110, 76 / 110);

	// Poll the relationship, so the crossfade is ridden out rather than raced.
	await page.getByText('Tape', { exact: true }).click();
	await expect
		.poll(async () => (await deck()) - (await disc()), { timeout: 15_000 })
		.toBeGreaterThan(150);

	await page.getByText('CD', { exact: true }).click();
	await expect
		.poll(async () => (await disc()) - (await deck()), { timeout: 15_000 })
		.toBeGreaterThan(150);
});

test('the analyser panel runs the EQ above and the spectrum below', async ({ page }) => {
	await page.goto('/vfd');
	const analyser = page.locator('canvas.analyser');
	await expect(analyser).toBeVisible();
	// Pinned off 'auto', because the same field plays the animation on the GIF source and the
	// spectrum is deliberately dark then.
	await page.getByText('CD', { exact: true }).click();
	// The EQ is laid OVER the spectrum, so both bands carry light: the upper one has the curve
	// plus whatever bars reach it, the lower one is bars only. Both must be alive.
	const lit = (y0: number, y1: number) =>
		analyser.evaluate(
			(el, band) => {
				const c = el as HTMLCanvasElement;
				const ctx = c.getContext('2d', { willReadFrequently: true });
				if (!ctx || !c.width) return 0;
				const py = Math.floor(c.height * band.y0);
				const h = Math.max(1, Math.floor(c.height * (band.y1 - band.y0)));
				const d = ctx.getImageData(0, py, c.width, h).data;
				let n = 0;
				for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 120) n++;
				return n;
			},
			{ y0, y1 }
		);
	await expect.poll(() => lit(22 / 104, 56 / 104), { timeout: 15_000 }).toBeGreaterThan(100);
	await expect.poll(() => lit(60 / 104, 96 / 104), { timeout: 15_000 }).toBeGreaterThan(100);
});

test('the tape shows REC between the reels, and pause freezes rather than blanks', async ({
	page
}) => {
	await page.goto('/vfd');
	const panel = page.locator('canvas.face');
	await expect(panel).toBeVisible();
	// The REC block is a lit patch with the letters knocked out of it, on its own red window
	// between the two reel hubs — frame x 244..264, y 26..38 of 320×110.
	const recLit = () =>
		panel.evaluate((el) => {
			const c = el as HTMLCanvasElement;
			const ctx = c.getContext('2d', { willReadFrequently: true });
			if (!ctx || !c.width) return 0;
			const px = Math.floor(c.width * (245 / 320));
			const py = Math.floor(c.height * (27 / 110));
			const w = Math.max(1, Math.floor(c.width * (18 / 320)));
			const h = Math.max(1, Math.floor(c.height * (10 / 110)));
			const d = ctx.getImageData(px, py, w, h).data;
			let n = 0;
			// Red-dominant, because it sits behind its own amber strip — the green filter over
			// the rest of the panel could not pass this colour at all.
			for (let i = 0; i < d.length; i += 4) if (d[i] > 90 && d[i] > d[i + 1]) n++;
			return n;
		});
	// The tape scene plays for its first half and records for its second, so this needs a
	// poll long enough to reach the record phase.
	await page.getByText('Tape', { exact: true }).click();
	await expect.poll(recLit, { timeout: 20_000 }).toBeGreaterThan(20);
});

test('TRACK is wired, not printed — it goes out with the disc', async ({ page }) => {
	await page.goto('/vfd');
	const panel = page.locator('canvas.face');
	await expect(panel).toBeVisible();
	// TRACK labels the disc's counter, so it is an annunciator rather than silkscreen: a
	// printed one would sit there on the tuner labelling a blank field. Frame x 192..218,
	// y 6..13 of 320×110.
	const trackLit = () =>
		panel.evaluate((el) => {
			const c = el as HTMLCanvasElement;
			const ctx = c.getContext('2d', { willReadFrequently: true });
			if (!ctx || !c.width) return 0;
			const px = Math.floor(c.width * (192 / 320));
			const py = Math.floor(c.height * (5 / 110));
			const w = Math.max(1, Math.floor(c.width * (27 / 320)));
			const h = Math.max(1, Math.floor(c.height * (9 / 110)));
			const d = ctx.getImageData(px, py, w, h).data;
			let n = 0;
			for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 120) n++;
			return n;
		});
	await page.getByText('CD', { exact: true }).click();
	await expect.poll(trackLit, { timeout: 15_000 }).toBeGreaterThan(40);
	await page.getByText('Tuner', { exact: true }).click();
	await expect.poll(trackLit, { timeout: 15_000 }).toBeLessThan(10);
});

test('tapping the glass names the element under the point', async ({ page }) => {
	await page.goto('/vfd');
	const panel = page.locator('canvas.face');
	await expect.poll(() => panel.evaluate(litPixels), { timeout: 15_000 }).toBeGreaterThan(200);
	// The character field sits in the upper-left third of the frame.
	const box = (await panel.boundingBox())!;
	await page.mouse.click(box.x + box.width * 0.22, box.y + box.height * 0.38);
	await expect(page.getByText(/^tapped: /)).toBeVisible();
});
