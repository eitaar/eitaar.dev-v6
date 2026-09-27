import { describe, expect, it } from "vitest";
import { overwriteError, parseArgs, resolveBlender } from "./blender.mjs";

const WIN = "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe";

describe("resolveBlender", () => {
	it("prefers the BLENDER environment variable when it exists", () => {
		expect(resolveBlender({ BLENDER: "/opt/blender" }, (p) => p === "/opt/blender")).toBe(
			"/opt/blender",
		);
	});
	it("explains a BLENDER variable that points at nothing", () => {
		expect(() => resolveBlender({ BLENDER: "/nope" }, () => false)).toThrow(
			/BLENDER is set to "\/nope"/,
		);
	});
	it("finds the default Windows install", () => {
		expect(resolveBlender({}, (p) => p === WIN)).toBe(WIN);
	});
	it("falls back to blender on PATH", () => {
		expect(resolveBlender({}, () => false)).toBe("blender");
	});
});

describe("overwriteError", () => {
	it("refuses to regenerate over an existing .blend without --force", () => {
		expect(overwriteError("scene/poolrooms.blend", false, () => true)).toMatch(/--force/);
	});
	it("allows it with --force", () => {
		expect(overwriteError("scene/poolrooms.blend", true, () => true)).toBeNull();
	});
	it("allows the first generation", () => {
		expect(overwriteError("scene/poolrooms.blend", false, () => false)).toBeNull();
	});
});

describe("parseArgs", () => {
	it("splits runner flags from the script and passthrough args", () => {
		expect(parseArgs(["--blend", "a.blend", "s.py", "--force", "--", "mosaic"])).toEqual({
			blend: "a.blend",
			script: "s.py",
			force: true,
			passthrough: ["mosaic"],
		});
	});
	it("works without --blend or passthrough", () => {
		expect(parseArgs(["s.py"])).toEqual({
			blend: undefined,
			script: "s.py",
			force: false,
			passthrough: [],
		});
	});
});
