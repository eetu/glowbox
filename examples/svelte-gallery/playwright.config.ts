import { defineConfig, devices } from '@playwright/test';

// e2e against the built, as-shipped app (per the house testing convention,
// Playwright is reserved for the full-app check). The web server builds then
// serves the static SPA before the tests run.
export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	use: {
		baseURL: 'http://localhost:4173'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: 'vite build && vite preview --port 4173 --strictPort',
		port: 4173,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	}
});
