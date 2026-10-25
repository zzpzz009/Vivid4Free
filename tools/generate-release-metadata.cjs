const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

function outputs() {
  const source = read('updates/release-source.json');
  const info = read('release-info.json');
  const version = read('desktop/package.json').version;
  assert.equal(source.schemaVersion, 1);
  assert.ok(source.policy.supportedRuntimeVersions.includes(source.engine.version));
  assert.ok(source.engine.compatibleClientVersions.includes(version), 'Declare the current client compatibility in the release source');
  assert.equal(source.engine.clientRelease.version, version);
  const engine = { ...source.engine, clientRelease: { ...source.engine.clientRelease,
    supportedRuntimeVersions: source.policy.supportedRuntimeVersions } };
  info.runtime.supportedRuntimeVersions = source.policy.supportedRuntimeVersions;
  info.runtime.compatibilityNote = source.policy.note;
  return { 'desktop/client-runtime-policy.json': source.policy, 'updates/engine.json': engine, 'release-info.json': info };
}

function generate(check = false) {
  for (const [file, value] of Object.entries(outputs())) {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    if (check) assert.equal(fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n'), content, `${file} is stale; run node tools/generate-release-metadata.cjs`);
    else {
      const target = path.join(root, file);
      const newline = fs.readFileSync(target, 'utf8').includes('\r\n') ? '\r\n' : '\n';
      fs.writeFileSync(target, content.replace(/\n/g, newline));
    }
  }
}
if (require.main === module) { generate(process.argv.includes('--check')); console.log('Release compatibility metadata is synchronized'); }
module.exports = { generate };
