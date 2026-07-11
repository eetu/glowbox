<script lang="ts">
	// The rendering-core switcher: the glowbox wordmark + a segmented nav between the
	// demo's cores. glowbox is a *family* of glowing display cores (the 3D LED grid, the
	// nixie tube, …); this header cluster is shared by every route so the cores read as
	// siblings of one app rather than separate pages.
	import { resolve } from '$app/paths';

	let { core }: { core: 'led' | 'nixie' } = $props();
	const tabs = [
		{ id: 'led', label: 'LED grid', path: '/' },
		{ id: 'nixie', label: 'Nixie', path: '/nixie' }
	] as const;
</script>

<div class="corenav">
	<a class="brand" href={resolve('/')}>glowbox</a>
	<nav class="cores" aria-label="rendering core">
		{#each tabs as t (t.id)}
			<a
				class="core"
				class:active={t.id === core}
				aria-current={t.id === core ? 'page' : undefined}
				href={resolve(t.path)}>{t.label}</a
			>
		{/each}
	</nav>
	<a
		class="repo"
		href="https://github.com/eetu/glowbox"
		target="_blank"
		rel="noreferrer"
		aria-label="glowbox on GitHub"
		title="View source on GitHub"
	>
		<!-- GitHub mark (brand icon; Lucide dropped its logo set) -->
		<svg viewBox="0 0 16 16" width="17" height="17" fill="currentColor" aria-hidden="true">
			<path
				d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"
			/>
		</svg>
	</a>
</div>

<style>
	.corenav {
		display: inline-flex;
		align-items: center;
		gap: 12px;
		flex: 0 0 auto;
	}
	.brand {
		font-family: var(--halo-font-heading);
		font-weight: 600;
		font-size: 18px;
		letter-spacing: -0.02em;
		color: var(--halo-accent);
		text-decoration: none;
	}
	.cores {
		display: inline-flex;
		padding: 2px;
		gap: 2px;
		border: 1px solid var(--halo-border);
		border-radius: var(--halo-radius);
		background: var(--halo-bg-main);
	}
	.core {
		padding: 4px 10px;
		border-radius: calc(var(--halo-radius) - 2px);
		font-size: 13px;
		line-height: 1.4;
		color: var(--halo-text-muted);
		text-decoration: none;
		white-space: nowrap;
		transition:
			background var(--halo-d-fast) ease-out,
			color var(--halo-d-fast) ease-out;
	}
	.core:hover {
		color: var(--halo-text-main);
	}
	.core.active {
		background: var(--halo-accent-soft);
		color: var(--halo-text-main);
		font-weight: 600;
	}
	.core:focus-visible {
		outline: 2px solid var(--halo-accent);
		outline-offset: 1px;
	}
	.repo {
		display: inline-flex;
		align-items: center;
		color: var(--halo-text-muted);
		transition: color var(--halo-d-fast) ease-out;
	}
	.repo:hover {
		color: var(--halo-text-main);
	}
	.repo:focus-visible {
		outline: 2px solid var(--halo-accent);
		outline-offset: 2px;
		border-radius: 4px;
	}
	@media (max-width: 720px) {
		.corenav {
			gap: 8px;
		}
		.core {
			padding: 4px 8px;
		}
	}
</style>
