"""Inventory original graph requirements against an explicit local model library."""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODEL_EXTENSIONS = ('.safetensors', '.gguf', '.ckpt', '.pth', '.bin')


def model_names(value):
    if isinstance(value, str) and value.lower().endswith(MODEL_EXTENSIONS):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from model_names(item)
    elif isinstance(value, dict):
        for item in value.values():
            yield from model_names(item)


def audit(libraries):
    index = {}
    for library in libraries:
        if library.is_dir():
            for path in library.rglob('*'):
                if path.is_file() and path.suffix.lower() in MODEL_EXTENSIONS:
                    index.setdefault(path.name.lower(), []).append(str(path))
    rows = []
    for path in sorted((ROOT.parent / 'vivid模型').glob('*.json')):
        graph = json.loads(path.read_text(encoding='utf8'))
        rows.append({'source': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                     'nodes': [{'id': node['id'], 'type': node['type'], 'mode': node.get('mode', 0),
                                'package': node.get('properties', {}).get('cnr_id'),
                                'models': [{'name': name, 'matches': index.get(name.replace('\\', '/').split('/')[-1].lower(), [])}
                                           for name in model_names(node.get('widgets_values'))]}
                               for node in graph['nodes']]})
    report = {'libraries': [str(p) for p in libraries], 'workflows': rows}
    dest = ROOT / 'runtime/workflow-audit.json'
    dest.parent.mkdir(exist_ok=True)
    dest.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf8')
    for row in rows:
        print(Path(row['source']).name, len(row['nodes']), 'nodes')
        for node in row['nodes']:
            for model in node['models']:
                print(' FOUND' if model['matches'] else ' MISSING', model['name'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--library', type=Path, action='append', required=True)
    audit(parser.parse_args().library)
