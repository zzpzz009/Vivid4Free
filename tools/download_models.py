"""Resume exact published model artifacts and verify their pinned SHA256.

Partial downloads stay .part, never appear in the ComfyUI model list. A finite
wall-clock deadline applies to each invocation; re-run to resume saved bytes.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
import os
from pathlib import Path
import time
from datetime import datetime, timezone
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = Path(os.environ.get('VIVID_RUNTIME_DIR', ROOT.parent / 'VividCFRuntime')).resolve()
MODEL_ROOT = RUNTIME / 'models'
MODELS = {
    'realistic': {
        'url': 'https://huggingface.co/dx8152/Flux2-Klein-9B-Enhanced-Details/resolve/29969e9/realistic.safetensors',
        'path': 'loras/klein/realistic.safetensors', 'bytes': 331379616,
        'sha256': '9788dcbeffb79a7823427aaadd47ea122077e3cd9f142de012b58649d50b897e'},
    'seedvr-vae': {
        'url': 'https://huggingface.co/numz/SeedVR2_comfyUI/resolve/8aceb16351dd998900da1ad01667dbd125376af0/ema_vae_fp16.safetensors',
        'path': 'SEEDVR2/ema_vae_fp16.safetensors', 'bytes': 501324814,
        'sha256': '20678548f420d98d26f11442d3528f8b8c94e57ee046ef93dbb7633da8612ca1'},
    'seedvr-7b': {
        'url': 'https://huggingface.co/hk6668/SeedVR2-GGUF/resolve/655f241/seedvr2_ema_7b-Q8_K_M.gguf',
        'path': 'SEEDVR2/seedvr2_ema_7b-Q8_K_M.gguf', 'bytes': 8835170080,
        'sha256': '669788655e8f15f306284f267a444e9766c8a421869577b16a961e43029c737b'},
    'klein-9b': {
        'url': 'https://huggingface.co/Nachert/Klein/resolve/c966691/flux-2-klein-9b.safetensors',
        'path': 'diffusion_models/flux-2-klein-9b.safetensors', 'bytes': 18157185168,
        'sha256': '0975d6b77b5f510b99547d6724a208e36527df654e8f6134f59ece3f9f30da58',
        'provenance': 'Public full precision mirror; SHA256 and byte size independently match BFL official LFS metadata at revision 92196c8e11f7b6cf2b7493e037d8c5345c559216.'},
}


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as handle:
        for block in iter(lambda: handle.read(8 * 1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def download(name, deadline):
    model = MODELS[name]
    dest = MODEL_ROOT / model['path']
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        if dest.stat().st_size != model['bytes'] or digest(dest) != model['sha256']:
            raise RuntimeError(f'{name}: existing final file hash mismatch; retained for inspection')
        return {'name': name, 'status': 'verified', **model}
    part = dest.with_suffix(dest.suffix + '.part')
    error = None
    for attempt in range(3):
        if time.monotonic() >= deadline:
            break
        start = part.stat().st_size if part.exists() else 0
        if start > model['bytes']:
            raise RuntimeError(f'{name}: oversized partial file; inspect without overwriting')
        if start == model['bytes']:
            break
        try:
            req = Request(model['url'], headers={'Range': f'bytes={start}-', 'User-Agent': 'VividDesktop-setup/0.1'})
            with urlopen(req, timeout=30) as response:
                content_range = response.headers.get('Content-Range', '')
                if response.status == 206 and not content_range.startswith(f'bytes {start}-'):
                    raise RuntimeError('Server returned an unexpected byte range')
                if start and response.status != 206:
                    raise RuntimeError('Server does not support safe resume')
                print(f'{name}: connected at {start}/{model["bytes"]}', flush=True)
                last = time.monotonic()
                with part.open('ab' if start else 'wb') as handle:
                    while time.monotonic() < deadline:
                        block = response.read(1024 * 1024)
                        if not block:
                            break
                        if handle.tell() + len(block) > model['bytes']:
                            raise RuntimeError('Server returned more bytes than pinned model size')
                        handle.write(block)
                        if time.monotonic() - last >= 15:
                            handle.flush()
                            print(f'{name}: {handle.tell()}/{model["bytes"]}', flush=True)
                            last = time.monotonic()
            if part.stat().st_size == model['bytes']:
                break
        except Exception as exc:
            error = str(exc)
            print(f'{name}: attempt {attempt+1}: {error}', flush=True)
    if part.exists() and part.stat().st_size == model['bytes']:
        actual = digest(part)
        if actual != model['sha256']:
            raise RuntimeError(f'{name}: downloaded hash mismatch; .part retained')
        part.rename(dest)
        print(f'{name}: SHA256 verified', flush=True)
        return {'name': name, 'status': 'verified', **model}
    return {'name': name, 'status': 'partial', 'downloaded_bytes': part.stat().st_size if part.exists() else 0,
            'error': error, **model}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--only', choices=MODELS, action='append')
    parser.add_argument('--minutes', type=float, default=20)
    parser.add_argument('--deadline', help='Absolute ISO-8601 deadline; effective deadline is the earlier bound')
    args = parser.parse_args()
    if not 0 < args.minutes <= 60:
        parser.error('Choose a bounded deadline of at most 60 minutes')
    deadline = time.monotonic() + args.minutes * 60
    if args.deadline:
        expires = datetime.fromisoformat(args.deadline.replace('Z', '+00:00'))
        if expires.tzinfo is None:
            parser.error('--deadline must include a timezone')
        deadline = min(deadline, time.monotonic() + max(0, (expires - datetime.now(timezone.utc)).total_seconds()))
    rows = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        tasks = {pool.submit(download, name, deadline): name for name in args.only or MODELS}
        for task in as_completed(tasks):
            try:
                rows.append(task.result())
            except Exception as exc:
                rows.append({'name': tasks[task], 'status': 'failed', 'error': str(exc)})
    report = RUNTIME / 'downloads.json'
    report.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf8')
    print(json.dumps(rows, ensure_ascii=False, indent=2), flush=True)
