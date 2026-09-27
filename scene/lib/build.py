"""Builds the Poolrooms scene with bpy. Runs inside Blender only."""

import math

import bmesh
import bpy
from mathutils import Vector

from . import geo

PASSAGE_R = 2.0
HALL_R = 4.0
SPRING = 2.0
FLOOR = -0.35
SEG = 24
RIB_T = 0.5
RIB_INSET = 0.3
TEX = geo.TEX_UNIT
CAMERA_Z = 1.0
FAR_WALL_Y = 92.0

SECTIONS = [("PassageA", 0.0, 20.0, PASSAGE_R), ("Hall", 20.0, 40.0, HALL_R), ("PassageB", 40.0, 92.0, PASSAGE_R)]
SIDE_OPENINGS = [9.0, 15.0, 50.0, 62.0, 74.0]
SKYLIGHTS = [26.0, 34.0]
LADDERS = [(PASSAGE_R, 11.0), (HALL_R, 30.0), (PASSAGE_R, 56.0)]
CAMERA_PATH = [(0.0, 1.0), (0.3, 14.0), (-0.4, 30.0), (0.2, 46.0), (-0.2, 62.0), (0.0, 78.0)]


# --- helpers -----------------------------------------------------------------

def _link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def _mesh_object(name, bm, material):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(material)
    return _link(bpy.data.objects.new(name, mesh))


def _face(bm, uv, verts, uvs):
    face = bm.faces.new(verts)
    for loop, coord in zip(face.loops, uvs):
        loop[uv].uv = coord
    return face


def _new_bm():
    bm = bmesh.new()
    return bm, bm.loops.layers.uv.new("UVMap")


def _material(name):
    mat = bpy.data.materials.new(name)
    try:
        mat.use_nodes = True
    except AttributeError:
        pass
    return mat, mat.node_tree.nodes["Principled BSDF"]


# --- scene -------------------------------------------------------------------

def clear():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.images,
                       bpy.data.lights, bpy.data.cameras):
        for block in list(datablocks):
            datablocks.remove(block)


def set_tile_variant(variant):
    image = bpy.data.images.get("tile") or bpy.data.images.new("tile", 512, 512, alpha=False)
    image.file_format = "PNG"
    image.pixels.foreach_set(geo.tile_pixels(variant))
    image.pack()
    return image


def make_materials(variant):
    image = set_tile_variant(variant)

    tile, bsdf = _material("Tile")
    tex = tile.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = image
    tile.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.18
    tile.use_backface_culling = False

    water, bsdf = _material("Water")
    bsdf.inputs["Base Color"].default_value = (0.32, 0.72, 0.70, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.04
    bsdf.inputs["Alpha"].default_value = 0.5
    try:
        water.surface_render_method = "BLENDED"
    except AttributeError:
        pass

    void, bsdf = _material("Void")
    bsdf.inputs["Base Color"].default_value = (0.008, 0.009, 0.01, 1.0)
    bsdf.inputs["Roughness"].default_value = 1.0
    void.use_backface_culling = False

    sky, bsdf = _material("Sky")
    bsdf.inputs["Base Color"].default_value = (0.0, 0.0, 0.0, 1.0)
    bsdf.inputs["Emission Color"].default_value = (1.0, 0.97, 0.92, 1.0)
    bsdf.inputs["Emission Strength"].default_value = 6.0

    metal, bsdf = _material("Metal")
    bsdf.inputs["Base Color"].default_value = (0.52, 0.6, 0.68, 1.0)
    bsdf.inputs["Metallic"].default_value = 1.0
    bsdf.inputs["Roughness"].default_value = 0.3

    return {"Tile": tile, "Water": water, "Void": void, "Sky": sky, "Metal": metal}


def build_section(name, y0, y1, radius, material, spring=SPRING):
    """Vaulted passage: U surface extruded along +Y plus the submerged floor. UVs in TEX units."""
    bm, uv = _new_bm()
    prof = geo.u_profile(radius, spring, FLOOR, SEG)
    lens = geo.arc_lengths(prof)
    for i in range(len(prof) - 1):
        (xa, za), (xb, zb) = prof[i], prof[i + 1]
        verts = [bm.verts.new((xa, y0, za)), bm.verts.new((xb, y0, zb)),
                 bm.verts.new((xb, y1, zb)), bm.verts.new((xa, y1, za))]
        _face(bm, uv, verts, [(lens[i] / TEX, y0 / TEX), (lens[i + 1] / TEX, y0 / TEX),
                              (lens[i + 1] / TEX, y1 / TEX), (lens[i] / TEX, y1 / TEX)])
    floor = [bm.verts.new((-radius, y0, FLOOR)), bm.verts.new((-radius, y1, FLOOR)),
             bm.verts.new((radius, y1, FLOOR)), bm.verts.new((radius, y0, FLOOR))]
    _face(bm, uv, floor, [(-radius / TEX, y0 / TEX), (-radius / TEX, y1 / TEX),
                          (radius / TEX, y1 / TEX), (radius / TEX, y0 / TEX)])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    return _mesh_object(name, bm, material)


def build_wall(name, y, thickness, outer_r, inner_r, material, inner_spring=SPRING):
    """Arch frame across the passage: faces between the outer and inner U on both planes, plus the soffit."""
    bm, uv = _new_bm()
    outer = geo.u_profile(outer_r, SPRING, FLOOR, SEG)
    inner = geo.u_profile(inner_r, inner_spring, FLOOR, SEG)
    ya, yb = y - thickness / 2, y + thickness / 2
    for yy in (ya, yb):
        for i in range(len(outer) - 1):
            pts = [outer[i], outer[i + 1], inner[i + 1], inner[i]]
            verts = [bm.verts.new((x, yy, z)) for x, z in pts]
            _face(bm, uv, verts, [(x / TEX, z / TEX) for x, z in pts])
    lens = geo.arc_lengths(inner)
    for i in range(len(inner) - 1):
        (xa, za), (xb, zb) = inner[i], inner[i + 1]
        verts = [bm.verts.new((xa, ya, za)), bm.verts.new((xb, ya, zb)),
                 bm.verts.new((xb, yb, zb)), bm.verts.new((xa, yb, za))]
        _face(bm, uv, verts, [(lens[i] / TEX, ya / TEX), (lens[i + 1] / TEX, ya / TEX),
                              (lens[i + 1] / TEX, yb / TEX), (lens[i] / TEX, yb / TEX)])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    return _mesh_object(name, bm, material)


def build_cap(name, y, radius, material, spring=SPRING):
    """Closed end wall: one n-gon over the U profile (the floor edge closes it)."""
    bm, uv = _new_bm()
    prof = geo.u_profile(radius, spring, FLOOR, SEG)
    verts = [bm.verts.new((x, y, z)) for x, z in prof]
    _face(bm, uv, verts, [(x / TEX, z / TEX) for x, z in prof])
    return _mesh_object(name, bm, material)


def build_water(name, y0, y1, radius, material):
    bm, uv = _new_bm()
    verts = [bm.verts.new((-radius, y0, 0.0)), bm.verts.new((radius, y0, 0.0)),
             bm.verts.new((radius, y1, 0.0)), bm.verts.new((-radius, y1, 0.0))]
    _face(bm, uv, verts, [(-radius / TEX, y0 / TEX), (radius / TEX, y0 / TEX),
                          (radius / TEX, y1 / TEX), (-radius / TEX, y1 / TEX)])
    return _mesh_object(name, bm, material)


def _prism_x(name, y, profile, x0, x1, material):
    """Closed prism along X whose cross-section (in the YZ plane) is `profile` offset to y."""
    bm, uv = _new_bm()
    ring0 = [bm.verts.new((x0, y + px, z)) for px, z in profile]
    ring1 = [bm.verts.new((x1, y + px, z)) for px, z in profile]
    n = len(profile)
    for i in range(n):
        j = (i + 1) % n
        _face(bm, uv, [ring0[i], ring0[j], ring1[j], ring1[i]],
              [((y + profile[i][0]) / TEX, profile[i][1] / TEX), ((y + profile[j][0]) / TEX, profile[j][1] / TEX),
               ((y + profile[j][0]) / TEX, profile[j][1] / TEX + 1), ((y + profile[i][0]) / TEX, profile[i][1] / TEX + 1)])
    _face(bm, uv, list(reversed(ring0)), [((y + px) / TEX, z / TEX) for px, z in reversed(profile)])
    _face(bm, uv, ring1, [((y + px) / TEX, z / TEX) for px, z in profile])
    return _mesh_object(name, bm, material)


def _boolean(target, cutter):
    mod = target.modifiers.new(f"Cut{cutter.name}", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = cutter
    mod.solver = "EXACT"
    mod.use_hole_tolerant = True
    mod.material_mode = "TRANSFER"
    cutter.hide_render = True
    cutter.display_type = "WIRE"


def _section_at(sections, y):
    obj, _, _, radius = next(s for s in sections if s[1] < y < s[2])
    return obj, radius


def build_side_opening(index, y, sections, mats):
    target, radius = _section_at(sections, y)
    profile = geo.u_profile(1.1, 1.4, FLOOR + 0.02, 16)
    cutter = _prism_x(f"SideCut{index}", y, profile, -radius - 0.6, -radius + 0.6, mats["Tile"])
    _boolean(target, cutter)
    stub = build_section(f"SideStub{index}", 0.0, 3.0, 1.1, mats["Void"], spring=1.4)
    end = build_cap(f"SideStubEnd{index}", 3.0, 1.1, mats["Void"], spring=1.4)
    for obj in (stub, end):
        obj.rotation_euler = (0.0, 0.0, math.radians(90))  # local +Y becomes world -X
        obj.location = (-radius, y, 0.0)


def build_skylight(index, y, hall, mats):
    crown = SPRING + HALL_R
    bm, uv = _new_bm()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * 1.6, y + v.co.y * 1.6, crown + v.co.z * 2.0))
    cutter = _mesh_object(f"SkyCut{index}", bm, mats["Tile"])
    _boolean(hall, cutter)
    bm, uv = _new_bm()
    z = crown + 0.4
    verts = [bm.verts.new((-0.8, y - 0.8, z)), bm.verts.new((0.8, y - 0.8, z)),
             bm.verts.new((0.8, y + 0.8, z)), bm.verts.new((-0.8, y + 0.8, z))]
    _face(bm, uv, verts, [(0, 0), (1, 0), (1, 1), (0, 1)])
    _mesh_object(f"SkyLight{index}", bm, mats["Sky"])


def build_ladder(index, wall_x, y, material):
    x = wall_x - 0.12
    pts = [(x, y - 0.25, -0.3), (x, y - 0.25, 1.05)]
    pts += [(x, y - 0.25 * math.cos(a), 1.05 + 0.25 * math.sin(a)) for a in (math.pi * i / 8 for i in range(1, 8))]
    pts += [(x, y + 0.25, 1.05), (x, y + 0.25, -0.3)]
    curve = bpy.data.curves.new(f"Ladder{index}Curve", "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = 0.022
    curve.bevel_resolution = 4
    spline = curve.splines.new("POLY")
    spline.points.add(len(pts) - 1)
    for point, co in zip(spline.points, pts):
        point.co = (*co, 1.0)
    curve_obj = _link(bpy.data.objects.new(f"Ladder{index}Curve", curve))
    depsgraph = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(curve_obj.evaluated_get(depsgraph))
    mesh.materials.clear()
    mesh.materials.append(material)
    _link(bpy.data.objects.new(f"Ladder{index}", mesh))
    bpy.data.objects.remove(curve_obj, do_unlink=True)
    bpy.data.curves.remove(curve)


def build_camera_path():
    curve = bpy.data.curves.new("CameraPath", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 24
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(CAMERA_PATH) - 1)
    for point, (x, y) in zip(spline.bezier_points, CAMERA_PATH):
        point.co = (x, y, CAMERA_Z)
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    return _link(bpy.data.objects.new("CameraPath", curve))


def _camera(name, location, target):
    data = bpy.data.cameras.new(name)
    data.lens = 20
    obj = _link(bpy.data.objects.new(name, data))
    obj.location = location
    obj.rotation_euler = (Vector(target) - Vector(location)).to_track_quat("-Z", "Y").to_euler()
    return obj


def build_lighting_and_render():
    sun_data = bpy.data.lights.new("Sun", "SUN")
    sun_data.energy = 4.0
    sun_data.angle = math.radians(6)
    sun = _link(bpy.data.objects.new("Sun", sun_data))
    sun.rotation_euler = (math.radians(18), math.radians(-22), 0.0)

    scene = bpy.context.scene
    world = scene.world or bpy.data.worlds.new("World")
    scene.world = world
    try:
        world.use_nodes = True
    except AttributeError:
        pass
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.78, 0.84, 0.86, 1.0)
    background.inputs["Strength"].default_value = 0.35

    _camera("RenderEntrance", (0.0, 1.0, CAMERA_Z), (0.0, 30.0, 1.4))
    _camera("RenderHall", (-2.5, 23.0, 1.2), (1.5, 36.0, 2.2))
    scene.camera = bpy.data.objects["RenderEntrance"]
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 800
    scene.view_settings.view_transform = "AgX"


def build_scene(variant="classic"):
    clear()
    mats = make_materials(variant)
    sections = []
    for name, y0, y1, radius in SECTIONS:
        sections.append((build_section(name, y0, y1, radius, mats["Tile"]), y0, y1, radius))
        build_water(f"Water{name}", y0, y1, radius, mats["Water"])
        if radius == PASSAGE_R:
            for i, y in enumerate(geo.module_positions(y0, y1, 6.0)):
                build_wall(f"Rib{name}{i}", y, RIB_T, radius, radius - RIB_INSET, mats["Tile"])

    build_cap("EntranceWall", 0.0, PASSAGE_R, mats["Tile"])
    build_wall("HallEntry", 20.0, 0.6, HALL_R, PASSAGE_R, mats["Tile"])
    build_wall("HallExit", 40.0, 0.6, HALL_R, PASSAGE_R, mats["Tile"])
    build_wall("FarWall", FAR_WALL_Y, 0.4, PASSAGE_R, 0.9, mats["Tile"], inner_spring=1.3)
    build_section("FarDoorway", FAR_WALL_Y + 0.2, FAR_WALL_Y + 4.0, 0.9, mats["Void"], spring=1.3)
    build_cap("FarDoorwayEnd", FAR_WALL_Y + 4.0, 0.9, mats["Void"], spring=1.3)

    for i, y in enumerate(SIDE_OPENINGS):
        build_side_opening(i, y, sections, mats)
    hall = next(obj for obj, _, _, _ in sections if obj.name == "Hall")
    for i, y in enumerate(SKYLIGHTS):
        build_skylight(i, y, hall, mats)
    for i, (radius, y) in enumerate(LADDERS):
        build_ladder(i, radius, y, mats["Metal"])

    build_camera_path()
    build_lighting_and_render()
