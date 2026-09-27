import anchors from "./anchors.json";

export type AnchorName = "entrance" | "pool" | "depths";

export const ANCHOR_U: Record<AnchorName, number> = {
	entrance: 0,
	pool: anchors.pool,
	depths: anchors.depths,
};

export function isAnchorName(value: string | undefined): value is AnchorName {
	return value !== undefined && Object.hasOwn(ANCHOR_U, value);
}

export interface ScrollAnchor {
	scroll: number;
	u: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Scroll offset at which an Anchor's section fires: pool at mid-viewport, depths as it enters. */
export function anchorTop(name: AnchorName, elementTop: number, viewportHeight: number): number {
	return name === "depths" ? elementTop - viewportHeight : elementTop - viewportHeight * 0.5;
}

/**
 * `minDepthsScroll` reserves scroll distance after the depths Anchor so the walk into the Depths
 * is never squeezed into the last few pixels of the page.
 */
export function buildScrollAnchors(
	sections: { name: AnchorName; top: number }[],
	maxScroll: number,
	minDepthsScroll = 0,
): ScrollAnchor[] {
	const points: ScrollAnchor[] = [{ scroll: 0, u: 0 }];
	for (const section of sections) {
		if (section.name === "entrance") continue;
		const limit = section.name === "depths" ? Math.max(0, maxScroll - minDepthsScroll) : maxScroll;
		points.push({ scroll: clamp(section.top, 0, limit), u: ANCHOR_U[section.name] });
	}
	points.push({ scroll: maxScroll, u: 1 });
	points.sort((a, b) => a.u - b.u);

	const anchors: ScrollAnchor[] = [];
	for (const point of points) {
		const prev = anchors.at(-1);
		if (!prev || point.scroll > prev.scroll) anchors.push(point);
		else if (anchors.length > 1) anchors[anchors.length - 1] = point;
	}
	return anchors;
}

export function scrollToU(scroll: number, anchors: ScrollAnchor[]): number {
	const first = anchors[0];
	if (!first) return 0;
	if (scroll <= first.scroll) return first.u;
	for (let i = 1; i < anchors.length; i++) {
		const a = anchors[i - 1];
		const b = anchors[i];
		if (scroll <= b.scroll)
			return a.u + ((scroll - a.scroll) / (b.scroll - a.scroll)) * (b.u - a.u);
	}
	return anchors[anchors.length - 1].u;
}

export const DEPTHS_START = ANCHOR_U.depths;
export const DEPTHS_END = 1;

export function depthsFactor(u: number): number {
	const x = clamp((u - DEPTHS_START) / (DEPTHS_END - DEPTHS_START), 0, 1);
	return x * x * (3 - 2 * x);
}

const DEPTHS_MIN_EXPOSURE = 0.12;

/** Tone-mapping exposure for the Depths: dims as far as it can without going black. */
export function depthsExposure(factor: number): number {
	return 1 - (1 - DEPTHS_MIN_EXPOSURE) * clamp(factor, 0, 1);
}

export type Zone = "pool" | "depths";

const ZONE_ENTER = 0.55;
const ZONE_LEAVE = 0.45;

export function nextZone(current: Zone, factor: number): Zone {
	if (current === "pool" && factor >= ZONE_ENTER) return "depths";
	if (current === "depths" && factor <= ZONE_LEAVE) return "pool";
	return current;
}

const MAX_YAW = 0.12;
const MAX_PITCH = 0.06;

export function pointerLook(nx: number, ny: number): { yaw: number; pitch: number } {
	return {
		yaw: -clamp(nx, -1, 1) * MAX_YAW || 0,
		pitch: -clamp(ny, -1, 1) * MAX_PITCH || 0,
	};
}

export function damp(current: number, target: number, lambda: number, dt: number): number {
	return target + (current - target) * Math.exp(-lambda * dt);
}

type Vec3 = readonly [number, number, number];

/** Fraction (0..1) of the polyline's length at the point nearest to `target`. */
export function polylineU(points: readonly Vec3[], target: Vec3): number {
	let walked = 0;
	let best = { dist: Number.POSITIVE_INFINITY, at: 0 };
	for (let i = 1; i < points.length; i++) {
		const a = points[i - 1];
		const b = points[i];
		const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
		const len2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
		const len = Math.sqrt(len2);
		const t =
			len2 === 0
				? 0
				: clamp(
						((target[0] - a[0]) * ab[0] + (target[1] - a[1]) * ab[1] + (target[2] - a[2]) * ab[2]) /
							len2,
						0,
						1,
					);
		const p = [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t];
		const dist = Math.hypot(target[0] - p[0], target[1] - p[1], target[2] - p[2]);
		if (dist < best.dist) best = { dist, at: walked + len * t };
		walked += len;
	}
	return walked === 0 ? 0 : best.at / walked;
}
