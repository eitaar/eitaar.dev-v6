import { gsap } from "gsap";
import GUI from "lil-gui";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createPathCamera } from "./camera";
import { depthsExposure, depthsFactor } from "./path";
import { loadPoolrooms } from "./poolrooms";

/** Dev-only tuning view for the Poolrooms scene. Never shipped (see astro.config.mjs). */
export async function startLab(canvas: HTMLCanvasElement): Promise<void> {
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.toneMapping = THREE.AgXToneMapping;

	const world = await loadPoolrooms();
	const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 200);
	const pathCamera = createPathCamera(world.path);
	const controls = new OrbitControls(camera, canvas);
	controls.enabled = false;

	const state = {
		mode: "path" as "path" | "free",
		u: 0,
		depths: -1,
		hemi: world.lights.hemi.intensity,
		sun: world.lights.sun.intensity,
	};
	const gui = new GUI({ title: "Poolrooms lab" });
	gui.add(state, "mode", ["path", "free"]).onChange((mode: "path" | "free") => {
		controls.enabled = mode === "free";
		if (mode === "free") {
			controls.target.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()));
			controls.update();
		}
	});
	gui.add(state, "u", 0, 1, 0.001);
	gui.add(state, "depths", -1, 1, 0.01).name("depths (-1 = from u)");
	gui.add(state, "hemi", 0, 5, 0.01).onChange((v: number) => {
		world.lights.hemi.intensity = v;
	});
	gui.add(state, "sun", 0, 5, 0.01).onChange((v: number) => {
		world.lights.sun.intensity = v;
	});

	const resize = () => {
		renderer.setSize(window.innerWidth, window.innerHeight, false);
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
	};
	window.addEventListener("resize", resize);
	resize();

	gsap.ticker.add((time) => {
		if (state.mode === "path") pathCamera.place(camera, state.u, { yaw: 0, pitch: 0 });
		else controls.update();
		const factor = state.depths >= 0 ? state.depths : depthsFactor(state.u);
		world.setDepths(factor);
		renderer.toneMappingExposure = depthsExposure(factor);
		world.update(time);
		renderer.render(world.scene, camera);
	});
}
