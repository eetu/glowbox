<script lang="ts">
	// Demo gallery: pick an example program; the <LedGrid> display runs it. The
	// display is the reusable library (src/lib/led-grid); the programs are demo
	// drivers (src/lib/examples). Changing the example recreates both.
	import { makePacman } from '$lib/examples/pacman';
	import { makeTorusDraw } from '$lib/examples/torus';
	import { LedGrid } from '$lib/led-grid';

	type Size = [number, number, number];
	type Example = {
		size: Size;
		make: () => (d: import('$lib/led-grid').LedDisplay, dt: number) => void;
	};
	const examples: Record<string, Example> = {
		'3D Pac-Man': { size: [7, 7, 7], make: () => makePacman(7) },
		'Spinning torus': { size: [16, 16, 16], make: () => makeTorusDraw() }
	};

	let name = $state('3D Pac-Man');
	const size = $derived(examples[name].size);
	const draw = $derived(examples[name].make()); // fresh program when the example changes
</script>

<div class="app">
	<header>
		<div class="brand">voxl</div>
		<select bind:value={name} aria-label="example">
			{#each Object.keys(examples) as n (n)}
				<option value={n}>{n}</option>
			{/each}
		</select>
		<span class="hint">drag to orbit</span>
	</header>
	<div class="stage">
		<!-- Remount on example change: the display owns a WebGL canvas whose context
		     is lost on dispose, so a fresh canvas (new key) is cleaner than reusing. -->
		{#key name}
			<LedGrid {size} {draw} />
		{/key}
	</div>
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		height: 100dvh;
	}
	header {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 10px 16px;
		border-bottom: 1px solid var(--halo-border);
		background: var(--halo-bg-main);
	}
	.brand {
		font-family: 'Space Grotesk', 'Inter', sans-serif;
		font-weight: 600;
		font-size: 18px;
		letter-spacing: 0.02em;
		color: var(--halo-accent, #f78f08);
	}
	select {
		font: inherit;
		padding: 4px 8px;
		border: 1px solid var(--halo-border);
		border-radius: 6px;
		background: var(--halo-bg-light);
		color: var(--halo-text-main);
	}
	.hint {
		margin-left: auto;
		font-size: 12px;
		color: var(--halo-text-muted);
	}
	.stage {
		flex: 1;
		min-height: 0;
	}
</style>
