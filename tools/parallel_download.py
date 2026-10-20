"""Bounded parallel HTTP ranges for the two large, pinned model downloads."""
from concurrent.futures import ThreadPoolExecutor, as_completed
import argparse
import json
import os
from pathlib import Path
import shutil
import sys
import threading
import time
from datetime import datetime, timezone
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parent))
from download_models import MODELS, ROOT, digest

RUNTIME = Path(os.environ.get('VIVID_RUNTIME_DIR', ROOT.parent / 'VividCFRuntime')).resolve()
MODEL_ROOT = RUNTIME / 'models'


def run(name, deadline):
    model = MODELS[name]
    dest = MODEL_ROOT / model['path']
    if dest.exists():
        if digest(dest) != model['sha256']:
            raise RuntimeError('Existing model failed pinned hash')
        return {'name': name, 'status': 'verified'}
    dest.parent.mkdir(parents=True, exist_ok=True)
    prefix = dest.with_suffix(dest.suffix + '.part')
    parts = dest.with_suffix(dest.suffix + '.parts')
    parts.mkdir(exist_ok=True)
    state_path = parts / 'state.json'
    if state_path.exists():
        state = json.loads(state_path.read_text())
        if state['sha256'] != model['sha256']:
            raise RuntimeError('Partial state belongs to another model')
    else:
        state = {'sha256': model['sha256'], 'prefix': prefix.stat().st_size if prefix.exists() else 0,
                 'chunk': 64 * 1024 * 1024}
        state_path.write_text(json.dumps(state, indent=2), encoding='utf8')
    if state['prefix'] and (not prefix.exists() or prefix.stat().st_size != state['prefix']):
        raise RuntimeError('Sequential prefix changed; refusing to merge inconsistent partials')
    ranges = [(i, start, min(model['bytes'], start + state['chunk']) - 1)
              for i, start in enumerate(range(state['prefix'], model['bytes'], state['chunk']))]
    lock = threading.Lock()
    progress = {'bytes': state['prefix'], 'last': 0}

    def chunk(row):
        i, start, end = row
        path = parts / f'{i:05d}.part'
        size = end - start + 1
        if path.exists() and path.stat().st_size == size:
            return True
        for attempt in range(3):
            if time.monotonic() >= deadline:
                return False
            offset = path.stat().st_size if path.exists() else 0
            if offset > size:
                raise RuntimeError('Oversized range file')
            req = Request(model['url'], headers={'Range': f'bytes={start+offset}-{end}',
                                                 'User-Agent': 'VividDesktop-setup/0.1'})
            try:
                with urlopen(req, timeout=20) as response:
                    expected = f'bytes {start+offset}-{end}/{model["bytes"]}'
                    if response.status != 206 or response.headers.get('Content-Range') != expected:
                        raise RuntimeError('Incorrect range response')
                    with path.open('ab') as stream:
                        while stream.tell() < size and time.monotonic() < deadline:
                            block = response.read(min(1024 * 1024, size-stream.tell()))
                            if not block:
                                break
                            stream.write(block)
                if path.stat().st_size == size:
                    return True
            except OSError:
                continue
        return False

    complete = True
    with ThreadPoolExecutor(max_workers=8) as pool:
        for result in as_completed([pool.submit(chunk, row) for row in ranges]):
            complete = result.result() and complete
            with lock:
                if time.monotonic() - progress['last'] >= 20:
                    received = state['prefix'] + sum(p.stat().st_size for p in parts.glob('*.part'))
                    print(f'{name}: ranges {received}/{model["bytes"]}', flush=True)
                    progress['last'] = time.monotonic()
    if complete:
        assembled = dest.with_suffix(dest.suffix + '.assembling')
        with assembled.open('wb') as stream:
            if state['prefix']:
                with prefix.open('rb') as source:
                    shutil.copyfileobj(source, stream, 8 * 1024 * 1024)
            for i, _, _ in ranges:
                with (parts / f'{i:05d}.part').open('rb') as source:
                    shutil.copyfileobj(source, stream, 8 * 1024 * 1024)
        if assembled.stat().st_size != model['bytes'] or digest(assembled) != model['sha256']:
            raise RuntimeError('Assembled model failed pinned size/SHA256; all partials retained')
        assembled.rename(dest)
        return {'name': name, 'status': 'verified', **model}
    received = state['prefix'] + sum(p.stat().st_size for p in parts.glob('*.part'))
    return {'name': name, 'status': 'partial', 'downloaded_bytes': received, **model}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--minutes', type=float, default=60)
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
    with ThreadPoolExecutor(max_workers=2) as pool:
        for task in as_completed([pool.submit(run, name, deadline) for name in ('klein-9b', 'seedvr-7b')]):
            try:
                rows.append(task.result())
            except Exception as exc:
                rows.append({'status': 'failed', 'error': str(exc)})
    (RUNTIME / 'parallel-downloads.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf8')
    print(json.dumps(rows, ensure_ascii=False), flush=True)
