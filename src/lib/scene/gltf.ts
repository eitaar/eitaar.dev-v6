export type Vec3 = readonly [number, number, number];

const PATH_NODE = /^path_(\d+)$/;

/** Camera path from the exported `path_NN` empties, in numeric order. */
export function pathFromNodes(nodes: readonly { name: string; position: Vec3 }[]): Vec3[] {
	const points = nodes
		.flatMap((n) => {
			const match = PATH_NODE.exec(n.name);
			return match ? [{ index: Number(match[1]), position: n.position }] : [];
		})
		.sort((a, b) => a.index - b.index)
		.map((p) => p.position);
	if (points.length < 2) {
		throw new Error(
			`scene: the camera path needs at least 2 path_NN nodes, found ${points.length}`,
		);
	}
	return points;
}
