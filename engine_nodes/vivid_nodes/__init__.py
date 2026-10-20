"""Small desktop adapters; rendering/sampling stays in the original graph."""
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


class ImageResizeToPixelCount:
    """Original TextConditional formula: area = target_side_length squared.

    Same bilinear interpolation and rounding as the supplied local node; fails
    explicitly rather than returning the input after a processing failure.
    """
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'image': ('IMAGE',), 'target_side_length': ('INT', {'default': 2048, 'min': 32, 'max': 10000})}}

    RETURN_TYPES = ('IMAGE',)
    FUNCTION = 'resize'
    CATEGORY = 'Vivid/Desktop'

    def resize(self, image, target_side_length):
        height, width = image.shape[1:3]
        ratio = width / height
        width = max(1, int(round((target_side_length ** 2 * ratio) ** .5)))
        height = max(1, int(round((target_side_length ** 2 / ratio) ** .5)))
        data = image.movedim(-1, 1).to(memory.get_torch_device())
        data = torch.nn.functional.interpolate(data, size=(height, width), mode='bilinear', align_corners=False)
        return (data.movedim(1, -1).clamp(0, 1),)


class ImageFlip:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'image': ('IMAGE',), 'axis': (['x', 'y', 'xy'],)}}

    RETURN_TYPES = ('IMAGE',)
    FUNCTION = 'flip'
    CATEGORY = 'Vivid/Desktop'

    def flip(self, image, axis):
        return (torch.flip(image, [2] if axis == 'x' else [1] if axis == 'y' else [1, 2]),)


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


NODE_CLASS_MAPPINGS = {'ImageResizeToPixelCount': ImageResizeToPixelCount,
                       'ImageFlip+': ImageFlip, 'VividLocalCaption': LocalCaption}


class TextValue:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'positive': ('STRING', {'multiline': True})}}
    RETURN_TYPES = ('STRING',)
    FUNCTION = 'execute'
    CATEGORY = 'Vivid/Desktop'
    def execute(self, positive):
        return (positive,)


class TextMix:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {key: ('STRING', {'default': ''}) for key in ('text1', 'text2', 'text3', 'template')}}
    RETURN_TYPES = ('STRING', 'STRING', 'STRING', 'STRING')
    FUNCTION = 'execute'
    CATEGORY = 'Vivid/Desktop'
    def execute(self, text1, text2, text3, template):
        text = template.replace('{text1}', text1).replace('{text2}', text2).replace('{text3}', text3)
        return (text1, text2, text3, text)


class TextConcat:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'delimiter': ('STRING', {'default': ''}), 'clean_whitespace': (['true', 'false'],)},
                'optional': {key: ('STRING', {'forceInput': True}) for key in ('text_a', 'text_b', 'text_c', 'text_d')}}
    RETURN_TYPES = ('STRING',)
    FUNCTION = 'execute'
    CATEGORY = 'Vivid/Desktop'
    def execute(self, delimiter, clean_whitespace, **texts):
        values = [texts[key].strip() if clean_whitespace == 'true' else texts[key]
                  for key in sorted(texts) if isinstance(texts[key], str)]
        return (('\n' if delimiter == '\\n' else delimiter).join(v for v in values if v != ''),)


class TextIdentity:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'text': ('STRING', {'forceInput': True})}}
    RETURN_TYPES = ('STRING',)
    FUNCTION = 'execute'
    CATEGORY = 'Vivid/Desktop'
    def execute(self, text):
        return (text,)


class Slider:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'value': ('FLOAT', {'default': .5, 'min': 0, 'max': 1}),
                             'min': ('FLOAT', {'default': 0}), 'max': ('FLOAT', {'default': 1}),
                             'rounding': ('INT', {'default': 2})}}
    RETURN_TYPES = ('FLOAT', 'INT')
    FUNCTION = 'execute'
    CATEGORY = 'Vivid/Desktop'
    def execute(self, value, min, max, rounding):
        value = min + value * (max - min)
        if rounding > 0:
            value = round(value, rounding)
        return (value, int(value))


class ImageSwitch:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'boolean': ('BOOLEAN', {'default': False}),
                             'on_true': ('IMAGE',), 'on_false': ('IMAGE',)}}
    RETURN_TYPES = ('IMAGE',)
    FUNCTION = 'execute'
    CATEGORY = 'Vivid/Desktop'
    def execute(self, boolean, on_true, on_false):
        return (on_true if boolean else on_false,)


NODE_CLASS_MAPPINGS.update({'easy positive': TextValue, 'TTP_text_mix': TextMix,
                            'Text Concatenate': TextConcat, 'ShowText|pysssss': TextIdentity,
                            'SimpleMathSlider+': Slider, 'Switch any [Crystools]': ImageSwitch})


class TextSwitch(ImageSwitch):
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'boolean': ('BOOLEAN', {'default': True}),
                             'on_true': ('STRING', {'forceInput': True}),
                             'on_false': ('STRING', {'forceInput': True})}}
    RETURN_TYPES = ('STRING',)


NODE_CLASS_MAPPINGS['VividTextSwitch'] = TextSwitch
