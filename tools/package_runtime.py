"""Build the independent CF ZIP and its download manifest, never the client installer.

Release creation requires both workflow acceptance and their original assets.
Partial models, caches, process receipts, input/output and other node packs are
excluded. --check-only reports missing prerequisites without reading large weights.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys
from urllib.parse import urlsplit
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PACKAGE_ID = 'vivid-comfy'
PROTOCOL = 1
MODEL_FILES = (
    'diffusion_models/flux-2-klein-9b.safetensors',
    'text_encoders/qwen_3_8b_fp8mixed.safetensors',
    'vae/flux2-vae.safetensors',
    'loras/klein/vivid_klein_v1.4_000076275.safetensors',
    'loras/klein/realistic.safetensors',
    'LLM/Qwen3.5-9B-Q4_K_M.gguf',
    'LLM/mmproj-BF16.gguf',
    'upscale_models/2xNomosUni_span_multijpg_ldl.pth',
    'vae/ae.safetensors',
    'diffusion_models/flux.1-dev-SRPO-bf16.safetensors',
    'text_encoders/SD3/clip_l.safetensors',
    'text_encoders/SD3/t5xxl_fp16.safetensors',
    'SEEDVR2/ema_vae_fp16.safetensors',
    'SEEDVR2/seedvr2_ema_7b-Q8_K_M.gguf',
    'loras/FLUX/Flux Dev模型4步出图lora_Flux Dev模型4步出图lora_Flux Dev 4-step.safetensors',
)
# The audited final upscale graph may add packs/assets. A passing acceptance
# report is required in addition to this known list, so it cannot certify gaps.
NODE_PACKS = ('ComfyUI-EditUtils', 'ComfyUI-MingNodes', 'sd-perturbed-attention', 'vivid_nodes',
              'rgthree-comfy', 'ComfyUI-Crystools', 'TextConditional', 'was-node-suite-comfyui',
              'comfyui_essentials', 'Comfyui_TTP_Toolset', 'comfyui-easy-use', 'comfyui-custom-scripts')
ENTRY = {'python': 'python/python.exe', 'launcher': 'tools/start_comfy.py'}


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def regular(path):
    attrs = path.lstat()
    if path.is_symlink() or getattr(attrs, 'st_file_attributes', 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT:
        raise ValueError(f'Linked runtime artifact is not independent: {path}')
    return path.is_file()


def prerequisites(source, report_path):
    missing = [name for name in (*ENTRY.values(), 'comfyui/main.py')
               if name != ENTRY['launcher'] and not (source / name).is_file()]
    missing += ['models/' + name for name in MODEL_FILES if not (source / 'models' / name).is_file()]
    missing += ['custom_nodes/' + name for name in NODE_PACKS
                if not (source / 'custom_nodes' / name / '__init__.py').is_file()]
    for kind in ('preview', 'upscale'):
        if not (ROOT / 'workflows' / f'{kind}.json').is_file():
            missing.append(f'client workflow {kind}.json')
    acceptance_error = None
    node_packs = list(NODE_PACKS)
    models = list(MODEL_FILES)
    if not report_path:
        acceptance_error = 'Both original workflows need an actual output acceptance report before release'
    else:
        try:
            report = json.loads(report_path.read_text(encoding='utf-8-sig'))
            if report.get('runtimeProtocol') != PROTOCOL or Path(report['runtimeRoot']).resolve() != source:
                raise ValueError('Acceptance report belongs to a different runtime')
            node_packs = report['customNodePacks']
            if (not isinstance(node_packs, list) or not set(NODE_PACKS).issubset(node_packs)
                    or any(not isinstance(name, str) or not re.fullmatch(r'[A-Za-z0-9_-]+', name) for name in node_packs)):
                raise ValueError('Acceptance must declare the complete verified custom-node whitelist')
            models = report['modelFiles']
            if (not isinstance(models, list) or not set(MODEL_FILES).issubset(models)
                    or any(not isinstance(name, str) or '\\' in name or ':' in name or name.startswith('/')
                           or any(part in ('', '.', '..') for part in name.split('/')) for name in models)):
                raise ValueError('Acceptance must declare all original models and local caption assets')
            missing += ['custom_nodes/' + name for name in node_packs
                        if not (source / 'custom_nodes' / name / '__init__.py').is_file()]
            missing += ['models/' + name for name in models if not (source / 'models' / name).is_file()]
            for kind in ('preview', 'upscale'):
                item = report['workflows'][kind]
                workflow = ROOT / 'workflows' / f'{kind}.json'
                if item.get('passed') is not True or item.get('workflowSha256') != sha256(workflow):
                    raise ValueError(f'{kind} acceptance is missing or stale')
                output = Path(item['output'])
                if not output.is_file() or item.get('outputSha256') != sha256(output):
                    raise ValueError(f'{kind} actual output is missing or stale')
        except (KeyError, ValueError, OSError, TypeError) as exc:
            acceptance_error = str(exc)
    return {'ready': not missing and not acceptance_error, 'missing': sorted(set(missing)),
            'acceptanceError': acceptance_error, 'customNodePacks': node_packs, 'modelFiles': models}


def collect_tree(source, relative):
    base = source / relative
    if not base.is_dir():
        raise ValueError(f'Missing required runtime directory: {relative}')
    for current, directories, names in os.walk(base, followlinks=False):
        directories[:] = sorted(name for name in directories if name not in (
            '.git', '__pycache__', '.pytest_cache', 'node_modules')
            and (Path(current) / name).relative_to(source).as_posix() not in (
                'comfyui/input', 'comfyui/output', 'comfyui/temp', 'comfyui/user', 'comfyui/cache')
            and not name.endswith('.parts'))
        for name in directories:
            regular(Path(current) / name)  # Reject junction directories before descent.
        for name in sorted(names):
            if name.endswith(('.pyc', '.pyo', '.part', '.copying', '.log')):
                continue
            path = Path(current) / name
            if regular(path):
                yield path.relative_to(source).as_posix(), path


def create(source, version, archive_url, output, node_packs=NODE_PACKS, models=MODEL_FILES):
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9.-]{0,63}', version) or '..' in version:
        raise ValueError('Invalid runtime version')
    if archive_url is not None:
        url = urlsplit(archive_url)
        if url.scheme != 'https' or not url.netloc or url.username or url.password or url.fragment:
            raise ValueError('A publisher-controlled HTTPS archive URL is required')
    if output == source or source in output.parents:
        raise ValueError('Release output must be outside the source runtime')
    output.mkdir(parents=True, exist_ok=True)
    archive = output / f'{PACKAGE_ID}-{version}-win32-x64.zip'
    manifest_path = output / f'{PACKAGE_ID}-{version}.json'
    pending = archive.with_suffix('.zip.pending')
    if any(p.exists() for p in (archive, manifest_path, pending)):
        raise FileExistsError('Existing release or partial archive retained; use a new release version/output')
    entries = dict(collect_tree(source, 'python'))
    entries.update(collect_tree(source, 'comfyui'))
    entries.update(collect_tree(source, 'llama'))
    for name in node_packs:
        entries.update(collect_tree(source, 'custom_nodes/' + name))
    for name in models:
        path = source / 'models' / name
        if not regular(path):
            raise ValueError(f'Missing model: {name}')
        entries['models/' + name] = path
    entries[ENTRY['launcher']] = ROOT / 'tools/start_comfy.py'
    for kind in ('preview', 'upscale'):
        entries[f'workflows/{kind}.json'] = ROOT / 'workflows' / f'{kind}.json'
        provenance = ROOT / 'workflows' / f'{kind}-source.json'
        if provenance.is_file():
            entries[f'workflows/{kind}-source.json'] = provenance
    for name in ('start.cmd', 'stop.cmd', 'README.md'):
        if (source / name).is_file() and regular(source / name):
            entries[name] = source / name
    files = []
    with zipfile.ZipFile(pending, 'x', allowZip64=True) as bundle:
        for name, path in sorted(entries.items()):
            digest = hashlib.sha256()
            info = zipfile.ZipInfo(name)
            info.compress_type = zipfile.ZIP_STORED if name.endswith(('.gguf', '.safetensors', '.pth')) else zipfile.ZIP_DEFLATED
            info.file_size = path.stat().st_size
            with path.open('rb') as src, bundle.open(info, 'w', force_zip64=True) as dst:
                for chunk in iter(lambda: src.read(8 * 1024 * 1024), b''):
                    digest.update(chunk)
                    dst.write(chunk)
            files.append({'path': name, 'bytes': info.file_size, 'sha256': digest.hexdigest()})
            print(json.dumps({'file': name, 'bytes': info.file_size}), flush=True)
        internal = {'schemaVersion': 1, 'id': PACKAGE_ID, 'version': version,
                    'protocolVersion': PROTOCOL, 'platform': 'win32-x64', 'entry': ENTRY,
                    'customNodePacks': list(node_packs), 'files': files}
        raw = json.dumps(internal, ensure_ascii=False, indent=2).encode('utf-8')
        bundle.writestr('runtime.json', raw)
    manifest = {key: internal[key] for key in ('schemaVersion', 'id', 'version', 'protocolVersion', 'platform', 'entry')}
    manifest['archive'] = {'url': archive_url, 'bytes': pending.stat().st_size, 'sha256': sha256(pending),
                           'unpackedBytes': sum(item['bytes'] for item in files) + len(raw)}
    manifest['requiredFiles'] = list(ENTRY.values()) + ['comfyui/main.py'] + ['models/' + name for name in models]
    pending.rename(archive)
    if archive_url is not None:
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    return {'archive': str(archive), 'manifest': str(manifest_path) if archive_url is not None else None,
            **manifest['archive']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT.parent / 'VividCFRuntime')
    parser.add_argument('--acceptance-report', type=Path)
    parser.add_argument('--check-only', action='store_true')
    parser.add_argument('--version')
    parser.add_argument('--archive-url')
    parser.add_argument('--local-only', action='store_true', help='Build a verified local ZIP without a hosted download manifest')
    parser.add_argument('--out', type=Path, default=ROOT.parent / 'VividCFPackages')
    args = parser.parse_args()
    source = args.source.expanduser().resolve()
    result = prerequisites(source, args.acceptance_report)
    if not args.check_only and result['ready']:
        if not args.version or (not args.local_only and not args.archive_url):
            parser.error('--version and either --local-only or --archive-url are required when building')
        if args.local_only and args.archive_url:
            parser.error('--local-only does not accept a hosted archive URL')
        result.update(create(source, args.version, args.archive_url, args.out.expanduser().resolve(),
                             result['customNodePacks'], result['modelFiles']))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result['ready'] else 2


if __name__ == '__main__':
    sys.exit(main())
