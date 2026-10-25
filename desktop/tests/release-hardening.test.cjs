const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { RuntimeManager } = require('../runtime-manager.cjs');

test('manifest fallback accepts only a fully validated source and stops after success', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'vivid-feeds-'));
  try {
    const feedPath = path.join(base, 'feed.json');
    const urls = ['https://primary.example/engine.json', 'https://secondary.example/engine.json', 'https://third.example/engine.json'];
    fs.writeFileSync(feedPath, JSON.stringify({ schemaVersion: 1, manifestUrls: urls }));
    const good = require('../../updates/engine.json');
    for (const failure of [() => { throw new TypeError('network'); }, () => new Response('', { status: 503 }),
      () => new Response('<html>gateway</html>'), () => new Response('{"schemaVersion":99}'),
      () => new Response('x'.repeat(1024 * 1024 + 1)), () => { throw new DOMException('timeout', 'TimeoutError'); }]) {
      const called = [];
      const manager = new RuntimeManager({ userData: base, feedPath, env: {}, clientVersion: '0.7.1', supportedRuntimeVersions: ['0.3.2'],
        fetchImpl: async (url, options) => {
          called.push(url.href);
          assert.equal(options.redirect, 'error'); assert.ok(options.signal instanceof AbortSignal);
          return called.length === 1 ? failure() : new Response(JSON.stringify(good));
        } });
      const status = await manager.check();
      assert.deepEqual(called, urls.slice(0, 2)); assert.equal(status.availableVersion, '0.3.2');
      assert.equal(status.availableCompatible, true); assert.equal(status.updateCheckState, 'checked');
    }
    const manager = new RuntimeManager({ userData: base, feedPath, env: {}, fetchImpl: async () => { throw new Error('offline'); } });
    await assert.rejects(manager.check(), /所有更新清单来源均不可用/);
    assert.equal(manager.status().available, false);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('unsafe fallback configuration is rejected before making requests', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'vivid-feeds-'));
  try {
    for (const url of ['http://remote.example/manifest', 'https://user:password@example.com/manifest']) {
      let calls = 0;
      const manager = new RuntimeManager({ userData: base, env: { VIVID_RUNTIME_MANIFEST_URLS: `https://primary.example/manifest,${url}` },
        fetchImpl: async () => { calls++; } });
      await assert.rejects(manager.check()); assert.equal(calls, 0);
    }
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('generated compatibility files are current and missing signing credentials cannot replace an installer', () => {
  require('../../tools/generate-release-metadata.cjs').generate(true);
  const env = { ...process.env };
  for (const name of ['CSC_LINK', 'WIN_CSC_LINK', 'VIVID_SIGNING_CERT_SHA1']) delete env[name];
  const result = spawnSync(process.execPath, [path.join(__dirname, '../../tools/build-installer.cjs')], { env, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /公开发行构建需要正式代码签名证书/);
});

test('installed electron-builder resolves both signature hooks within its desktop workspace', async () => {
  const { resolveFunction } = require('../../tools/installer/node_modules/app-builder-lib/out/util/resolve.js');
  const config = require('../../tools/installer/electron-builder.json');
  const root = path.resolve(__dirname, '../..');
  const previous = process.cwd();
  process.chdir(root);
  try {
  for (const name of ['afterSign', 'artifactBuildCompleted']) {
    assert.equal(typeof await resolveFunction('commonjs', config[name], name, path.join(root, 'desktop')), 'function');
  }
  } finally { process.chdir(previous); }
});

test('the Windows verifier rejects an unsigned artifact', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'vivid-unsigned-'));
  try {
    const file = path.join(base, 'unsigned.exe'); fs.writeFileSync(file, 'unsigned fixture');
    const result = spawnSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-File', path.join(__dirname, '../build/verify-signature.ps1'), '-Path', file], { encoding: 'utf8' });
    assert.notEqual(result.status, 0); assert.match(result.stderr, /有效的受信任 Authenticode/);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});
