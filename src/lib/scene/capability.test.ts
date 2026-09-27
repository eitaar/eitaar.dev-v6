import { describe, expect, it } from "vitest";
import { type Environment, MIN_3D_WIDTH, shouldRender3D } from "./capability";

const desktop: Environment = {
	viewportWidth: 1440,
	coarsePointer: false,
	reducedMotion: false,
	webgl: true,
};

describe("shouldRender3D", () => {
	it("renders on a capable desktop", () => {
		expect(shouldRender3D(desktop)).toBe(true);
	});

	it("renders exactly at the width threshold", () => {
		expect(shouldRender3D({ ...desktop, viewportWidth: MIN_3D_WIDTH })).toBe(true);
	});

	it.each<[string, Partial<Environment>]>([
		["narrow viewport", { viewportWidth: MIN_3D_WIDTH - 1 }],
		["coarse pointer", { coarsePointer: true }],
		["reduced motion", { reducedMotion: true }],
		["no WebGL2", { webgl: false }],
	])("does not render with %s", (_, override) => {
		expect(shouldRender3D({ ...desktop, ...override })).toBe(false);
	});
});
