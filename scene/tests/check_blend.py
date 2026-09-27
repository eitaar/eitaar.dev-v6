"""Structural checks for scene/poolrooms.blend. Runs inside Blender (npm run scene:test)."""

import sys

import bpy

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

for prefix, count in [("SideCut", 5), ("SideStub", 5), ("SkyCut", 2), ("SkyLight", 2), ("Ladder", 3), ("Rib", 10)]:
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

for cutter in [o for o in bpy.data.objects if o.name.startswith(("SideCut", "SkyCut"))]:
    need(cutter.hide_render, f"{cutter.name} must be hidden from render/export")

if errors:
    print("check_blend: FAILED\n  " + "\n  ".join(errors))
    sys.exit(1)
print("check_blend: ok")
