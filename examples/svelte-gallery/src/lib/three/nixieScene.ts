// A 3D nixie clock: real bent-wire cathodes inside refractive glass tubes on a stand,
// orbiting. Everything nixie-specific comes from @glowbox/nixie — the full cathode stack
// (`nixieCathodes`, every numeral present, one lit), the wire thickness + squash
// (`nixieStyle`), the honeycomb anode grille (`nixieMesh`), the separator paths
// (`glyphPath`) and the wire colour (`NIXIE_WIRE_COLOR`). This file only owns the 3D part
// the component can't: extruding those paths into geometry, the glass, and the bloom.
import {
	GLYPH_VIEWBOX,
	glyphPath,
	NIXIE_WIRE_COLOR,
	nixieCathodes,
	nixieMesh,
	nixieStyle
} from '@glowbox/nixie';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface NixieSceneOptions {
	digits: string[];
	/** Glow / lit-numeral colour (CSS string). */
	color: string;
	/** Glass tint (CSS string). */
	glass: string;
	/** Scene backdrop (CSS string). */
	backdrop: string;
	/** Tube proportions, matching the 2D control. */
	style: 'classic' | 'slim' | 'tall';
}

export interface NixieScene {
	setDigits(digits: string[]): void;
	setOptions(patch: Partial<Omit<NixieSceneOptions, 'digits'>>): void;
	resize(): void;
	dispose(): void;
}

// Tube dimensions (world units).
const DIGIT_TUBE_R = 0.62;
const COLON_TUBE_R = 0.34;
const TUBE_H = 2.05;
const CONTENT_H = 2.95; // full vertical extent (base → domed top) for camera framing
const GAP = 0.14;
// Fit a numeral comfortably inside the glass: cap width to the inner diameter and height
// to a fraction of the tube, so nothing overflows the glass.
const INNER_R = DIGIT_TUBE_R * 0.72;
const S = Math.min((INNER_R * 2) / GLYPH_VIEWBOX.width, (TUBE_H * 0.6) / GLYPH_VIEWBOX.height);
// Wire radius from the component's stroke width (classic gauge; squash conveys style live).
const WIRE_R = nixieStyle('classic').strokeWidth * S * 0.28;
const STACK_SPACING = 0.055; // z gap between adjacent cathodes (tight, like a real tube)
const FRONT_Z = 4.5 * STACK_SPACING; // z of the frontmost cathode (depth 0)

const isColonSlot = (i: number) => i === 2 || i === 5;

// Map a glyph-viewBox point (y-down) into world space at depth z.
const toWorld = (px: number, py: number, z: number) =>
	new THREE.Vector3((px - GLYPH_VIEWBOX.width / 2) * S, -(py - GLYPH_VIEWBOX.height / 2) * S, z);

// Extrude a glyph's SVG centreline into merged tube geometry (cached per symbol).
function tubeFromPath(d: string): THREE.BufferGeometry | null {
	const parsed = svgLoader().parse(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GLYPH_VIEWBOX.width} ${GLYPH_VIEWBOX.height}"><path d="${d}"/></svg>`
	);
	const parts: THREE.BufferGeometry[] = [];
	for (const path of parsed.paths) {
		for (const sub of path.subPaths) {
			const pts = sub.getPoints(40); // 80 cathode tubes → keep the curve/radial segments modest
			if (pts.length < 2) continue;
			const v3 = pts.map((p) => toWorld(p.x, p.y, 0));
			const curve = new THREE.CatmullRomCurve3(v3, false, 'centripetal');
			parts.push(new THREE.TubeGeometry(curve, Math.max(20, v3.length), WIRE_R, 6, false));
		}
	}
	if (!parts.length) return null;
	const merged = mergeGeometries(parts, false);
	parts.forEach((p) => p.dispose());
	return merged;
}

// The honeycomb anode grille (from the component's mesh layout), as line segments over the
// digit face, sitting in the middle of the cathode stack (as in a real tube).
function grilleGeometry(): THREE.BufferGeometry {
	const { radius, cells } = nixieMesh(GLYPH_VIEWBOX.width, GLYPH_VIEWBOX.height);
	const z = 0;
	const pos: number[] = [];
	for (const c of cells) {
		const verts: THREE.Vector3[] = [];
		for (let i = 0; i < 6; i++) {
			const a = Math.PI / 6 + (i * Math.PI) / 3;
			verts.push(toWorld(c.x + radius * Math.cos(a), c.y + radius * Math.sin(a), z));
		}
		for (let i = 0; i < 6; i++) {
			const p0 = verts[i];
			const p1 = verts[(i + 1) % 6];
			pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
		}
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	return geo;
}

// Glass envelope as a revolved profile: a straight wall with a convex domed top (like a
// real nixie), open at the bottom where the metal base sits. One surface → clean refraction.
function domedTubeGeometry(r: number, radial: number): THREE.LatheGeometry {
	const domeRise = r * 0.62;
	const pts: THREE.Vector2[] = [
		new THREE.Vector2(r, -TUBE_H / 2), // bottom rim
		new THREE.Vector2(r, TUBE_H / 2) // top of the straight wall
	];
	const steps = 9;
	for (let i = 1; i <= steps; i++) {
		const t = (i / steps) * (Math.PI / 2);
		pts.push(new THREE.Vector2(r * Math.cos(t), TUBE_H / 2 + domeRise * Math.sin(t)));
	}
	return new THREE.LatheGeometry(pts, radial);
}

// Lazy SVGLoader shim (addons ship loose types across versions).
let _svg: SVGLoaderLike | null = null;
interface SVGLoaderLike {
	parse(text: string): {
		paths: { subPaths: { getPoints(divisions: number): THREE.Vector2[] }[] }[];
	};
}
function svgLoader(): SVGLoaderLike {
	if (!_svg) _svg = new SVGLoader() as unknown as SVGLoaderLike;
	return _svg;
}

interface DigitTube {
	kind: 'digit';
	cathodes: Map<string, THREE.Mesh>;
	lit: string | null;
}
interface ColonTube {
	kind: 'colon';
}
type Tube = DigitTube | ColonTube;

// The scene background: the chosen backdrop colour, but capped dark (max channel ≤ 0.14,
// hue preserved) so a bright page can't wash the transmissive tubes out.
function darkBackdrop(hex: string): THREE.Color {
	const c = new THREE.Color(hex);
	const m = Math.max(c.r, c.g, c.b);
	if (m > 0.14) c.multiplyScalar(0.14 / m);
	return c;
}

export function createNixieScene(container: HTMLElement, opts: NixieSceneOptions): NixieScene {
	const renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); // cap DPR: transmission + bloom are fill-rate bound
	renderer.transmissionResolutionScale = 0.5; // half-res transmission pass — the glass is soft, so it's ~free visually
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.0;
	container.appendChild(renderer.domElement);
	renderer.domElement.style.display = 'block';
	renderer.domElement.style.width = '100%';
	renderer.domElement.style.height = '100%';

	const scene = new THREE.Scene();
	// Backdrop capped dark (hue kept): clear glass transmits the background, so a bright page
	// would show straight through and wash the numerals out. Darkening it means the glass always
	// transmits a dark interior and the digits read on any chosen backdrop colour.
	scene.background = darkBackdrop(opts.backdrop);

	const pmrem = new THREE.PMREMGenerator(renderer);
	const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
	scene.environment = envTex;

	const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
	camera.position.set(0, 0.9, 10.5);

	const controls = new OrbitControls(camera, renderer.domElement);
	controls.enableDamping = true;
	controls.dampingFactor = 0.08;
	controls.autoRotate = true;
	controls.autoRotateSpeed = 1.2; // bumped: OrbitControls auto-rotate is per-frame, so it compensates for the 40fps cap
	controls.enablePan = false;
	controls.minDistance = 6;
	controls.maxDistance = 40;
	controls.target.set(0, 0, 0);

	// Soft ambient so the emissive digits carry the scene — a strong ambient floods the glass
	// (especially on a light backdrop) and washes the numerals out.
	scene.add(new THREE.AmbientLight(0xffffff, 0.28));
	const key = new THREE.DirectionalLight(0xffffff, 0.34);
	key.position.set(4, 6, 5);
	scene.add(key);
	const rim = new THREE.DirectionalLight(0x8fb4ff, 0.18);
	rim.position.set(-5, 2, -4);
	scene.add(rim);

	// Materials (shared; retinted live).
	const glowMat = new THREE.MeshStandardMaterial({
		color: new THREE.Color(opts.color).multiplyScalar(0.2),
		emissive: new THREE.Color(opts.color),
		emissiveIntensity: 3.4,
		roughness: 0.45,
		metalness: 0
	});
	// Unlit cathodes: the component's dull-nickel wire, but darkened + roughened so the stack
	// reads as a faint ghost behind the one lit numeral instead of a bright tangle (it catches
	// too much of the environment otherwise, drowning the glow).
	const wireMat = new THREE.MeshStandardMaterial({
		color: new THREE.Color(...NIXIE_WIRE_COLOR).multiplyScalar(0.11),
		roughness: 0.82,
		metalness: 0.2,
		envMapIntensity: 0.14
	});
	// Clear glass — the `glass` control tints it only faintly (via attenuation), so the lit
	// wire reads through it (unlike the 2D tube's dark fake-glass).
	const glassMat = new THREE.MeshPhysicalMaterial({
		color: 0xeef2f7,
		metalness: 0,
		roughness: 0.06, // clear (not frosted) so transmission stays sharp, not a milky scatter
		transmission: 1,
		// A real volume (not thin-walled) so the glass swatch actually tints the glass: light
		// crossing it is absorbed by `attenuationColor` over a short `attenuationDistance`, so a
		// dark swatch = smoked glass that reads on ANY backdrop (a bright page is absorbed to
		// dark), and a coloured swatch = coloured glass. ior stays low to keep the lens tame.
		thickness: 0.3,
		ior: 1.22,
		opacity: 1,
		transparent: true,
		attenuationColor: new THREE.Color(opts.glass),
		attenuationDistance: 1.4, // tints a coloured swatch clearly, but a near-black swatch won't swallow the glow
		// Kill the hot highlights: a near-mirror surface reflects the light sources straight back
		// as blown-out spots. No clearcoat (a full glossy reflector), low env, and a reduced
		// dielectric specular (`specularIntensity`) drop the front reflectivity without frosting
		// the transmission (which is what raising roughness would do → milky on a light bg).
		envMapIntensity: 0.12,
		specularIntensity: 0.3
	});
	const metalMat = new THREE.MeshStandardMaterial({
		color: 0x24262d,
		roughness: 0.5,
		metalness: 0.6
	});
	const grilleMat = new THREE.LineBasicMaterial({ color: 0x4a4e58 });
	const standMat = new THREE.MeshStandardMaterial({
		color: 0x17181d,
		roughness: 0.6,
		metalness: 0.4
	});

	// Shared geometry (built once).
	const wireGeo = new Map<string, THREE.BufferGeometry | null>();
	const geomFor = (symbol: string, d: string): THREE.BufferGeometry | null => {
		if (!wireGeo.has(symbol)) wireGeo.set(symbol, d ? tubeFromPath(d) : null);
		return wireGeo.get(symbol) ?? null;
	};
	const grilleGeo = grilleGeometry();
	const glassGeoDigit = domedTubeGeometry(DIGIT_TUBE_R, 32);
	const glassGeoColon = domedTubeGeometry(COLON_TUBE_R, 24);
	const baseGeoDigit = new THREE.CylinderGeometry(
		DIGIT_TUBE_R * 1.05,
		DIGIT_TUBE_R * 1.15,
		0.24,
		24
	);
	const baseGeoColon = new THREE.CylinderGeometry(COLON_TUBE_R * 1.1, COLON_TUBE_R * 1.2, 0.24, 20);

	const root = new THREE.Group();
	scene.add(root);
	let tubes: Tube[] = [];
	let contentW = 12; // full row width, set in layout() — drives the camera framing

	function tubeShell(group: THREE.Group, colon: boolean) {
		const glass = new THREE.Mesh(colon ? glassGeoColon : glassGeoDigit, glassMat);
		glass.renderOrder = 3;
		group.add(glass);
		const base = new THREE.Mesh(colon ? baseGeoColon : baseGeoDigit, metalMat);
		base.position.y = -TUBE_H / 2 - 0.06;
		group.add(base);
	}

	function layout(n: number) {
		for (const c of [...root.children]) root.remove(c);
		tubes = [];
		const [sx, sy] = nixieStyle(opts.style).squash;
		const cathodeSpec = nixieCathodes();

		const widths = Array.from({ length: n }, (_, i) =>
			isColonSlot(i) ? COLON_TUBE_R * 2 : DIGIT_TUBE_R * 2
		);
		const total = widths.reduce((a, w) => a + w + GAP, -GAP);
		contentW = total + 0.4; // outer tube radius margin, for framing
		let x = -total / 2;

		for (let i = 0; i < n; i++) {
			const colon = isColonSlot(i);
			const cx = x + widths[i] / 2;
			x += widths[i] + GAP;

			const group = new THREE.Group();
			group.position.x = cx;
			root.add(group);
			tubeShell(group, colon);

			if (colon) {
				const d = glyphPath(':');
				if (d) {
					const g = geomFor(':', d);
					if (g) group.add(new THREE.Mesh(g, glowMat)); // separators stay lit
				}
				tubes.push({ kind: 'colon' });
				continue;
			}

			// Full cathode stack — every numeral present, at its depth; one is lit later.
			const stack = new THREE.Group();
			stack.scale.set(sx, sy, 1); // style squash (live)
			group.add(stack);
			const cathodes = new Map<string, THREE.Mesh>();
			for (const c of cathodeSpec) {
				const g = geomFor(c.symbol, c.path);
				if (!g) continue;
				const m = new THREE.Mesh(g, wireMat);
				m.position.set(c.offset[0] * S, -c.offset[1] * S, FRONT_Z - c.depth * STACK_SPACING);
				stack.add(m);
				cathodes.set(c.symbol, m);
			}
			// Anode grille just in front of the stack.
			const grille = new THREE.LineSegments(grilleGeo, grilleMat);
			grille.renderOrder = 2;
			group.add(grille);

			tubes.push({ kind: 'digit', cathodes, lit: null });
		}

		const stand = new THREE.Mesh(new THREE.BoxGeometry(total + 1.0, 0.34, 1.5), standMat);
		stand.position.y = -TUBE_H / 2 - 0.24;
		root.add(stand);
	}

	function setDigits(digits: string[]) {
		if (tubes.length !== digits.length) layout(digits.length);
		for (let i = 0; i < digits.length; i++) {
			const t = tubes[i];
			if (t.kind !== 'digit') continue;
			const sym = digits[i];
			if (sym === t.lit) continue;
			if (t.lit) {
				const prev = t.cathodes.get(t.lit);
				if (prev) prev.material = wireMat;
			}
			const next = t.cathodes.get(sym);
			if (next) next.material = glowMat;
			t.lit = next ? sym : null;
		}
	}

	const composer = new EffectComposer(renderer);
	composer.addPass(new RenderPass(scene, camera));
	// strength, radius, threshold — high threshold so only the bright emissive wire blooms.
	const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.1, 0.5, 0.55);
	composer.addPass(bloom);
	composer.addPass(new OutputPass());

	let raf = 0;
	let lastRender = 0;
	const MIN_FRAME_MS = 1000 / 40; // ~40fps cap — a slowly-orbiting clock doesn't need 60
	function loop(t: number) {
		raf = requestAnimationFrame(loop);
		if (typeof document !== 'undefined' && document.hidden) return; // don't render a hidden tab
		if (t - lastRender < MIN_FRAME_MS) return;
		lastRender = t;
		controls.update();
		composer.render();
	}

	// Pull the camera to whatever distance frames the whole row (width) and its height for the
	// current aspect — so a portrait phone sees the full clock (pulled back) instead of a crop.
	function frameContent() {
		const vfov = (camera.fov * Math.PI) / 180;
		const halfTan = Math.tan(vfov / 2);
		const fitH = CONTENT_H / 2 / halfTan;
		const fitW = contentW / 2 / (halfTan * camera.aspect);
		const dist = THREE.MathUtils.clamp(
			Math.max(fitH, fitW) * 1.1,
			controls.minDistance,
			controls.maxDistance
		);
		const dir = camera.position.clone().sub(controls.target).normalize();
		camera.position.copy(controls.target).addScaledVector(dir, dist);
		controls.update();
	}

	function resize() {
		const w = Math.max(1, container.clientWidth);
		const h = Math.max(1, container.clientHeight);
		renderer.setSize(w, h, false);
		composer.setSize(w, h);
		bloom.setSize(w, h);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		frameContent();
	}
	const ro = new ResizeObserver(() => resize());
	ro.observe(container);

	setDigits(opts.digits);
	resize();
	raf = requestAnimationFrame(loop);

	return {
		setDigits,
		setOptions(patch) {
			if (patch.color) {
				glowMat.emissive.set(patch.color);
				glowMat.color.set(patch.color).multiplyScalar(0.2);
				opts.color = patch.color;
			}
			if (patch.glass) {
				glassMat.attenuationColor.set(patch.glass);
				opts.glass = patch.glass;
			}
			if (patch.backdrop) {
				scene.background = darkBackdrop(patch.backdrop);
				opts.backdrop = patch.backdrop;
			}
			if (patch.style && patch.style !== opts.style) {
				opts.style = patch.style;
				const [sx, sy] = nixieStyle(opts.style).squash;
				for (const g of root.children) {
					const stack = g.children?.find((c) => c instanceof THREE.Group) as
						THREE.Group | undefined;
					stack?.scale.set(sx, sy, 1);
				}
			}
		},
		resize,
		dispose() {
			cancelAnimationFrame(raf);
			ro.disconnect();
			controls.dispose();
			wireGeo.forEach((g) => g?.dispose());
			[grilleGeo, glassGeoDigit, glassGeoColon, baseGeoDigit, baseGeoColon].forEach((g) =>
				g.dispose()
			);
			[glowMat, wireMat, glassMat, metalMat, grilleMat, standMat].forEach((m) => m.dispose());
			envTex.dispose();
			pmrem.dispose();
			composer.dispose();
			renderer.dispose();
			renderer.domElement.remove();
		}
	};
}
