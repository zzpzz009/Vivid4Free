"""Compare the executable graph against source values and resolved source links."""
import json
import unittest
import sys
from pathlib import Path

import os
sys.path.insert(0, str(Path(os.environ.get('VIVID_WORKFLOW_SOURCE_DIR', Path(__file__).resolve().parents[2] / 'VividPrivate/workflows')).parent / 'tools'))
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

        added = {'9100', '9101', '9102', '9103', '9104', '9105', '9106',
                 '9200', '9201', '9202', '9203', '9205', '9206', '9207', '9210'}
        self.assertEqual(set(graph) - set(nodes), added)
        exceptions = {('536', 'image'), ('605', 'image'), ('622', 'show_previews'),
                      ('1294', 'sigmas'), ('1298', 'samples'), ('1330', 'text_a')}
        for key, compiled in graph.items():
            if key in added:
                continue
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
                    authorized = {'lora', 'strength'} if index else {'lora'}
                    self.assertEqual({k: v for k, v in before.items() if k not in authorized},
                                     {k: v for k, v in after.items() if k not in authorized})
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

    def test_main_analysis_and_scene_switch_use_current_image(self):
        graph = compile_graph()
        self.assertNotIn('1329', graph)
        for key in ('9200', '9201'):
            self.assertEqual(graph[key]['class_type'], 'VividLocalCaption')
            self.assertEqual(graph[key]['inputs']['image'], ['1293', 0])
            self.assertTrue(graph[key]['inputs']['prompt'])
        self.assertEqual(graph['1293']['inputs']['image'], ['1279', 0])
        self.assertEqual(graph['1279']['inputs']['image'], ['536', 0])
        self.assertEqual(graph['760']['inputs']['image'], ['735', 0])
        self.assertEqual(graph['9205']['inputs']['on_true'], ['9203', 3])
        self.assertEqual(graph['9205']['inputs']['on_false'], ['9206', 0])
        self.assertEqual(graph['9203']['inputs']['text1'], ['9201', 0])
        self.assertEqual(graph['9203']['inputs']['text2'], ['9207', 0])
        self.assertEqual(graph['9210']['inputs']['text1'], ['9202', 0])
        self.assertEqual(graph['9210']['inputs']['text2'], ['9205', 0])
        self.assertEqual(graph['1330']['inputs']['text_a'], ['9210', 3])
        self.assertEqual(graph['1330']['inputs']['text_b'], ['762', 0])

    def test_first_step_only_continues_the_same_four_step_schedule(self):
        graph = compile_graph()
        self.assertEqual(graph['1307']['inputs']['steps'], 4)
        self.assertEqual(graph['1280']['inputs']['sampler_name'], 'euler')
        self.assertEqual(graph['9100'], {'class_type': 'SplitSigmas', 'inputs': {'sigmas': ['1307', 0], 'step': 1}})
        self.assertEqual(graph['1294']['inputs']['sigmas'], ['9100', 0])
        self.assertEqual(graph['9106']['inputs']['sigmas'], ['9100', 1])
        self.assertEqual(graph['9106']['inputs']['latent_image'], ['1294', 0])
        self.assertEqual(graph['9105']['class_type'], 'DisableNoise')
        self.assertEqual(graph['9106']['inputs']['noise'], ['9105', 0])
        self.assertEqual(graph['1298']['inputs']['samples'], ['9106', 0])
        early, late = graph['1318']['inputs'], graph['9101']['inputs']
        self.assertTrue(early['lora_1']['on'])
        self.assertTrue(early['lora_1']['lora'].endswith('vivid_klein_v1.4_000076275.safetensors'))
        self.assertEqual(early['lora_1']['strength'], 1)
        self.assertEqual(late['model'], early['model'])
        self.assertEqual(late['clip'], early['clip'])
        self.assertEqual(late['lora_2'], early['lora_2'])
        self.assertEqual([v['lora'] for k, v in late.items() if k.startswith('lora_') and v['on']], ['klein\\Klein 一致性增强.safetensors'])
        self.assertTrue(early['lora_2']['on'])
        self.assertEqual(late['lora_2']['strength'], .7)
        self.assertEqual(graph['9104']['inputs']['positive'], graph['1308']['inputs']['positive'])
        self.assertEqual(graph['9104']['inputs']['negative'], graph['1308']['inputs']['negative'])
        self.assertEqual(graph['9102']['inputs']['shift'], 3.1)
        self.assertEqual(graph['9103']['inputs']['strength'], 1)
        self.assertEqual(graph['9104']['inputs']['cfg'], 1)
        self.assertEqual(graph['760']['class_type'], 'VividLocalCaption')


if __name__ == '__main__':
    unittest.main()
