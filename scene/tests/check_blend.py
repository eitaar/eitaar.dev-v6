"""Structural checks for scene/poolrooms.blend. Runs inside Blender (npm run scene:test)."""

import sys

import bpy
from mathutils.bvhtree import BVHTree

errors = []


def need(condition, message):
    if not condition:
        errors.append(message)


names = set(bpy.data.objects.keys())
for name in [
    "PassageA", "Hall", "PassageB", "EntranceWall", "HallEntry", "HallExit",
    "FarWall", "FarDoorway", "WaterPassageA", "WaterHall", "WaterPassageB",
    "CameraPath", "Sun", "RenderEntrance", "RenderHall",
]:
    need(name in names, f"missing object {name}")

for prefix, count in [("SideStub", 5), ("SkyLight", 2), ("Ladder", 3), ("Rib", 10)]:
    found = [n for n in names if n.startswith(prefix) and not n.startswith("SideStubEnd")]
    need(len(found) >= count, f"expected at least {count} {prefix}* objects, found {len(found)}")

for material in ["Tile", "Water", "Void", "Sky", "Metal"]:
    need(material in bpy.data.materials, f"missing material {material}")

path = bpy.data.objects.get("CameraPath")
need(path is not None and path.type == "CURVE", "CameraPath must be a curve")
if path is not None and path.type == "CURVE":
    points = path.data.splines[0].bezier_points
    need(len(points) >= 5, "CameraPath needs at least 5 points")
    need(all(abs(p.co.z - 1.0) < 1e-6 for p in points), "CameraPath must sit 1.0 m above the water")

image = bpy.data.images.get("tile")
need(image is not None and image.packed_file is not None, "tile image must be packed into the .blend")

need(not any(m.type == "BOOLEAN" for o in bpy.data.objects for m in getattr(o, "modifiers", [])),
     "no boolean modifiers: openings are generated directly")

depsgraph = bpy.context.evaluated_depsgraph_get()


def hits(object_name, origin, direction, distance):
    obj = bpy.data.objects.get(object_name)
    if obj is None:
        return False
    tree = BVHTree.FromObject(obj, depsgraph)
    location, *_ = tree.ray_cast(origin, direction, distance)
    return location is not None


for y in (9.0, 15.0):
    need(not hits("PassageA", (-3.0, y, 0.3), (1.0, 0.0, 0.0), 1.5), f"PassageA left wall is closed at the side opening y={y}")
for y in (50.0, 62.0, 74.0):
    need(not hits("PassageB", (-3.0, y, 0.3), (1.0, 0.0, 0.0), 1.5), f"PassageB left wall is closed at the side opening y={y}")
for y in (26.0, 34.0):
    need(not hits("Hall", (0.0, y, 7.0), (0.0, 0.0, -1.0), 1.5), f"Hall vault is closed under the skylight y={y}")
need(hits("PassageA", (-3.0, 4.0, 0.3), (1.0, 0.0, 0.0), 1.5), "PassageA left wall is missing away from openings")

if errors:
    print("check_blend: FAILED\n  " + "\n  ".join(errors))
    sys.exit(1)
print("check_blend: ok")
