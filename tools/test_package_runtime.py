"""Isolated release-tool checks; fixture bytes do not represent a working CF."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
import sys
from unittest.mock import patch
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
import package_runtime as package


class PackageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / 'cf'
        self.assets = {
            'python/python.exe': b'fixture, not executable',
            'python/python312.zip': b'fixture stdlib',
            'comfyui/main.py': b'fixture',
            'custom_nodes/vivid_nodes/__init__.py': b'fixture',
            'llama/llama-server.exe': b'fixture',
            'models/exact.safetensors': b'original fixture model',
        }
        for name, data in self.assets.items():
            file = self.source / name
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(data)
        (self.root / 'tools').mkdir()
        (self.root / 'tools/start_comfy.py').write_text('fixture')
        (self.root / 'workflows').mkdir()
        for kind in ('preview', 'upscale'):
            (self.root / f'workflows/{kind}.json').write_text('{}')
        for name, value in [('ROOT', self.root), ('MODEL_FILES', ('exact.safetensors',)), ('NODE_PACKS', ('vivid_nodes',))]:
            context = patch.object(package, name, value)
            context.start()
            self.addCleanup(context.stop)

    def test_release_requires_both_original_outputs_and_complete_profile(self):
        self.assertFalse(package.prerequisites(self.source, None)['ready'])
        report = {'runtimeProtocol': 1, 'runtimeRoot': str(self.source),
                  'customNodePacks': ['vivid_nodes'], 'modelFiles': ['exact.safetensors'], 'workflows': {}}
        for kind in ('preview', 'upscale'):
            output = self.root / f'{kind}.png'
            output.write_bytes(b'test fixture, not actual render evidence')
            report['workflows'][kind] = {'passed': True, 'workflowSha256': package.sha256(self.root / f'workflows/{kind}.json'),
                                         'output': str(output), 'outputSha256': package.sha256(output)}
        file = self.root / 'acceptance.json'
        file.write_text(json.dumps(report))
        self.assertTrue(package.prerequisites(self.source, file)['ready'])
        (self.root / 'preview.png').write_bytes(b'changed')
        self.assertFalse(package.prerequisites(self.source, file)['ready'])

    def test_zip_profile_hashes_match_contents_and_excludes_partial_cache(self):
        partial = self.source / 'models/original.gguf.part'
        partial.write_bytes(b'incomplete')
        archive = package.create(self.source, 'fixture-1', 'https://example.invalid/cf.zip', self.root / 'out',
                                 node_packs=('vivid_nodes',), models=('exact.safetensors',))
        manifest = json.loads(Path(archive['manifest']).read_text())
        self.assertEqual(manifest['archive']['sha256'], package.sha256(Path(archive['archive'])))
        with zipfile.ZipFile(archive['archive']) as bundle:
            self.assertNotIn('models/original.gguf.part', bundle.namelist())
            internal = json.loads(bundle.read('runtime.json'))
            self.assertEqual(internal['customNodePacks'], ['vivid_nodes'])
            for item in internal['files']:
                content = bundle.read(item['path'])
                self.assertEqual(item['bytes'], len(content))
                self.assertEqual(item['sha256'], hashlib.sha256(content).hexdigest())
        with self.assertRaises(FileExistsError):
            package.create(self.source, 'fixture-1', 'https://example.invalid/cf.zip', self.root / 'out',
                           node_packs=('vivid_nodes',), models=('exact.safetensors',))

    def test_local_archive_contains_workflows_without_inventing_hosted_feed(self):
        result = package.create(self.source, 'local-fixture', None, self.root / 'local',
                                node_packs=('vivid_nodes',), models=('exact.safetensors',))
        self.assertIsNone(result['manifest'])
        self.assertIsNone(result['url'])
        self.assertFalse(list((self.root / 'local').glob('*.json')))
        with zipfile.ZipFile(result['archive']) as bundle:
            self.assertIn('workflows/preview.json', bundle.namelist())
            self.assertIn('workflows/upscale.json', bundle.namelist())
            self.assertEqual(json.loads(bundle.read('runtime.json'))['id'], 'vivid-comfy')

    def test_release_rejects_unsafe_version_url_and_source_output(self):
        for version, url, out in (
                ('../escape', 'https://example.invalid/cf.zip', self.root / 'out'),
                ('v1', 'file:///cf.zip', self.root / 'out'),
                ('v1', 'https://user:secret@example.invalid/cf.zip', self.root / 'out'),
                ('v1', 'https://example.invalid/cf.zip', self.source / 'out')):
            with self.assertRaises(ValueError):
                package.create(self.source, version, url, out, node_packs=('vivid_nodes',), models=('exact.safetensors',))


if __name__ == '__main__':
    unittest.main()
