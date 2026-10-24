const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { packWorkflows } = require('../../tools/build-workflows.cjs');
const { openWorkflows } = require('../workflow-store.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vivid-sealed-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'private'); fs.mkdirSync(source);
  const bytes = {};
  for (const [kind, name] of [['render', 'preview.json'], ['upscale', 'upscale.json']]) {
    bytes[kind] = Buffer.from(JSON.stringify({ '1': { class_type: 'FixtureOnly', inputs: { value: `私有-${kind}` } } }, null, 2) + '\r\n');
    fs.writeFileSync(path.join(source, name), bytes[kind]);
  }
  return { root, source, bytes, output: path.join(root, 'client/engine-data.dat') };
}

test('sealed resources preserve exact bytes and isolate per-task mutations without plaintext output', t => {
  const { root, source, bytes, output } = fixture(t);
  packWorkflows(source, output);
  const store = openWorkflows(output), packed = fs.readFileSync(output);
  for (const kind of ['render', 'upscale']) {
    assert.equal(store.sha256(kind), crypto.createHash('sha256').update(bytes[kind]).digest('hex'));
    assert.deepEqual(store.load(kind), JSON.parse(bytes[kind]));
    store.load(kind)['1'].inputs.value = 'changed';
    assert.equal(store.load(kind)['1'].inputs.value, `私有-${kind}`);
    assert.equal(packed.includes(Buffer.from(`私有-${kind}`)), false);
  }
  assert.deepEqual(fs.readdirSync(path.join(root, 'client')), ['engine-data.dat']);
  assert.throws(() => store.load('../preview'), /未知工作流/);
});

test('missing or corrupt resources fail closed and never use nearby plaintext templates', t => {
  const { root, source, output } = fixture(t);
  const missing = openWorkflows(output);
  assert.equal(missing.available('render'), false);
  assert.throws(() => missing.load('render'));
  packWorkflows(source, output);
  const bytes = fs.readFileSync(output); bytes[bytes.length - 1] ^= 1; fs.writeFileSync(output, bytes);
  fs.copyFileSync(path.join(source, 'preview.json'), path.join(root, 'client/preview.json'));
  const corrupt = openWorkflows(output);
  assert.equal(corrupt.available('render'), false);
  assert.throws(() => corrupt.load('render'));
});

test('missing private input aborts packaging and retains the previous valid resource', t => {
  const { source, output } = fixture(t);
  packWorkflows(source, output);
  const before = fs.readFileSync(output);
  fs.unlinkSync(path.join(source, 'upscale.json'));
  assert.throws(() => packWorkflows(source, output), /VIVID_WORKFLOW_SOURCE_DIR/);
  assert.deepEqual(fs.readFileSync(output), before);
});
