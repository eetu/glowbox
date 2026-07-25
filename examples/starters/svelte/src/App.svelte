<script lang="ts">
	// glowbox starter: a pulsing sphere on the 3D LED grid + a ticking nixie tube.
	// Drag to orbit, wheel to zoom. Docs: https://www.npmjs.com/package/@glowbox/svelte
	import { LedGrid, NixieTube, type LedDisplay } from '@glowbox/svelte';

	let t = 0;
	const draw = (d: LedDisplay, dt: number) => {
		t += dt;
		d.clear();
		d.sphere([4, 4, 4], 2.2 + Math.sin(t * 2) * 0.9, '#00aaff'); // >1 channel blooms
		d.torus([4, 4, 4], 3.4, 0.5, [1.4, 0.5, 0.1], false, 'y');
	};

	let second = $state(new Date().getSeconds() % 10);
	$effect(() => {
		const id = setInterval(() => (second = new Date().getSeconds() % 10), 250);
		return () => clearInterval(id);
	});
</script>

<div class="row">
	<div class="grid">
		<LedGrid
			size={[9, 9, 9]}
			{draw}
			led={{ glow: 3 }}
			camera={{ autoOrbit: true }}
			interaction={{ zoom: true }}
		/>
	</div>
	<div class="tube">
		<NixieTube value={second} tubeStyle="classic" />
	</div>
</div>

<style>
	.row {
		display: flex;
		align-items: center;
		height: 100vh;
	}
	.grid {
		flex: 1;
		height: 100%;
	}
	.tube {
		width: 90px;
		height: 160px;
		margin-right: 24px;
	}
</style>
