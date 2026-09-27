export type AnchorName = "entrance" | "pool" | "turn";

export const ANCHOR_U: Record<AnchorName, number> = {
	entrance: 0,
	pool: 0.3,
	turn: 0.72,
};

export function isAnchorName(value: string | undefined): value is AnchorName {
	return value !== undefined && Object.hasOwn(ANCHOR_U, value);
}

export interface ScrollAnchor {
	scroll: number;
	u: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function buildScrollAnchors(
	sections: { name: AnchorName; top: number }[],
	maxScroll: number,
): ScrollAnchor[] {
	const points: ScrollAnchor[] = [{ scroll: 0, u: 0 }];
	for (const section of sections) {
		if (section.name === "entrance") continue;
		points.push({ scroll: clamp(section.top, 0, maxScroll), u: ANCHOR_U[section.name] });
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

export const ALLEY_START = 0.72;
export const ALLEY_END = 0.9;

export function alleyFactor(u: number): number {
	const x = clamp((u - ALLEY_START) / (ALLEY_END - ALLEY_START), 0, 1);
	return x * x * (3 - 2 * x);
}

export type Zone = "pool" | "alley";

const ZONE_ENTER = 0.55;
const ZONE_LEAVE = 0.45;

export function nextZone(current: Zone, factor: number): Zone {
	if (current === "pool" && factor >= ZONE_ENTER) return "alley";
	if (current === "alley" && factor <= ZONE_LEAVE) return "pool";
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

/** Camera path: down the Poolrooms hall (−z), then a turn into the Alley (+x). */
export const PATH_POINTS: readonly [number, number, number][] = [
	[0, 1.6, 0],
	[0, 1.6, -20],
	[0, 1.6, -38],
	[1, 1.6, -46],
	[6, 1.6, -48],
	[18, 1.6, -48],
];
