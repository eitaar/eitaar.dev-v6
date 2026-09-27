"""Export public/scene/poolrooms.glb from scene/poolrooms.blend. Run via: npm run scene:export"""

import json
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from lib import geo  # noqa: E402

PATH_SAMPLES = 24

with open(os.path.join(ROOT, "src", "lib", "scene", "anchors.json"), encoding="utf-8") as f:
    anchors = json.load(f)

path_obj = bpy.data.objects["CameraPath"]
depsgraph = bpy.context.evaluated_depsgraph_get()
evaluated = path_obj.evaluated_get(depsgraph)
mesh = evaluated.to_mesh()
points = [tuple(path_obj.matrix_world @ v.co) for v in mesh.vertices]
evaluated.to_mesh_clear()
samples = geo.resample_polyline(points, PATH_SAMPLES)

markers = []
for i, co in enumerate(samples):
    empty = bpy.data.objects.new(f"path_{i:02d}", None)
    empty.location = co
    markers.append(empty)
for key in ("pool", "depths"):
    empty = bpy.data.objects.new(f"anchor_{key}", None)
    empty.location = geo.point_at_u(samples, anchors[key])
    markers.append(empty)
for empty in markers:
    bpy.context.scene.collection.objects.link(empty)

out = os.path.join(ROOT, "public", "scene", "poolrooms.glb")
os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=out,
    export_format="GLB",
    use_renderable=True,
    export_apply=True,
    export_cameras=False,
    export_lights=False,
    export_extras=False,
    export_yup=True,
)
print(f"export: wrote {out} ({os.path.getsize(out) / 1024:.0f} KB)")
# The .blend is not saved, so the markers never persist.
