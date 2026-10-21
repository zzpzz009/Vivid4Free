"""Start/check/stop only this project's loopback ComfyUI process."""
import argparse
import json
import os
from pathlib import Path
import socket
import subprocess
import time
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
# The installed CF archive has python/ and this tools/ directory at its root.
# Development keeps the large engine beside the client source checkout.
BASE = ROOT if (ROOT / 'python/python.exe').is_file() else (
    Path(os.environ['VIVID_RUNTIME_DIR']).expanduser().resolve() if os.environ.get('VIVID_RUNTIME_DIR')
    else ROOT.parent / 'VividCFRuntime')
PORT = 18295
RECEIPT = BASE / 'comfy-process.json'


def health():
    with urlopen(f'http://127.0.0.1:{PORT}/system_stats', timeout=2) as response:
        return json.load(response)


def main(action):
    import psutil
    python = (BASE / 'python/python.exe').resolve()
    mainfile = (BASE / 'comfyui/main.py').resolve()
    if action == 'status':
        if not RECEIPT.exists():
            raise RuntimeError('No project engine ownership receipt')
        record = json.loads(RECEIPT.read_text())
        process = psutil.Process(record['pid'])
        if (Path(process.exe()).resolve() != python or str(mainfile) not in process.cmdline()
                or abs(process.create_time() - record['created']) > .01):
            raise RuntimeError('The engine process is not owned by this project')
        listeners = [item for item in process.net_connections(kind='tcp')
                     if item.status == psutil.CONN_LISTEN and item.laddr.port == PORT
                     and item.laddr.ip == '127.0.0.1']
        if not listeners:
            raise RuntimeError('Project engine does not own the expected loopback listener')
        print(json.dumps(health(), ensure_ascii=False, indent=2))
        return
    if action == 'stop':
        if not RECEIPT.exists():
            return
        record = json.loads(RECEIPT.read_text())
        try:
            process = psutil.Process(record['pid'])
            if (Path(process.exe()).resolve() != python or
                    str(mainfile) not in process.cmdline() or
                    abs(process.create_time() - record['created']) > .01):
                raise RuntimeError('Process identity changed; refusing to stop it')
            process.terminate()
            process.wait(timeout=15)
        except psutil.NoSuchProcess:
            pass
        RECEIPT.unlink(missing_ok=True)
        return
    with socket.socket() as sock:
        if sock.connect_ex(('127.0.0.1', PORT)) == 0:
            raise RuntimeError(f'Port {PORT} is occupied; no existing service was changed')
    for name in ('logs', 'input', 'output', 'temp', 'user', 'models', 'custom_nodes', 'cache'):
        (BASE / name).mkdir(exist_ok=True)
    env = {**os.environ, 'PYTHONNOUSERSITE': '1', 'HF_HUB_OFFLINE': '1',
           'TRANSFORMERS_OFFLINE': '1', 'HF_HOME': str(BASE / 'cache/huggingface'),
           'TORCH_HOME': str(BASE / 'cache/torch')}
    node_packs = ['ComfyUI-EditUtils', 'ComfyUI-MingNodes', 'sd-perturbed-attention', 'vivid_nodes',
                  'rgthree-comfy', 'ComfyUI-Crystools', 'TextConditional', 'was-node-suite-comfyui',
                  'comfyui_essentials', 'Comfyui_TTP_Toolset', 'comfyui-easy-use', 'comfyui-custom-scripts']
    development_profile = BASE / 'upscale-node-profile.json'
    if development_profile.is_file() and not (BASE / 'runtime.json').is_file():
        node_packs += json.loads(development_profile.read_text(encoding='utf8')).get('customNodePacks', [])
    package_manifest = BASE / 'runtime.json'
    if package_manifest.is_file():
        import re
        node_packs = json.loads(package_manifest.read_text(encoding='utf8')).get('customNodePacks', node_packs)
        if (not isinstance(node_packs, list) or not node_packs
                or any(not isinstance(name, str) or not re.fullmatch(r'[A-Za-z0-9_-]+', name) for name in node_packs)):
            raise ValueError('Invalid custom-node whitelist in installed runtime manifest')
    args = [str(python), '-s', '-X', 'utf8', str(mainfile), '--base-directory', str(BASE),
            '--listen', '127.0.0.1', '--port', str(PORT), '--disable-auto-launch',
            '--disable-api-nodes', '--disable-cuda-malloc', '--reserve-vram', '5', '--disable-all-custom-nodes',
            '--whitelist-custom-nodes', *node_packs]
    with (BASE / 'logs/comfy.stdout.log').open('ab') as out, (BASE / 'logs/comfy.stderr.log').open('ab') as err:
        process = subprocess.Popen(args, cwd=mainfile.parent, env=env,
                                   stdout=out, stderr=err, creationflags=subprocess.CREATE_NO_WINDOW)
    receipt = {'pid': process.pid, 'created': psutil.Process(process.pid).create_time(),
               'python': str(python), 'main': str(mainfile), 'port': PORT}
    RECEIPT.write_text(json.dumps(receipt, indent=2), encoding='utf8')
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f'ComfyUI exited ({process.returncode}); see runtime/logs')
        try:
            result = health()
            (BASE / 'health.json').write_text(json.dumps(result, indent=2), encoding='utf8')
            print(f'Ready http://127.0.0.1:{PORT}, owned PID {process.pid}')
            return
        except (OSError, ValueError):
            time.sleep(1)
    process.terminate()
    process.wait(timeout=15)
    raise TimeoutError('Startup exceeded 120 seconds; owned process stopped')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['start', 'status', 'stop'], default='start', nargs='?')
    main(parser.parse_args().action)
