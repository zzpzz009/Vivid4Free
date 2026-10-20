"""Build a physically independent embedded Python from a compatible local runtime.

Copy only the requested installed distribution closure, never symlink site-packages.
Run with the source embedded Python so wheel/ABI and marker evaluation agree.
"""
import argparse
import hashlib
import importlib.metadata as metadata
import json
from pathlib import Path
import shutil
import sys

from packaging.requirements import Requirement

ROOT = Path(__file__).resolve().parents[1]


def build(source, requirements):
    target = ROOT / 'runtime/python'
    target.mkdir(parents=True, exist_ok=True)
    for path in source.iterdir():
        if path.is_file() and path.suffix != '._pth':
            shutil.copy2(path, target / path.name)
    # No source-runtime path or user site is retained.
    (target / 'python312._pth').write_text(
        'python312.zip\n.\nLib\nLib/site-packages\n../comfyui\nimport site\n', encoding='utf8')
    queue = [Requirement(line.strip()) for line in requirements.read_text().splitlines()
             if line.strip() and not line.lstrip().startswith('#')]
    copied, missing = {}, []
    while queue:
        req = queue.pop(0)
        if req.marker and not req.marker.evaluate({'extra': ''}):
            continue
        key = req.name.lower().replace('_', '-')
        if key in copied:
            continue
        try:
            dist = metadata.distribution(req.name)
        except metadata.PackageNotFoundError:
            missing.append(str(req))
            continue
        if req.specifier and not req.specifier.contains(dist.version):
            missing.append(str(req))
            continue
        records = []
        for relative in dist.files or []:
            src = Path(dist.locate_file(relative)).resolve()
            # Wheel console launchers outside site-packages are unnecessary.
            try:
                rel = src.relative_to(source.resolve())
            except ValueError:
                continue
            if not src.is_file() or src.suffix == '.pyc':
                continue
            dst = target / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            if not dst.exists() or dst.stat().st_size != src.stat().st_size:
                shutil.copy2(src, dst)
            records.append(str(rel).replace('\\', '/'))
        copied[key] = {'version': dist.version, 'files': len(records)}
        for dep in dist.requires or []:
            parsed = Requirement(dep)
            if not parsed.marker or parsed.marker.evaluate({'extra': ''}):
                queue.append(parsed)
        print(f'{req.name}=={dist.version} ({len(records)} files)', flush=True)
    report = {'python': sys.version, 'source': str(source), 'storage': 'independent_copy',
              'distributions': copied, 'missing': sorted(set(missing))}
    (ROOT / 'runtime/python-bootstrap.json').write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding='utf8')
    print('Missing distributions:', report['missing'], flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--requirements', type=Path, required=True)
    args = parser.parse_args()
    if Path(sys.executable).resolve().parent != args.source.resolve():
        parser.error('Run with the specified source Python interpreter')
    build(args.source, args.requirements)
