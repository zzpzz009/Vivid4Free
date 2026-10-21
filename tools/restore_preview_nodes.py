"""Install original local plugin sources without reimplementing their node methods.

Only package registration/import closures are narrowed. Source definitions are
copied verbatim and recorded with hashes so the independent runtime is auditable.
The other ComfyUI installations are read-only inputs.
"""
import argparse
import ast
import hashlib
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def install(runtime, library, was_library):
    nodes = runtime / 'custom_nodes'
    provenance = {'source': str(library), 'wasSource': str(was_library), 'files': [], 'definitions': []}

    def copy(source, relative):
        target = nodes / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        provenance['files'].append({'source': str(source), 'path': relative,
                                    'sha256': digest(target)})

    def write(relative, text):
        target = nodes / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding='utf8')

    for path in (library / 'rgthree-comfy').rglob('*'):
        if path.is_file() and path.suffix == '.py' and '.git' not in path.parts:
            copy(path, 'rgthree-comfy/' + path.relative_to(library / 'rgthree-comfy').as_posix())
    for name in ('rgthree_config.json.default', 'LICENSE', 'pyproject.toml'):
        copy(library / 'rgthree-comfy' / name, 'rgthree-comfy/' + name)

    for name in ('nodes/switch.py', 'core/types.py', 'core/keys.py', 'core/config.py', 'core/logger.py'):
        copy(library / 'ComfyUI-Crystools' / name, 'ComfyUI-Crystools/' + name)
    write('ComfyUI-Crystools/core/__init__.py',
          'from .types import *\nfrom .keys import *\nfrom .config import *\nfrom .logger import *\n')
    write('ComfyUI-Crystools/nodes/__init__.py', '')
    write('ComfyUI-Crystools/__init__.py',
          'from .nodes.switch import CSwitchBooleanAny\n'
          'NODE_CLASS_MAPPINGS = {"Switch any [Crystools]": CSwitchBooleanAny}\n')
    for pack in ('ComfyUI-Crystools', 'TextConditional'):
        for name in ('LICENSE', 'LICENSE.txt', 'LICENSE.md'):
            if (library / pack / name).is_file():
                copy(library / pack / name, pack + '/' + name)
    copy(library / 'TextConditional/upscale_nodes.py', 'TextConditional/upscale_nodes.py')
    write('TextConditional/__init__.py',
          'from .upscale_nodes import ImageResizeToPixelCount\n'
          'NODE_CLASS_MAPPINGS = {"ImageResizeToPixelCount": ImageResizeToPixelCount}\n')

    # WAS's monolithic module imports unrelated legacy model loaders. Copy the
    # original class/helper definitions, retaining their complete method bodies.
    was = was_library / 'was-node-suite-comfyui/WAS_Node_Suite.py'
    source = was.read_text(encoding='utf-8-sig')
    tree = ast.parse(source)
    names = {'cstr', 'WASDatabase', 'TextTokens', 'update_history_output_images',
             'getSuiteConfig', 'WAS_Text_Concatenate', 'WAS_Image_Save'}
    definitions = [node for node in tree.body
                   if isinstance(node, (ast.ClassDef, ast.FunctionDef)) and node.name in names]
    if {node.name for node in definitions} != names:
        raise ValueError('Original WAS class/helper closure is incomplete')
    template = next(node for node in tree.body if isinstance(node, ast.Assign)
                    and any(isinstance(target, ast.Name) and target.id == 'was_conf_template'
                            for target in node.targets))
    header = source[:source.index('from PIL import')]
    imports = ('from PIL import Image\nfrom PIL.PngImagePlugin import PngInfo\n'
               'import numpy as np\nimport comfy.model_management\nimport folder_paths as comfy_paths\n'
               'import os, re, json, time, socket\n'
               'TEXT_TYPE = "STRING"\n'
               'WAS_SUITE_ROOT = os.path.dirname(__file__)\n'
               'WAS_DATABASE = os.path.join(os.path.dirname(__file__), "was_suite_settings.json")\n'
               'WAS_HISTORY_DATABASE = os.path.join(os.path.dirname(__file__), "was_history.json")\n'
               'WAS_CONFIG_FILE = os.path.join(os.path.dirname(__file__), "was_suite_config.json")\n'
               'ALLOWED_EXT = (".jpeg", ".jpg", ".png", ".tiff", ".gif", ".bmp", ".webp")\n')
    content = header + imports + ast.get_source_segment(source, template) + '\n\n'
    for node in definitions:
        segment = ast.get_source_segment(source, node)
        content += segment + '\n\n'
        provenance['definitions'].append({'name': node.name, 'source': str(was),
                                          'sourceSha256': digest(was),
                                          'definitionSha256': hashlib.sha256(segment.encode()).hexdigest()})
    content += ('cstr.color.add_code("msg", "WAS Node Suite: ")\n'
                'cstr.color.add_code("warning", "WAS Node Suite Warning: ")\n'
                'cstr.color.add_code("error", "WAS Node Suite Error: ")\n'
                'WDB = WASDatabase(WAS_DATABASE)\n')
    write('was-node-suite-comfyui/original_nodes.py', content)
    write('was-node-suite-comfyui/__init__.py',
          'from .original_nodes import WAS_Text_Concatenate, WAS_Image_Save\n'
          'NODE_CLASS_MAPPINGS = {"Text Concatenate": WAS_Text_Concatenate, "Image Save": WAS_Image_Save}\n')
    for name in ('LICENSE', 'LICENSE.txt', 'LICENSE.md'):
        if (was.parent / name).is_file():
            copy(was.parent / name, 'was-node-suite-comfyui/' + name)

    copy(ROOT / 'engine_nodes/vivid_nodes/__init__.py', 'vivid_nodes/__init__.py')
    # The original TextConditional package now owns this name, including upscale.
    write('vivid_upscale_adapters/__init__.py',
          'from .kontext_images import ImageResizer\nNODE_CLASS_MAPPINGS = {"ImageResizer": ImageResizer}\n')
    additions = ['rgthree-comfy', 'ComfyUI-Crystools', 'TextConditional', 'was-node-suite-comfyui']
    manifest_path = runtime / 'runtime.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf8'))
    manifest['customNodePacks'] = list(dict.fromkeys(manifest['customNodePacks'] + additions))
    manifest['localRevision'] = 'preview-fidelity-v1'
    provenance_path = runtime / 'preview-fidelity.json'
    provenance_path.write_text(json.dumps(provenance, ensure_ascii=False, indent=2), encoding='utf8')
    entries = {row['path']: row for row in manifest['files']}
    changed = [runtime / 'workflows/preview.json', runtime / 'workflows/preview-source.json', provenance_path]
    for pack in additions + ['vivid_nodes', 'vivid_upscale_adapters']:
        changed.extend(path for path in (nodes / pack).rglob('*')
                       if path.is_file() and '__pycache__' not in path.parts
                       and path.suffix not in ('.pyc', '.log')
                       and path.name not in ('was_history.json', 'was_suite_settings.json', 'rgthree_config.json'))
    for path in changed:
        relative = path.relative_to(runtime).as_posix()
        entries[relative] = {'path': relative, 'bytes': path.stat().st_size, 'sha256': digest(path)}
    manifest['files'] = sorted(entries.values(), key=lambda row: row['path'])
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf8')
    print(json.dumps({'runtime': str(runtime), 'localRevision': manifest['localRevision'],
                      'originalFiles': len(provenance['files']), 'originalDefinitions': len(definitions)}, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime', type=Path, required=True)
    parser.add_argument('--library', type=Path, required=True, help='Read-only original custom_nodes directory')
    parser.add_argument('--was-library', type=Path, required=True, help='Read-only custom_nodes containing WAS')
    args = parser.parse_args()
    install(args.runtime.resolve(), args.library.resolve(), args.was_library.resolve())
