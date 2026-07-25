// glowbox starter: a pulsing sphere on the 3D LED grid + a ticking nixie tube.
// Drag to orbit, wheel to zoom. Docs: https://www.npmjs.com/package/@glowbox/react
import { LedGrid, NixieTube } from '@glowbox/react';
import type { LedDisplay } from '@glowbox/react';
import { useEffect, useState } from 'react';

let t = 0;
const draw = (d: LedDisplay, dt: number) => {
	t += dt;
	d.clear();
	d.sphere([4, 4, 4], 2.2 + Math.sin(t * 2) * 0.9, '#00aaff'); // >1 channel blooms
	d.torus([4, 4, 4], 3.4, 0.5, [1.4, 0.5, 0.1], false, 'y');
};

export default function App() {
	const [second, setSecond] = useState(new Date().getSeconds() % 10);
	useEffect(() => {
		const id = setInterval(() => setSecond(new Date().getSeconds() % 10), 250);
		return () => clearInterval(id);
	}, []);

	return (
		<div style={{ display: 'flex', height: '100vh', alignItems: 'center' }}>
			<div style={{ flex: 1, height: '100%' }}>
				<LedGrid
					size={[9, 9, 9]}
					draw={draw}
					led={{ glow: 3 }}
					camera={{ autoOrbit: true }}
					interaction={{ zoom: true }}
				/>
			</div>
			<div style={{ width: 90, height: 160, marginRight: 24 }}>
				<NixieTube value={second} tubeStyle="classic" />
			</div>
		</div>
	);
}
