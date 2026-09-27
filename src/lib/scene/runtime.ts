import { gsap } from "gsap";
import * as THREE from "three";
import { damp, depthsFactor, PATH_POINTS, pointerLook } from "./path";
import { createPoolrooms } from "./poolrooms";

export interface SceneHandle {
	setU(u: number): void;
	dispose(): void;
}

const FOLLOW = 4;

export function mountScene(
	canvas: HTMLCanvasElement,
	initialU: number,
	onContextLost: () => void,
): SceneHandle {
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

	const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
	const world = createPoolrooms();
	const curve = new THREE.CatmullRomCurve3(
		PATH_POINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
	);

	let targetU = initialU;
	let u = initialU;
	const look = { yaw: 0, pitch: 0 };
	let lookTarget = { yaw: 0, pitch: 0 };
	const position = new THREE.Vector3();
	const tangent = new THREE.Vector3();
	const lookAt = new THREE.Vector3();

	const resize = () => {
		renderer.setSize(window.innerWidth, window.innerHeight, false);
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
	};

	const onPointer = (event: PointerEvent) => {
		lookTarget = pointerLook(
			(event.clientX / window.innerWidth) * 2 - 1,
			(event.clientY / window.innerHeight) * 2 - 1,
		);
	};

	// gsap.ticker: time in seconds, deltaTime in ms. The only frame loop on the page.
	const tick = (time: number, deltaTime: number) => {
		const dt = Math.min(deltaTime / 1000, 0.1);
		u = damp(u, targetU, FOLLOW, dt);
		look.yaw = damp(look.yaw, lookTarget.yaw, FOLLOW, dt);
		look.pitch = damp(look.pitch, lookTarget.pitch, FOLLOW, dt);

		curve.getPointAt(u, position);
		curve.getTangentAt(u, tangent);
		camera.position.copy(position);
		camera.lookAt(lookAt.copy(position).add(tangent));
		camera.rotateY(look.yaw);
		camera.rotateX(look.pitch);

		world.setDepths(depthsFactor(u));
		world.update(time);
		renderer.render(world.scene, camera);
	};

	// A lost context never comes back here: stop rendering and let the static background take over.
	const onLost = () => {
		gsap.ticker.remove(tick);
		onContextLost();
	};

	resize();
	canvas.addEventListener("webglcontextlost", onLost);
	window.addEventListener("resize", resize);
	window.addEventListener("pointermove", onPointer, { passive: true });
	gsap.ticker.add(tick);

	return {
		setU(next) {
			targetU = next;
		},
		dispose() {
			gsap.ticker.remove(tick);
			canvas.removeEventListener("webglcontextlost", onLost);
			window.removeEventListener("resize", resize);
			window.removeEventListener("pointermove", onPointer);
			world.dispose();
			renderer.dispose();
		},
	};
}
