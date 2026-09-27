# 3D is a fixed WebGL background; all content is DOM

The homepage's poolrooms scene renders on a single fixed Three.js canvas behind the page, driven by scroll position (via GSAP) and a small amount of pointer look; every piece of readable content — headings, text, links — stays in ordinary scrolling DOM. We chose this over a fully 3D site (text drawn in-scene, camera-as-navigation) because the site's readers are developers who come to read Writeups and Posts, and DOM content keeps text selectable, indexable and accessible while the scene supplies atmosphere.

## Consequences

- On mobile/coarse pointers, small viewports, no WebGL, or `prefers-reduced-motion`, no canvas is created; a static render of the same scene is used as the background instead.
- The scene is loosely coupled to page sections: the camera moves forward along one path with only a few anchor points, so layout changes in the DOM don't require re-tuning the camera.

## Considered Options

- **TresJS / Threlte / React Three Fiber**: rejected. There is one scene and one camera path, so a declarative component tree adds a framework dependency without paying for itself; plain Three.js plus the GSAP already in use is lighter and gives full control.
