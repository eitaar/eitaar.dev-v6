import * as THREE from "three";

export interface Poolrooms {
	scene: THREE.Scene;
	setAlley(factor: number): void;
	update(time: number): void;
	dispose(): void;
}

const POOL_SKY = new THREE.Color("#eef6f7");
const ALLEY_DARK = new THREE.Color("#050607");

/** Placeholder geometry. Plan C replaces this body with the Blender scene; keep the interface. */
export function createPoolrooms(): Poolrooms {
	const scene = new THREE.Scene();
	const background = POOL_SKY.clone();
	const fog = new THREE.Fog(POOL_SKY.clone(), 8, 45);
	scene.background = background;
	scene.fog = fog;

	const tile = new THREE.MeshStandardMaterial({ color: "#f4f7f6", roughness: 0.35 });
	const water = new THREE.MeshStandardMaterial({
		color: "#7fd3dc",
		roughness: 0.08,
		transparent: true,
		opacity: 0.85,
	});
	const alleyWall = new THREE.MeshStandardMaterial({ color: "#1b1d1f", roughness: 0.9 });

	const box = (
		w: number,
		h: number,
		d: number,
		mat: THREE.Material,
		x: number,
		y: number,
		z: number,
	) => {
		const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
		mesh.position.set(x, y, z);
		scene.add(mesh);
		return mesh;
	};

	// Poolrooms hall: z 0 → -52, 8 wide, 4.5 high
	box(8, 0.2, 52, tile, 0, -0.1, -26); // floor
	box(8, 0.2, 52, tile, 0, 4.5, -26); // ceiling
	box(0.2, 4.6, 52, tile, -4, 2.2, -26); // left wall
	box(0.2, 4.6, 46, tile, 4, 2.2, -23); // right wall up to the Alley opening (z -46)
	box(0.2, 4.6, 2, tile, 4, 2.2, -51); // right wall after the opening (z -50 to -52)
	box(8, 4.6, 0.2, tile, 0, 2.2, -52); // end wall

	// Pool around the centre Anchor
	box(5, 0.05, 18, water, 0, 0.02, -21);

	// Symbolic object placeholder, floating over the pool
	const symbol = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), tile);
	symbol.position.set(-1.8, 2.2, -24); // off the camera path (x = 0)
	scene.add(symbol);

	// Alley: narrow passage through the right-wall opening, running +x at z -48
	box(18, 0.2, 3, alleyWall, 13, -0.1, -48); // floor
	box(18, 0.2, 3, alleyWall, 13, 3.4, -48); // ceiling
	box(18, 3.6, 0.2, alleyWall, 13, 1.7, -46.5); // left wall
	box(18, 3.6, 0.2, alleyWall, 13, 1.7, -49.5); // right wall
	box(0.2, 3.6, 3, alleyWall, 22, 1.7, -48); // dead end: there is no exit

	const hemi = new THREE.HemisphereLight("#ffffff", "#bfe3e6", 1.4);
	scene.add(hemi);
	const lamps = [-8, -20, -32, -44].map((z) => {
		const lamp = new THREE.PointLight("#f3fbff", 12, 18);
		lamp.position.set(0, 4.2, z);
		scene.add(lamp);
		return lamp;
	});

	return {
		scene,
		setAlley(factor) {
			background.lerpColors(POOL_SKY, ALLEY_DARK, factor);
			fog.color.lerpColors(POOL_SKY, ALLEY_DARK, factor);
			fog.far = THREE.MathUtils.lerp(45, 12, factor);
			hemi.intensity = THREE.MathUtils.lerp(1.4, 0.04, factor);
			for (const lamp of lamps) lamp.intensity = THREE.MathUtils.lerp(12, 0, factor);
		},
		update(time) {
			symbol.rotation.y = time * 0.2;
			symbol.position.y = 2.2 + Math.sin(time * 0.6) * 0.08;
		},
		dispose() {
			scene.traverse((object) => {
				if (object instanceof THREE.Mesh) {
					object.geometry.dispose();
				}
			});
			for (const mat of [tile, water, alleyWall]) mat.dispose();
		},
	};
}
