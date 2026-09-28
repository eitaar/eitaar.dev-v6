import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import anchors from "../src/lib/scene/anchors.json";
import { polylineU } from "../src/lib/scene/path";

const GLB = new URL("../public/scene/poolrooms.glb", import.meta.url);
const MAX_BYTES = 6 * 1024 * 1024;

type Node = { name?: string; translation?: [number, number, number] };

function readGlbJson(buffer: Buffer): { nodes: Node[]; materials?: { name?: string }[] } {
	if (buffer.readUInt32LE(0) !== 0x46546c67) throw new Error("not a GLB file");
	const length = buffer.readUInt32LE(12);
	if (buffer.readUInt32LE(16) !== 0x4e4f534a) throw new Error("first GLB chunk is not JSON");
	return JSON.parse(buffer.subarray(20, 20 + length).toString("utf8"));
}

const json = readGlbJson(readFileSync(GLB));
const byName = new Map(json.nodes.map((n) => [n.name, n]));
const path = json.nodes
	.filter((n) => /^path_\d+$/.test(n.name ?? ""))
	.sort((a, b) => Number(a.name?.slice(5)) - Number(b.name?.slice(5)))
	.map((n) => n.translation ?? ([0, 0, 0] as [number, number, number]));

describe("poolrooms.glb", () => {
	it("stays within budget", () => {
		expect(statSync(GLB).size).toBeLessThanOrEqual(MAX_BYTES);
	});

	it("carries a contiguous camera path", () => {
		expect(path.length).toBeGreaterThanOrEqual(8);
		path.forEach((_, i) => {
			expect(byName.has(`path_${String(i).padStart(2, "0")}`)).toBe(true);
		});
	});

	it("anchors match anchors.json", () => {
		for (const key of ["pool", "depths"] as const) {
			const node = byName.get(`anchor_${key}`);
			expect(node, `anchor_${key}`).toBeDefined();
			expect(polylineU(path, node?.translation ?? [0, 0, 0])).toBeCloseTo(anchors[key], 3);
		}
	});

	it("uses the named materials and exports no cutters", () => {
		const materials = new Set(json.materials?.map((m) => m.name));
		for (const name of ["Tile", "Water", "Void", "Sky", "Metal"])
			expect(materials.has(name)).toBe(true);
		expect(json.nodes.some((n) => /^(SideCut|SkyCut)/.test(n.name ?? ""))).toBe(false);
	});
});
