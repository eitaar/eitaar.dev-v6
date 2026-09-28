/**
 * Runs `load` and makes sure the WebGL context survived it. A context lost during the fetch
 * would otherwise leave a canvas that silently renders nothing over a hidden static background.
 */
export async function loadWhileAlive<T>(
	gpu: { isLost(): boolean; dispose(): void },
	load: () => Promise<T>,
	release: (world: T) => void = () => {},
): Promise<T> {
	let world: T;
	try {
		world = await load();
	} catch (error) {
		gpu.dispose();
		throw error;
	}
	if (gpu.isLost()) {
		release(world);
		gpu.dispose();
		throw new Error("scene: the WebGL context was lost while loading");
	}
	return world;
}
