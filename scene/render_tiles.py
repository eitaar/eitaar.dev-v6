"""Render each tile variant from the two render cameras. Run via: npm run scene:tiles
The .blend is not saved, so the stored tile variant is unchanged."""

import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from lib import build, geo  # noqa: E402

out_dir = os.path.join(HERE, "renders")
os.makedirs(out_dir, exist_ok=True)
scene = bpy.context.scene

for variant in geo.VARIANTS:
    build.set_tile_variant(variant)
    for camera_name in ("RenderEntrance", "RenderHall"):
        scene.camera = bpy.data.objects[camera_name]
        view = camera_name.removeprefix("Render").lower()
        scene.render.filepath = os.path.join(out_dir, f"tiles-{variant}-{view}.png")
        bpy.ops.render.render(write_still=True)
        print(f"render_tiles: {variant} / {view}")
