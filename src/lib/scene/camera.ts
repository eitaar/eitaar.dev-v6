import * as THREE from "three";
import type { Vec3 } from "./gltf";

export interface PathCamera {
	place(camera: THREE.PerspectiveCamera, u: number, look: { yaw: number; pitch: number }): void;
}

export function createPathCamera(points: readonly Vec3[]): PathCamera {
	const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
	const position = new THREE.Vector3();
	const tangent = new THREE.Vector3();
	const target = new THREE.Vector3();
	return {
		place(camera, u, look) {
			const t = Math.min(Math.max(u, 0), 1);
			curve.getPointAt(t, position);
			curve.getTangentAt(t, tangent);
			camera.position.copy(position);
			camera.lookAt(target.copy(position).add(tangent));
			camera.rotateY(look.yaw);
			camera.rotateX(look.pitch);
		},
	};
}
