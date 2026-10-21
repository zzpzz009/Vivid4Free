"""Compare the executable graph against source values and resolved source links."""
import json
import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compile_preview import SOURCE, compile_graph


class PreviewFidelityTests(unittest.TestCase):
    def test_original_computations_and_links(self):
        source = json.loads(SOURCE.read_text(encoding='utf8'))
        nodes = {str(node['id']): node for node in source['nodes']}
        links = {link[0]: [str(link[1]), link[2]] for link in source['links']}
        graph = compile_graph()

        def resolve(value):
            key = value[0]
            if nodes[key]['type'] == 'SetNode':
                upstream = next(item['link'] for item in nodes[key]['inputs'] if item.get('link') is not None)
                return resolve(links[upstream])
            if nodes[key]['type'] == 'ImpactInt':
                return nodes[key]['widgets_values'][0]
            return value

        exceptions = {('536', 'image'), ('605', 'image'), ('622', 'show_previews')}
        for key, compiled in graph.items():
            original = nodes[key]
            if key == '760':
                self.assertEqual(compiled['class_type'], 'VividLocalCaption')
                self.assertEqual(compiled['inputs']['prompt'], original['widgets_values'][1])
                continue
            self.assertEqual(compiled['class_type'], original['type'], key)
            if key == '1318':
                enabled = [item for item in original['widgets_values']
                           if isinstance(item, dict) and item.get('on') and 'lora' in item]
                actual = [value for name, value in compiled['inputs'].items() if name.startswith('lora_')]
                self.assertEqual(len(actual), len(enabled))
                for index, (before, after) in enumerate(zip(enabled, actual)):
                    self.assertEqual({k: v for k, v in before.items() if k != 'lora'},
                                     {k: v for k, v in after.items() if k != 'lora'})
                    if index:
                        self.assertEqual(before['lora'], after['lora'])
                continue
            widget_index = 0
            for item in original.get('inputs', []):
                name = item['name']
                expected = None
                if 'widget' in item:
                    expected = original['widgets_values'][widget_index]
                    widget_index += 1
                if item.get('link') is not None:
                    expected = resolve(links[item['link']])
                if name == 'upload' or (key, name) in exceptions:
                    continue
                if expected is not None:
                    self.assertEqual(compiled['inputs'][name], expected, f'{key}.{name}')
        self.assertEqual(graph['1322']['inputs']['value'], 1)
        self.assertEqual(graph['1323']['inputs']['value'], 0.285403)
        self.assertEqual(graph['622']['inputs']['extension'], 'jpg')
        self.assertEqual(graph['622']['inputs']['quality'], 100)
        self.assertEqual(graph['622']['inputs']['dpi'], 72)


if __name__ == '__main__':
    unittest.main()
