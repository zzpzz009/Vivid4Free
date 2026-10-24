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
WORKFLOWS = Path(os.environ.get('VIVID_WORKFLOW_SOURCE_DIR', ROOT.parent / 'VividPrivate/workflows'))
PACKAGE_ID = 'vivid-comfy'
PROTOCOL = 1
MODEL_FILES = (
    'diffusion_models/flux-2-klein-9b.safetensors',
    'text_encoders/qwen_3_8b_fp8mixed.safetensors',
    'vae/flux2-vae.safetensors',
    'loras/klein/vivid_klein_v1.4_000076275.safetensors',
    'loras/klein/Klein 一致性增强.safetensors',
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
        if not (WORKFLOWS / f'{kind}.json').is_file():
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
                workflow = WORKFLOWS / f'{kind}.json'
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


def archive_inventory(bundle):
    raw = bundle.read('runtime.json')
    info = json.loads(raw)
    if (info.get('schemaVersion') != 1 or info.get('id') != PACKAGE_ID or info.get('protocolVersion') != PROTOCOL
            or info.get('platform') != 'win32-x64' or info.get('entry') != ENTRY):
        raise ValueError('Invalid base runtime manifest')
    files = {}
    for item in info['files']:
        name = item['path']
        if (not isinstance(name, str) or '\\' in name or ':' in name or name.startswith('/')
                or any(part in ('', '.', '..') for part in name.split('/')) or name.lower() in files
                or name.lower() in ('runtime.json', 'delta.json') or not re.fullmatch(r'[a-fA-F0-9]{64}', item['sha256'])
                or type(item['bytes']) is not int or item['bytes'] < 0):
            raise ValueError('Invalid archive inventory')
        files[name.lower()] = item
    actual = {entry.filename.lower(): entry for entry in bundle.infolist() if not entry.is_dir()}
    if len(actual) != len([entry for entry in bundle.infolist() if not entry.is_dir()]) or set(actual) != set(files) | {'runtime.json'}:
        raise ValueError('Archive entries do not match runtime inventory')
    for key, item in files.items():
        if actual[key].filename != item['path'] or actual[key].file_size != item['bytes']:
            raise ValueError('Archive inventory size/path mismatch')
    return raw, info, {item['path']: item for item in files.values()}


def create_incremental(full_archive, base_archive, output):
    with zipfile.ZipFile(base_archive) as before, zipfile.ZipFile(full_archive) as after:
        base_raw, base, old = archive_inventory(before)
        target_raw, target, new = archive_inventory(after)
        if not re.fullmatch(r'\d+(?:\.\d+)*', base['version']) or not re.fullmatch(r'\d+(?:\.\d+)*', target['version']):
            raise ValueError('Incremental releases require numeric engine versions')
        if tuple(map(int, base['version'].split('.'))) >= tuple(map(int, target['version'].split('.'))):
            raise ValueError('Incremental base must precede target version')
        changed = sorted(name for name, item in new.items()
                         if name not in old or (item['bytes'], item['sha256'].lower()) != (old[name]['bytes'], old[name]['sha256'].lower()))
        removed = sorted(set(old) - set(new))
        delta = {'schemaVersion': 1, 'baseVersion': base['version'], 'targetVersion': target['version'],
                 'baseManifestSha256': hashlib.sha256(base_raw).hexdigest(), 'files': changed, 'removed': removed}
        archive = output / f'{PACKAGE_ID}-{base["version"]}-to-{target["version"]}-incremental-win32-x64.zip'
        pending = archive.with_suffix('.zip.pending')
        if archive.exists() or pending.exists():
            raise FileExistsError('Existing incremental release retained')
        delta_raw = json.dumps(delta, ensure_ascii=False, indent=2).encode('utf-8')
        with zipfile.ZipFile(pending, 'x', allowZip64=True) as bundle:
            for name in changed:
                original = after.getinfo(name)
                entry = zipfile.ZipInfo(name)
                entry.compress_type = original.compress_type
                entry.file_size = original.file_size
                digest = hashlib.sha256()
                with after.open(name) as src, bundle.open(entry, 'w', force_zip64=True) as dst:
                    for chunk in iter(lambda: src.read(8 * 1024 * 1024), b''):
                        digest.update(chunk)
                        dst.write(chunk)
                if digest.hexdigest() != new[name]['sha256'].lower():
                    raise ValueError(f'Changed payload hash mismatch: {name}')
                print(json.dumps({'incrementalFile': name, 'bytes': entry.file_size}), flush=True)
            bundle.writestr('runtime.json', target_raw)
            bundle.writestr('delta.json', delta_raw)
        result = {'baseVersion': base['version'], 'baseManifestSha256': delta['baseManifestSha256'],
                  'filename': archive.name,
                  'archive': {'url': None, 'bytes': pending.stat().st_size, 'sha256': sha256(pending),
                              'unpackedBytes': sum(new[name]['bytes'] for name in changed) + len(target_raw) + len(delta_raw)}}
        pending.rename(archive)
        return result


def create(source, version, archive_url, output, node_packs=NODE_PACKS, models=MODEL_FILES, compatible_clients=None,
           quark_share_url=None, quark_extraction_code=None, base_archive=None):
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9.-]{0,63}', version) or '..' in version:
        raise ValueError('Invalid runtime version')
    if compatible_clients is not None and (not compatible_clients or len(compatible_clients) > 128
            or len(set(compatible_clients)) != len(compatible_clients)
            or any(not re.fullmatch(r'\d+\.\d+\.\d+', client) for client in compatible_clients)):
        raise ValueError('Declare exact compatible front-end versions')
    if archive_url is not None:
        url = urlsplit(archive_url)
        if url.scheme != 'https' or not url.netloc or url.username or url.password or url.fragment:
            raise ValueError('A publisher-controlled HTTPS archive URL is required')
    if quark_share_url is not None:
        url = urlsplit(quark_share_url)
        if (url.scheme != 'https' or url.netloc != 'pan.quark.cn'
                or not re.fullmatch(r'/s/[A-Za-z0-9_-]+/?', url.path) or url.fragment):
            raise ValueError('An official Quark HTTPS share URL is required')
        if archive_url is not None or not compatible_clients:
            raise ValueError('Quark distribution requires exact compatible clients and no direct archive URL')
    if quark_extraction_code is not None and (quark_share_url is None
            or not re.fullmatch(r'[A-Za-z0-9]{1,16}', quark_extraction_code)):
        raise ValueError('A Quark share and valid extraction code are required')
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
        if compatible_clients is not None:
            internal['compatibleClientVersions'] = list(compatible_clients)
        raw = json.dumps(internal, ensure_ascii=False, indent=2).encode('utf-8')
        bundle.writestr('runtime.json', raw)
    manifest = {key: internal[key] for key in ('schemaVersion', 'id', 'version', 'protocolVersion', 'platform', 'entry')}
    if compatible_clients is not None:
        manifest['compatibleClientVersions'] = list(compatible_clients)
    manifest['archive'] = {'url': archive_url, 'bytes': pending.stat().st_size, 'sha256': sha256(pending),
                           'unpackedBytes': sum(item['bytes'] for item in files) + len(raw)}
    manifest['requiredFiles'] = list(ENTRY.values()) + ['comfyui/main.py'] + ['models/' + name for name in models]
    if quark_share_url is not None:
        manifest['downloads'] = [{'provider': 'quark', 'url': quark_share_url,
                                  'extractionCode': quark_extraction_code or ''}]
    pending.rename(archive)
    if base_archive is not None:
        manifest['incremental'] = create_incremental(archive, base_archive, output)
    if archive_url is not None or quark_share_url is not None:
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    return {'archive': str(archive), 'manifest': str(manifest_path) if archive_url is not None or quark_share_url is not None else None,
            **manifest['archive'], **({'incremental': manifest['incremental']} if 'incremental' in manifest else {})}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT.parent / 'VividCFRuntime')
    parser.add_argument('--acceptance-report', type=Path)
    parser.add_argument('--check-only', action='store_true')
    parser.add_argument('--version')
    parser.add_argument('--compatible-client', action='append', help='Exact validated front-end version; repeat for multiple versions')
    parser.add_argument('--archive-url')
    parser.add_argument('--quark-share-url', help='Official HTTPS share for the release file or containing folder')
    parser.add_argument('--quark-extraction-code')
    parser.add_argument('--local-only', action='store_true', help='Build a verified local ZIP without a hosted download manifest')
    parser.add_argument('--base-archive', type=Path, help='Previous official full ZIP; also create an incremental ZIP from this exact baseline')
    parser.add_argument('--out', type=Path, default=ROOT.parent / 'VividCFPackages')
    args = parser.parse_args()
    source = args.source.expanduser().resolve()
    result = prerequisites(source, args.acceptance_report)
    if not args.check_only and result['ready']:
        if not args.version or sum(bool(mode) for mode in (args.local_only, args.archive_url, args.quark_share_url)) != 1:
            parser.error('--version and exactly one of --local-only, --archive-url, --quark-share-url are required when building')
        if not args.compatible_client:
            parser.error('--compatible-client is required; only declare versions validated with this CF package')
        result.update(create(source, args.version, args.archive_url, args.out.expanduser().resolve(),
                             result['customNodePacks'], result['modelFiles'], args.compatible_client,
                             args.quark_share_url, args.quark_extraction_code,
                             args.base_archive.expanduser().resolve() if args.base_archive else None))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result['ready'] else 2


if __name__ == '__main__':
    sys.exit(main())
