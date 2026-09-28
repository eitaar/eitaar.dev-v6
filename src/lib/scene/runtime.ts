import { gsap } from "gsap";
import * as THREE from "three";
import { createPathCamera } from "./camera";
import { loadWhileAlive } from "./mount";
import { damp, depthsExposure, depthsFactor, pointerLook } from "./path";
import { loadPoolrooms, type Poolrooms, SCENE_URL } from "./poolrooms";

export interface SceneHandle {
	setU(u: number): void;
	dispose(): void;
}

const FOLLOW = 4;

export async function mountScene(
	canvas: HTMLCanvasElement,
	initialU: number,
	onContextLost: () => void,
	url: string = SCENE_URL,
): Promise<SceneHandle> {
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
	renderer.toneMapping = THREE.AgXToneMapping;

	const world: Poolrooms = await loadWhileAlive(
		{
			isLost: () => renderer.getContext().isContextLost(),
			dispose: () => {
				renderer.dispose();
				renderer.forceContextLoss();
			},
		},
		() => loadPoolrooms(url),
		(loaded) => loaded.dispose(),
	);

	const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 200);
	const pathCamera = createPathCamera(world.path);

	let targetU = initialU;
	let u = initialU;
	const look = { yaw: 0, pitch: 0 };
	let lookTarget = { yaw: 0, pitch: 0 };

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
		pathCamera.place(camera, u, look);

		const factor = depthsFactor(u);
		world.setDepths(factor);
		renderer.toneMappingExposure = depthsExposure(factor);
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
