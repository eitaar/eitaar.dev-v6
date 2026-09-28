import { describe, expect, it, vi } from "vitest";
import { loadWhileAlive } from "./mount";

const gpu = (lost = false) => ({ isLost: vi.fn(() => lost), dispose: vi.fn() });

describe("loadWhileAlive", () => {
	it("returns the loaded world while the context is alive", async () => {
		const g = gpu(false);
		await expect(loadWhileAlive(g, async () => "world")).resolves.toBe("world");
		expect(g.dispose).not.toHaveBeenCalled();
	});

	it("disposes the GPU and rethrows when loading fails", async () => {
		const g = gpu(false);
		await expect(loadWhileAlive(g, async () => Promise.reject(new Error("404")))).rejects.toThrow(
			"404",
		);
		expect(g.dispose).toHaveBeenCalled();
	});

	it("context lost during load: releases everything and throws so the page falls back", async () => {
		const g = gpu(true);
		const release = vi.fn();
		await expect(loadWhileAlive(g, async () => "world", release)).rejects.toThrow(
			/context was lost/,
		);
		expect(g.dispose).toHaveBeenCalled();
		expect(release).toHaveBeenCalledWith("world");
	});
});
