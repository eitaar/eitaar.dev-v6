import { type Environment, shouldRender3D } from "./capability";

export type BackgroundMode = "scene" | "static";

export async function startBackground(deps: {
	env: Environment;
	/** Receives `onLost`, to call if the scene dies after mounting (e.g. WebGL context loss). */
	mountScene: (onLost: () => void) => Promise<void>;
	setMode: (mode: BackgroundMode) => void;
}): Promise<BackgroundMode> {
	const { env, mountScene, setMode } = deps;
	if (!shouldRender3D(env)) {
		setMode("static");
		return "static";
	}
	try {
		await mountScene(() => setMode("static"));
		setMode("scene");
		return "scene";
	} catch (error) {
		console.warn("[scene] falling back to the static background", error);
		setMode("static");
		return "static";
	}
}

export function createUBridge(): {
	push(u: number): void;
	current(): number;
	connect(fn: (u: number) => void): void;
} {
	let latest = 0;
	let target: ((u: number) => void) | undefined;
	return {
		push(u) {
			latest = u;
			target?.(u);
		},
		current() {
			return latest;
		},
		connect(fn) {
			target = fn;
			fn(latest);
		},
	};
}
