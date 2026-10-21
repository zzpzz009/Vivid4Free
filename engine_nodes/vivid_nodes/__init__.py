"""Local caption only; original plugin node names must never be overridden here."""
import base64
import io
import json
from pathlib import Path
import socket
import subprocess
import threading
import time
from urllib.request import Request, urlopen

import numpy as np
from PIL import Image
import torch
import comfy.model_management as memory

RUNTIME = Path(__file__).resolve().parents[2]


class LocalCaption:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'image': ('IMAGE',), 'prompt': ('STRING', {'multiline': True})}}

    RETURN_TYPES = ('STRING',)
    FUNCTION = 'caption'
    CATEGORY = 'Vivid/Desktop'

    def caption(self, image, prompt):
        binary = RUNTIME / 'llama/llama-server.exe'
        model = RUNTIME / 'models/LLM/Qwen3.5-9B-Q4_K_M.gguf'
        projector = RUNTIME / 'models/LLM/mmproj-BF16.gguf'
        for path in (binary, model, projector):
            if not path.is_file():
                raise FileNotFoundError(f'Local caption dependency missing: {path.name}')
        memory.throw_exception_if_processing_interrupted()
        memory.unload_all_models()
        memory.soft_empty_cache()
        pil = Image.fromarray(np.clip(image[0].cpu().numpy() * 255, 0, 255).astype(np.uint8))
        pil.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        pil.convert('RGB').save(buffer, format='JPEG', quality=92)
        data = base64.b64encode(buffer.getvalue()).decode('ascii')
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        args = [str(binary), '-m', str(model), '--mmproj', str(projector), '--host', '127.0.0.1',
                '--port', str(port), '-c', '8192', '-ngl', '99', '--jinja', '--parallel', '1',
                '--reasoning-format', 'none', '--alias', 'vivid-caption']
        log_path = RUNTIME / 'logs/caption.log'
        log_path.parent.mkdir(exist_ok=True)
        with log_path.open('ab') as log:
            process = subprocess.Popen(args, cwd=binary.parent, stdout=log, stderr=log,
                                       creationflags=subprocess.CREATE_NO_WINDOW)
            deadline = time.monotonic() + 180
            try:
                while time.monotonic() < deadline:
                    memory.throw_exception_if_processing_interrupted()
                    if process.poll() is not None:
                        raise RuntimeError('Local caption engine exited; inspect caption.log')
                    try:
                        with urlopen(f'http://127.0.0.1:{port}/health', timeout=2) as response:
                            if response.status == 200:
                                break
                    except OSError:
                        time.sleep(.25)
                else:
                    raise TimeoutError('Local caption startup deadline exceeded')
                payload = {'model': 'vivid-caption', 'stream': False, 'temperature': 0, 'seed': 0,
                           'max_tokens': 256, 'chat_template_kwargs': {'enable_thinking': False},
                           'messages': [{'role': 'user', 'content': [
                               {'type': 'image_url', 'image_url': {'url': f'data:image/jpeg;base64,{data}'}},
                               {'type': 'text', 'text': prompt}]}]}
                result, done = {}, threading.Event()

                def request():
                    try:
                        req = Request(f'http://127.0.0.1:{port}/v1/chat/completions',
                                      data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'})
                        with urlopen(req, timeout=150) as response:
                            result['data'] = json.load(response)
                    except Exception as exc:
                        result['error'] = exc
                    finally:
                        done.set()

                thread = threading.Thread(target=request, daemon=True)
                thread.start()
                while not done.wait(.25):
                    memory.throw_exception_if_processing_interrupted()
                    if time.monotonic() >= deadline:
                        raise TimeoutError('Local caption inference deadline exceeded')
                if 'error' in result:
                    raise RuntimeError('Local caption request failed') from result['error']
                text = result['data']['choices'][0]['message'].get('content', '').strip()
                text = text.split('</think>')[-1].strip()
                if not text:
                    raise RuntimeError('Local caption returned no description')
                return (text,)
            finally:
                if process.poll() is None:
                    process.terminate()
                    try:
                        process.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait(timeout=5)

NODE_CLASS_MAPPINGS = {'VividLocalCaption': LocalCaption}
