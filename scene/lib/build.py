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
OPEN_R = 0.9  # side-opening arch radius
OPEN_SPRING = 1.0  # keeps the arch top (1.9 m) below the passage spring
SKYLIGHTS = [26.0, 34.0]  # hall
PASSAGE_SKYLIGHTS = [3.0, 9.0, 15.0, 43.0, 49.0]  # none in the Depths, so the light fails there
SKY_HALF = 0.8  # half length of a skylight gap along Y
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
    bsdf.inputs["Emission Strength"].default_value = 20.0

    metal, bsdf = _material("Metal")
    bsdf.inputs["Base Color"].default_value = (0.52, 0.6, 0.68, 1.0)
    bsdf.inputs["Metallic"].default_value = 1.0
    bsdf.inputs["Roughness"].default_value = 0.3

    return {"Tile": tile, "Water": water, "Void": void, "Sky": sky, "Metal": metal}


def _spans(y0, y1, gaps):
    """Split [y0, y1] around the (start, end) gaps."""
    out, cursor = [], y0
    for a, b in sorted(gaps):
        if a > cursor:
            out.append((cursor, a))
        cursor = max(cursor, b)
    if cursor < y1:
        out.append((cursor, y1))
    return out


def _left_wall(bm, uv, x, y0, y1, spring, openings):
    """Flat left wall (x = -radius) with arched side openings cut into it. u = height above the floor."""

    def quad(pts):
        verts = [bm.verts.new((x, y, z)) for y, z in pts]
        _face(bm, uv, verts, [((z - FLOOR) / TEX, y / TEX) for y, z in pts])

    arch = geo.u_profile(OPEN_R, OPEN_SPRING, FLOOR, 16)[1:-1]
    for a, b in _spans(y0, y1, [(y - OPEN_R, y + OPEN_R) for y in openings]):
        quad([(a, FLOOR), (a, spring), (b, spring), (b, FLOOR)])
    for yc in openings:
        for (pa, za), (pb, zb) in zip(arch, arch[1:]):
            quad([(yc + pa, za), (yc + pb, zb), (yc + pb, spring), (yc + pa, spring)])


def build_section(name, y0, y1, radius, material, spring=SPRING, left_openings=(), crown_gaps=()):
    """Vaulted passage: U surface extruded along +Y plus the submerged floor. UVs in TEX units.
    `left_openings` are Y centres of arched side openings in the left wall; `crown_gaps` are
    (start, end) Y ranges left open at the top of the vault for skylights."""
    bm, uv = _new_bm()
    prof = geo.u_profile(radius, spring, FLOOR, SEG)
    lens = geo.arc_lengths(prof)
    mid = len(prof) // 2
    crown_faces = range(mid - 2, mid + 2)
    for i in range(len(prof) - 1):
        if i == 0 and left_openings:
            _left_wall(bm, uv, -radius, y0, y1, spring, left_openings)
            continue
        (xa, za), (xb, zb) = prof[i], prof[i + 1]
        spans = _spans(y0, y1, crown_gaps) if i in crown_faces else [(y0, y1)]
        for ya, yb in spans:
            verts = [bm.verts.new((xa, ya, za)), bm.verts.new((xb, ya, zb)),
                     bm.verts.new((xb, yb, zb)), bm.verts.new((xa, yb, za))]
            _face(bm, uv, verts, [(lens[i] / TEX, ya / TEX), (lens[i + 1] / TEX, ya / TEX),
                                  (lens[i + 1] / TEX, yb / TEX), (lens[i] / TEX, yb / TEX)])
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


def build_side_stub(index, y, radius, mats):
    """Dark tunnel behind a side opening, leading off to -X."""
    stub = build_section(f"SideStub{index}", 0.0, 3.0, OPEN_R, mats["Void"], spring=OPEN_SPRING)
    end = build_cap(f"SideStubEnd{index}", 3.0, OPEN_R, mats["Void"], spring=OPEN_SPRING)
    for obj in (stub, end):
        obj.rotation_euler = (0.0, 0.0, math.radians(90))  # local +Y becomes world -X
        obj.location = (-radius, y, 0.0)


def build_skylight(index, y, radius, mats):
    """Glowing panel above a crown gap in a vault."""
    bm, uv = _new_bm()
    z = SPRING + radius + 0.4
    half_x = radius * 0.32
    verts = [bm.verts.new((-half_x, y - SKY_HALF - 0.2, z)), bm.verts.new((half_x, y - SKY_HALF - 0.2, z)),
             bm.verts.new((half_x, y + SKY_HALF + 0.2, z)), bm.verts.new((-half_x, y + SKY_HALF + 0.2, z))]
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
        openings = [y for y in SIDE_OPENINGS if y0 < y < y1] if radius == PASSAGE_R else []
        lights = SKYLIGHTS if name == "Hall" else PASSAGE_SKYLIGHTS
        gaps = [(y - SKY_HALF, y + SKY_HALF) for y in lights if y0 < y < y1]
        obj = build_section(name, y0, y1, radius, mats["Tile"], left_openings=openings, crown_gaps=gaps)
        sections.append((obj, y0, y1, radius))
        for i, y in enumerate(openings):
            build_side_stub(SIDE_OPENINGS.index(y), y, radius, mats)
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

    skylights = [(y, HALL_R) for y in SKYLIGHTS] + [(y, PASSAGE_R) for y in PASSAGE_SKYLIGHTS]
    for i, (y, radius) in enumerate(skylights):
        build_skylight(i, y, radius, mats)
    for i, (radius, y) in enumerate(LADDERS):
        build_ladder(i, radius, y, mats["Metal"])

    build_camera_path()
    build_lighting_and_render()
