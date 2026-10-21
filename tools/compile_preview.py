"""Convert the supplied UI graph without replacing the original sampling chain."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / 'vivid模型/01生动建筑第一阶段预览-klein.json'


def compile_graph():
    source = json.loads(SOURCE.read_text(encoding='utf8'))
    nodes = {str(n['id']): n for n in source['nodes']}
    links = {link[0]: (str(link[1]), link[2]) for link in source['links']}
    graph = {}
    for key, node in nodes.items():
        if node['type'] in ('easy bookmark', 'Image Comparer (rgthree)', 'PreviewImage', 'SetNode'):
            continue
        if node['type'] == 'SaveImage':
            continue  # Only the final color-matched output is saved for the app.
        values = iter(node.get('widgets_values') or [])
        inputs = {}
        for item in node.get('inputs', []):
            if item.get('widget') is not None:
                try:
                    inputs[item['name']] = next(values)
                except StopIteration as exc:
                    raise ValueError(f'Missing serialized widget {key}.{item["name"]}') from exc
            if item.get('link') is not None:
                inputs[item['name']] = list(links[item['link']])
        graph[key] = {'class_type': node['type'], 'inputs': inputs}

    def resolve(value):
        if not isinstance(value, list) or len(value) != 2 or value[0] not in nodes:
            return value
        key, slot = value
        node = nodes[key]
        if node['type'] == 'SetNode':
            link = next(item['link'] for item in node['inputs'] if item.get('link') is not None)
            return resolve(list(links[link]))
        if node['type'] == 'ImpactInt':
            return node['widgets_values'][0]
        return value

    for item in graph.values():
        item['inputs'] = {key: resolve(value) for key, value in item['inputs'].items()}
    graph.pop('1356')  # ImpactInt is a literal, not a computation node.
    model_link = resolve(list(links[next(i['link'] for i in nodes['1318']['inputs'] if i['name'] == 'model')]))
    clip_link = resolve(list(links[next(i['link'] for i in nodes['1318']['inputs'] if i['name'] == 'clip')]))
    loras = [dict(value) for value in nodes['1318']['widgets_values']
             if isinstance(value, dict) and 'lora' in value and value.get('on')]
    loras[0]['lora'] = str(Path('klein') / 'vivid_klein_v1.4_000076275.safetensors')
    graph['1318'] = {'class_type': 'Power Lora Loader (rgthree)', 'inputs': {
        'model': model_link, 'clip': clip_link,
        **{f'lora_{index}': value for index, value in enumerate(loras, 1)}}}
    graph['760'] = {'class_type': 'VividLocalCaption', 'inputs': {
        'image': resolve(list(links[next(i['link'] for i in nodes['760']['inputs'] if i['name'] == 'image')])),
        'prompt': nodes['760']['widgets_values'][1]}}
    # Only expose the original saved JPG to the client; encoding settings stay intact.
    graph['622']['inputs']['show_previews'] = 'true'
    for item in graph.values():
        item['inputs'].pop('upload', None)
    graph['536']['inputs']['image'] = 'vivid-main.png'
    graph['605']['inputs']['image'] = 'vivid-reference.png'
    # Drop unconsumed UI/debug branches by traversing from the final output.
    selected = {}

    def visit(key):
        if key in selected:
            return
        if key not in graph:
            raise ValueError(f'Unresolved node: {key}')
        selected[key] = graph[key]
        for value in graph[key]['inputs'].values():
            if isinstance(value, list) and len(value) == 2 and isinstance(value[0], str):
                visit(value[0])
    visit('622')
    return selected


if __name__ == '__main__':
    graph = compile_graph()
    folder = ROOT / 'workflows'
    folder.mkdir(exist_ok=True)
    (folder / 'preview.json').write_text(json.dumps(graph, ensure_ascii=False, indent=2), encoding='utf8')
    (folder / 'preview-source.json').write_text(json.dumps({
        'source': str(SOURCE), 'source_sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'nodes': len(graph), 'changes': ['v1.4_000076275 selected by user',
            'Zhipu caption replaced by local Qwen3.5 visual inference',
            'Original computational node types and links retained; SetNode reroutes and ImpactInt constant folded',
            'Original Power Lora Loader retained with original strengths and ordering',
            'Original WAS Image Save and JPG settings retained; show_previews enabled for client result retrieval',
            'Scene checkbox edits original scene text node only; sampling chain unchanged']}, ensure_ascii=False, indent=2), encoding='utf8')
    print(f'Compiled {len(graph)} nodes; original sampling chain retained')
