import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { pathFromNodes, type Vec3 } from "./gltf";

export const SCENE_URL = "/scene/poolrooms.glb";

export interface Poolrooms {
	scene: THREE.Scene;
	path: Vec3[];
	lights: { hemi: THREE.HemisphereLight; sun: THREE.DirectionalLight };
	setDepths(factor: number): void;
	update(time: number): void;
	dispose(): void;
}

const POOL_AIR = new THREE.Color("#e9f1ef");
const DEPTHS_DARK = new THREE.Color("#040506");

/** Loads the Blender-exported Poolrooms. Lighting here is interim until Plan C2 bakes it. */
export async function loadPoolrooms(url: string = SCENE_URL): Promise<Poolrooms> {
	const gltf = await new GLTFLoader().loadAsync(url);
	const root = gltf.scene;
	root.updateMatrixWorld(true);

	const nodes: { name: string; position: Vec3 }[] = [];
	const world = new THREE.Vector3();
	root.traverse((object) => {
		if (/^path_\d+$/.test(object.name)) {
			object.getWorldPosition(world);
			nodes.push({ name: object.name, position: [world.x, world.y, world.z] });
		}
		if (object instanceof THREE.Mesh) {
			const material = object.material as THREE.MeshStandardMaterial;
			if (material.name === "Water") {
				material.transparent = true;
				material.depthWrite = false;
			}
		}
	});
	const path = pathFromNodes(nodes);

	const scene = new THREE.Scene();
	const background = POOL_AIR.clone();
	const fog = new THREE.Fog(POOL_AIR.clone(), 12, 70);
	scene.background = background;
	scene.fog = fog;
	scene.add(root);

	const hemi = new THREE.HemisphereLight("#fffaf0", "#9fd6d2", 1.6);
	const sun = new THREE.DirectionalLight("#fff6e8", 1.2);
	sun.position.set(-3, 10, 2);
	scene.add(hemi, sun);

	return {
		scene,
		path,
		lights: { hemi, sun },
		setDepths(factor) {
			background.lerpColors(POOL_AIR, DEPTHS_DARK, factor);
			fog.color.lerpColors(POOL_AIR, DEPTHS_DARK, factor);
			fog.near = THREE.MathUtils.lerp(12, 2, factor);
			fog.far = THREE.MathUtils.lerp(70, 14, factor);
		},
		update() {},
		dispose() {
			root.traverse((object) => {
				if (object instanceof THREE.Mesh) {
					object.geometry.dispose();
					const material = object.material as THREE.MeshStandardMaterial;
					material.map?.dispose();
					material.dispose();
				}
			});
		},
	};
}
