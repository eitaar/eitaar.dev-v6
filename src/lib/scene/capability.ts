export interface Environment {
	viewportWidth: number;
	coarsePointer: boolean;
	reducedMotion: boolean;
	webgl: boolean;
}

export const MIN_3D_WIDTH = 1024;

export function shouldRender3D(env: Environment): boolean {
	return env.webgl && !env.reducedMotion && !env.coarsePointer && env.viewportWidth >= MIN_3D_WIDTH;
}

function hasWebGL2(doc: Document): boolean {
	try {
		const gl = doc.createElement("canvas").getContext("webgl2");
		if (!gl) return false;
		gl.getExtension("WEBGL_lose_context")?.loseContext();
		return true;
	} catch {
		return false;
	}
}

export function readEnvironment(win: Window = window): Environment {
	return {
		viewportWidth: win.innerWidth,
		coarsePointer: win.matchMedia("(pointer: coarse)").matches,
		reducedMotion: win.matchMedia("(prefers-reduced-motion: reduce)").matches,
		webgl: hasWebGL2(win.document),
	};
}
