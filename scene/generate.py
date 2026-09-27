"""Generate scene/poolrooms.blend. Run via: npm run scene:gen [-- --force] [-- <variant>]"""

import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from lib import build  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
variant = args[0] if args else "classic"

build.build_scene(variant)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "poolrooms.blend"))
print(f"generate: wrote scene/poolrooms.blend (tiles: {variant})")
