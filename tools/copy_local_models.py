"""Copy required exact-name local assets; no model/precision substitution."""
from pathlib import Path
import hashlib
import json
import shutil
import time

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(r'G:\ComfyUI_windows_0606\ComfyUI\models')
ASSETS = {
    'text_encoders/qwen_3_8b_fp8mixed.safetensors': SOURCE / 'text_encoders/qwen_3_8b_fp8mixed.safetensors',
    'vae/flux2-vae.safetensors': SOURCE / 'vae/flux2-vae.safetensors',
    'loras/klein/vivid_klein_v1.4_000076275.safetensors': ROOT.parent / 'vivid模型/vivid_klein_v1.4_000076275.safetensors',
    'LLM/Qwen3.5-9B-Q4_K_M.gguf': Path(r'G:\Agent\llama\models\Qwen3.5-9B-Q4_K_M.gguf'),
    'LLM/mmproj-BF16.gguf': SOURCE / 'LLM/facade-facts-qwen35/mmproj-BF16.gguf',
    'upscale_models/2xNomosUni_span_multijpg_ldl.pth': SOURCE / 'upscale_models/2xNomosUni_span_multijpg_ldl.pth',
    'vae/ae.safetensors': SOURCE / 'vae/ae.safetensors',
    'diffusion_models/flux.1-dev-SRPO-bf16.safetensors': SOURCE / 'unet/flux.1-dev-SRPO-bf16.safetensors',
    'text_encoders/SD3/clip_l.safetensors': SOURCE / 'clip/clip_l.safetensors',
    'text_encoders/SD3/t5xxl_fp16.safetensors': Path(r'E:\ComfyUI_windows_portable\ComfyUI\models\clip\t5xxl_fp16.safetensors'),
}


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


if __name__ == '__main__':
    receipts = ROOT / 'runtime/local-models.json'
    existing = json.loads(receipts.read_text(encoding='utf8')) if receipts.exists() else []
    rows = {item['path']: item for item in existing}
    deadline = time.monotonic() + 20 * 60
    for name, source in ASSETS.items():
        if time.monotonic() >= deadline:
            raise TimeoutError('Copy budget exceeded; completed models retained')
        if not source.is_file():
            print('MISSING', source, flush=True)
            continue
        dest = ROOT / 'runtime/models' / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        expected = sha(source)
        if not dest.exists():
            temp = dest.with_suffix(dest.suffix + '.copying')
            print('Copying', name, source.stat().st_size, flush=True)
            shutil.copyfile(source, temp)
            if sha(temp) != expected:
                raise RuntimeError(f'Copy hash mismatch: {name}')
            temp.rename(dest)
        elif sha(dest) != expected:
            raise RuntimeError(f'Existing model mismatch: {name}; retained without replacement')
        rows[name] = dict(path=name, source=str(source), bytes=dest.stat().st_size,
                          sha256=expected, storage='independent_copy')
        receipts.write_text(json.dumps(list(rows.values()), ensure_ascii=False, indent=2), encoding='utf8')
        print('VERIFIED', name, expected, flush=True)
    binary_source = Path(r'G:\ComfyUI_windows_0606\ComfyUI\custom_nodes\ComfyUI-Qwen-Image-Prompt-Rewrite-T8\runtime\llama-b11068')
    binary_dest = ROOT / 'runtime/llama'
    binary_dest.mkdir(exist_ok=True)
    for source in binary_source.iterdir():
        if source.suffix.lower() in ('.exe', '.dll'):
            shutil.copy2(source, binary_dest / source.name)
    print('Local llama runtime copied', flush=True)
