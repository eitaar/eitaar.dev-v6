import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { buildScrollAnchors, isAnchorName, type ScrollAnchor, scrollToU } from "./path";

gsap.registerPlugin(ScrollTrigger);

/** One ScrollTrigger for the whole page. Layout is read only on refresh (load/resize). */
export function trackScrollU(onU: (u: number) => void): () => void {
	let anchors: ScrollAnchor[] = [];

	const measure = () => {
		const scrollY = window.scrollY;
		const sections = [...document.querySelectorAll<HTMLElement>("[data-anchor]")].flatMap((el) => {
			const name = el.dataset.anchor;
			if (!isAnchorName(name)) return [];
			const top = el.getBoundingClientRect().top + scrollY - window.innerHeight * 0.5;
			return [{ name, top }];
		});
		anchors = buildScrollAnchors(sections, ScrollTrigger.maxScroll(window));
	};

	const trigger = ScrollTrigger.create({
		start: 0,
		end: "max",
		onUpdate: (self) => onU(scrollToU(self.scroll(), anchors)),
		onRefresh: (self) => {
			measure();
			onU(scrollToU(self.scroll(), anchors));
		},
	});

	measure();
	onU(scrollToU(trigger.scroll(), anchors));

	return () => trigger.kill();
}
