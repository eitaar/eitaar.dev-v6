import { describe, expect, it, vi } from "vitest";
import { createUBridge, startBackground } from "./background";
import type { Environment } from "./capability";

const capable: Environment = {
	viewportWidth: 1440,
	coarsePointer: false,
	reducedMotion: false,
	webgl: true,
};

describe("startBackground", () => {
	it("stays static and never mounts on an incapable device", async () => {
		const mountScene = vi.fn(async () => {});
		const setMode = vi.fn();
		const mode = await startBackground({
			env: { ...capable, reducedMotion: true },
			mountScene,
			setMode,
		});
		expect(mode).toBe("static");
		expect(mountScene).not.toHaveBeenCalled();
		expect(setMode).toHaveBeenCalledWith("static");
	});

	it("switches to the scene after a successful mount", async () => {
		const setMode = vi.fn();
		const mode = await startBackground({ env: capable, mountScene: async () => {}, setMode });
		expect(mode).toBe("scene");
		expect(setMode).toHaveBeenLastCalledWith("scene");
	});

	it("mount failure: falls back to static without throwing", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const setMode = vi.fn();
		const mode = await startBackground({
			env: capable,
			mountScene: async () => {
				throw new Error("Error creating WebGL context.");
			},
			setMode,
		});
		expect(mode).toBe("static");
		expect(setMode).toHaveBeenLastCalledWith("static");
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});
});

describe("createUBridge", () => {
	it("late connect: receives the latest u pushed before connecting", () => {
		const bridge = createUBridge();
		bridge.push(0.4);
		bridge.push(0.8);
		const fn = vi.fn();
		bridge.connect(fn);
		expect(fn).toHaveBeenCalledWith(0.8);
	});

	it("forwards later pushes after connecting", () => {
		const bridge = createUBridge();
		const fn = vi.fn();
		bridge.connect(fn);
		bridge.push(0.5);
		expect(fn).toHaveBeenLastCalledWith(0.5);
	});

	it("current() reports the latest u, 0 before any push", () => {
		const bridge = createUBridge();
		expect(bridge.current()).toBe(0);
		bridge.push(0.9);
		expect(bridge.current()).toBe(0.9);
	});

	it("connect before any push: starts at 0", () => {
		const fn = vi.fn();
		createUBridge().connect(fn);
		expect(fn).toHaveBeenCalledWith(0);
	});
});
