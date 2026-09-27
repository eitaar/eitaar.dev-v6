import { describe, expect, it } from "vitest";
import { pathFromNodes } from "./gltf";

const node = (name: string, z: number) => ({ name, position: [0, 1, z] as const });

describe("pathFromNodes", () => {
	it("orders path_NN nodes numerically, not alphabetically", () => {
		const path = pathFromNodes([node("path_10", -10), node("path_2", -2), node("path_0", 0)]);
		expect(path.map((p) => p[2])).toEqual([0, -2, -10]);
	});

	it("ignores unrelated nodes", () => {
		const path = pathFromNodes([
			node("PassageA", 5),
			node("path_00", 0),
			node("anchor_pool", 3),
			node("path_01", -1),
		]);
		expect(path).toHaveLength(2);
	});

	it("fails loudly with fewer than 2 points", () => {
		expect(() => pathFromNodes([node("path_00", 0)])).toThrow(/at least 2/);
		expect(() => pathFromNodes([])).toThrow(/at least 2/);
	});
});
