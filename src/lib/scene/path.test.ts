import { describe, expect, it } from "vitest";
import anchors from "./anchors.json";
import {
	ANCHOR_U,
	anchorTop,
	buildScrollAnchors,
	DEPTHS_END,
	DEPTHS_START,
	damp,
	depthsExposure,
	depthsFactor,
	isAnchorName,
	nextZone,
	pointerLook,
	scrollToU,
} from "./path";

describe("isAnchorName", () => {
	it("accepts the three Anchors", () => {
		expect(["entrance", "pool", "depths"].every(isAnchorName)).toBe(true);
	});
	it("rejects typos and missing values", () => {
		expect(isAnchorName("pol")).toBe(false);
		expect(isAnchorName(undefined)).toBe(false);
	});
});

describe("buildScrollAnchors", () => {
	it("maps sections to their Anchor u between page top and bottom", () => {
		const anchors = buildScrollAnchors(
			[
				{ name: "entrance", top: 0 },
				{ name: "pool", top: 1000 },
				{ name: "depths", top: 3000 },
			],
			4000,
		);
		expect(anchors).toEqual([
			{ scroll: 0, u: 0 },
			{ scroll: 1000, u: ANCHOR_U.pool },
			{ scroll: 3000, u: ANCHOR_U.depths },
			{ scroll: 4000, u: 1 },
		]);
	});

	it("zero-height page: a single anchor at the start", () => {
		const anchors = buildScrollAnchors(
			[
				{ name: "pool", top: 0 },
				{ name: "depths", top: 0 },
			],
			0,
		);
		expect(anchors).toEqual([{ scroll: 0, u: 0 }]);
		expect(scrollToU(0, anchors)).toBe(0);
	});

	it("collapsed anchors: later Anchor wins, bottom still reaches u = 1", () => {
		const anchors = buildScrollAnchors(
			[
				{ name: "pool", top: 1000 },
				{ name: "depths", top: 5000 },
			],
			2000,
		);
		expect(anchors).toEqual([
			{ scroll: 0, u: 0 },
			{ scroll: 1000, u: ANCHOR_U.pool },
			{ scroll: 2000, u: 1 },
		]);
	});

	it("missing sections: falls back to a straight 0→1 mapping", () => {
		expect(buildScrollAnchors([], 500)).toEqual([
			{ scroll: 0, u: 0 },
			{ scroll: 500, u: 1 },
		]);
	});

	it("clamps negative tops to the page start", () => {
		const anchors = buildScrollAnchors([{ name: "pool", top: -200 }], 1000);
		expect(anchors[0]).toEqual({ scroll: 0, u: 0 });
		expect(anchors.every((a) => a.scroll >= 0)).toBe(true);
	});
});

describe("anchorTop", () => {
	it("pool triggers when its section reaches mid-viewport", () => {
		expect(anchorTop("pool", 2000, 1000)).toBe(1500);
	});
	it("turn triggers as its section enters from the bottom of the viewport", () => {
		expect(anchorTop("depths", 2000, 1000)).toBe(1000);
	});
});

describe("buildScrollAnchors: Depths room", () => {
	it("keeps at least minDepthsScroll between the turn and the page bottom", () => {
		// 1920x1080 case from review: turn measured at 2112, maxScroll 2138.
		const anchors = buildScrollAnchors(
			[
				{ name: "pool", top: 1000 },
				{ name: "depths", top: 2112 },
			],
			2138,
			540,
		);
		const turn = anchors.find((a) => a.u === ANCHOR_U.depths);
		expect(turn?.scroll).toBe(1598);
		expect(2138 - (turn?.scroll ?? 2138)).toBeGreaterThanOrEqual(540);
	});
	it("leaves a turn that already has room untouched", () => {
		const anchors = buildScrollAnchors([{ name: "depths", top: 1000 }], 4000, 540);
		expect(anchors.find((a) => a.u === ANCHOR_U.depths)?.scroll).toBe(1000);
	});
});

describe("scrollToU", () => {
	const anchors = [
		{ scroll: 0, u: 0 },
		{ scroll: 1000, u: 0.3 },
		{ scroll: 2000, u: 1 },
	];
	it("interpolates within a segment", () => {
		expect(scrollToU(500, anchors)).toBeCloseTo(0.15);
		expect(scrollToU(1500, anchors)).toBeCloseTo(0.65);
	});
	it("clamps outside the range", () => {
		expect(scrollToU(-50, anchors)).toBe(0);
		expect(scrollToU(99999, anchors)).toBe(1);
	});
	it("returns 0 with no anchors", () => {
		expect(scrollToU(100, [])).toBe(0);
	});
});

describe("depthsFactor", () => {
	it("is 0 in Poolrooms and 1 deep in the Depths", () => {
		expect(depthsFactor(0)).toBe(0);
		expect(depthsFactor(DEPTHS_START)).toBe(0);
		expect(depthsFactor(DEPTHS_END)).toBe(1);
		expect(depthsFactor(1)).toBe(1);
	});
	it("rises smoothly in between", () => {
		const mid = depthsFactor((DEPTHS_START + DEPTHS_END) / 2);
		expect(mid).toBeCloseTo(0.5);
	});
});

describe("nextZone", () => {
	it("enters the Depths once the factor passes the upper threshold", () => {
		expect(nextZone("pool", 0.54)).toBe("pool");
		expect(nextZone("pool", 0.55)).toBe("depths");
	});
	it("hysteresis: hovering around 0.5 does not flicker", () => {
		expect(nextZone("depths", 0.5)).toBe("depths");
		expect(nextZone("pool", 0.5)).toBe("pool");
	});
	it("returns to Poolrooms below the lower threshold", () => {
		expect(nextZone("depths", 0.45)).toBe("pool");
	});
});

describe("pointerLook", () => {
	it("is neutral at the centre", () => {
		expect(pointerLook(0, 0)).toEqual({ yaw: 0, pitch: 0 });
	});
	it("clamps input outside [-1, 1]", () => {
		expect(pointerLook(5, -5)).toEqual(pointerLook(1, -1));
	});
	it("looks toward the pointer (right → negative yaw, down → negative pitch)", () => {
		const { yaw, pitch } = pointerLook(1, 1);
		expect(yaw).toBeLessThan(0);
		expect(pitch).toBeLessThan(0);
	});
});

describe("damp", () => {
	it("moves toward the target without overshooting", () => {
		const next = damp(0, 1, 4, 1 / 60);
		expect(next).toBeGreaterThan(0);
		expect(next).toBeLessThan(1);
	});
	it("is frame-rate independent", () => {
		let a = 0;
		for (let i = 0; i < 2; i++) a = damp(a, 1, 4, 1 / 60);
		expect(a).toBeCloseTo(damp(0, 1, 4, 2 / 60));
	});
});

describe("ANCHOR_U from anchors.json", () => {
	it("reads pool and depths from the shared JSON", () => {
		expect(ANCHOR_U.pool).toBe(anchors.pool);
		expect(ANCHOR_U.depths).toBe(anchors.depths);
		expect(ANCHOR_U.entrance).toBe(0);
	});
});

describe("depthsFactor keeps darkening to the end of the page", () => {
	it("is still below 1 just before the end and reaches 1 at u = 1", () => {
		expect(depthsFactor(0.97)).toBeLessThan(1);
		expect(depthsFactor(1)).toBe(1);
	});
});

describe("depthsExposure", () => {
	it("is full exposure in Poolrooms and as dim as allowed at the far end", () => {
		expect(depthsExposure(0)).toBe(1);
		expect(depthsExposure(1)).toBeCloseTo(0.12);
	});
	it("never goes fully black", () => {
		expect(depthsExposure(1)).toBeGreaterThan(0);
	});
});
