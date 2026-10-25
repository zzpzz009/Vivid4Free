#!/usr/bin/env node
// Read-only architecture gate. Runtime authorization is covered by the desktop
// tests; this check guards source boundaries and executable bridge mappings.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const clientRequire = createRequire(path.join(root, 'client/package.json'));
const acorn = clientRequire('acorn');
const sfc = clientRequire('@vue/compiler-sfc');
const ts = clientRequire('typescript');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const rendererAdapter = 'client/src/platform/electronHost.js';
const nativeAllowed = new Set(['desktop/preload.cjs', 'desktop/electron-adapter.cjs']);
const excludedDirectories = new Set(['node_modules', 'dist', 'ui', 'tests', '__tests__', '__mocks__']);
const counts = { rendererFiles: 0, nativeFiles: 0, vueTemplates: 0, scriptBlocks: 0, typescript: 0 };

function sourceFiles(directory, renderer = false) {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      // client/src/ui is source; desktop/ui is a generated build.
      if (excludedDirectories.has(entry.name) && !(renderer && entry.name === 'ui')) return [];
      return sourceFiles(file, renderer);
    }
    if (!/\.(?:[cm]?js|ts|vue)$/.test(entry.name) || /\.(?:test|spec)\.[^.]+$/.test(entry.name) || entry.name.endsWith('.d.ts')) return [];
    return [file];
  });
}

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(child => walk(child, visit));
    else if (value && typeof value === 'object') walk(value, visit);
  }
}

function literal(node) {
  if (node?.type === 'Literal') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked;
  if (node?.type === 'BinaryExpression' && node.operator === '+') {
    const left = literal(node.left), right = literal(node.right);
    if (typeof left === 'string' && typeof right === 'string') return left + right;
  }
  return undefined;
}

function memberName(node) {
  return node?.type === 'MemberExpression' ? node.computed ? literal(node.property) : node.property.name : undefined;
}

function electronModule(value) {
  return typeof value === 'string' && /^(?:node:)?electron(?:\/|$)/.test(value);
}

function parseScript(source, file, typescript = false) {
  if (typescript) {
    counts.typescript++;
    // Preserve value imports. Check source imports too, including type imports
    // that TypeScript necessarily removes before the Acorn syntax pass.
    const typed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const checkImports = node => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier &&
          ts.isStringLiteral(node.moduleSpecifier) && electronModule(node.moduleSpecifier.text)) {
        assert.fail(`${file}: renderer must not import Electron (including type-only imports)`);
      }
      ts.forEachChild(node, checkImports);
    };
    if (file.startsWith('client/')) checkImports(typed);
    source = ts.transpileModule(source, { compilerOptions: {
      target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, verbatimModuleSyntax: true
    } }).outputText;
  }
  try { return acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true }); }
  catch (error) { throw new Error(`${file}: JavaScript parse failed: ${error.message}`); }
}

function inspect(ast, file) {
  walk(ast, node => {
    const where = `${file}:${node.loc?.start.line || 1}`;
    if (file.startsWith('client/') && file !== rendererAdapter &&
        ((node.type === 'Identifier' && node.name === 'vividDesktop') || literal(node) === 'vividDesktop')) {
      assert.fail(`${where}: vividDesktop access belongs only in ${rendererAdapter}`);
    }
    let dependency;
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type)) dependency = literal(node.source);
    if (node.type === 'CallExpression' &&
        ((node.callee.type === 'Identifier' && node.callee.name === 'require') || memberName(node.callee) === 'require')) dependency = literal(node.arguments[0]);
    if (electronModule(dependency) && !nativeAllowed.has(file)) {
      assert.fail(`${where}: Electron dependency is only allowed in desktop/preload.cjs and desktop/electron-adapter.cjs`);
    }
  });
}

function inspectFile(file) {
  const source = read(file);
  if (!file.endsWith('.vue')) return inspect(parseScript(source, file, file.endsWith('.ts')), file);
  const { descriptor, errors } = sfc.parse(source, { filename: file, ignoreEmpty: false });
  assert.equal(errors.length, 0, `${file}: invalid Vue SFC: ${errors.join('; ')}`);
  for (const block of [descriptor.script, descriptor.scriptSetup].filter(Boolean)) {
    assert.ok(!block.src, `${file}: external Vue scripts require an explicit boundary check`);
    assert.ok(!block.lang || ['js', 'ts'].includes(block.lang), `${file}: unsupported script language ${block.lang}`);
    counts.scriptBlocks++;
    inspect(parseScript(block.content, file, block.lang === 'ts'), file);
  }
  if (descriptor.template) {
    const typescript = [descriptor.script, descriptor.scriptSetup].some(block => block?.lang === 'ts');
    const compiled = sfc.compileTemplate({ source: descriptor.template.content, filename: file, id: file,
      compilerOptions: { expressionPlugins: typescript ? ['typescript'] : [] } });
    assert.equal(compiled.errors.length, 0, `${file}: invalid Vue template: ${compiled.errors.join('; ')}`);
    inspect(parseScript(compiled.code, file, typescript), file);
    counts.vueTemplates++;
  }
}

function sameNames(actual, expected, label) {
  assert.deepEqual([...actual].sort(), [...expected].sort(), label);
}

async function checkMappings(contract) {
  assert.equal(contract.operations.length, 22, 'Contract must enumerate 22 requests');
  assert.equal(contract.events.length, 2, 'Contract must enumerate 2 events');
  const entries = [...contract.operations, ...contract.events];
  assert.equal(new Set(entries.map(item => item.name)).size, 24, 'Contract names must be unique');
  assert.equal(new Set(entries.map(item => item.channel)).size, 24, 'Contract channels must be unique');
  for (const operation of contract.operations) {
    assert.ok(['trusted-sender', 'signed-in'].includes(operation.access), `${operation.name}: invalid access classification`);
    assert.ok(Array.isArray(operation.args), `${operation.name}: missing argument signature`);
  }
  let bridge;
  const invocations = [], listeners = [], removals = [];
  const result = { contractProbe: true };
  vm.runInNewContext(read('desktop/preload.cjs'), { require: dependency => {
    assert.equal(dependency, 'electron', 'Preload must only require Electron');
    return {
      contextBridge: { exposeInMainWorld: (name, api) => { assert.equal(name, 'vividDesktop'); assert.equal(bridge, undefined); bridge = api; } },
      ipcRenderer: {
        invoke: (channel, ...args) => { invocations.push({ channel, args }); return Promise.resolve(result); },
        on: (channel, listener) => listeners.push({ channel, listener }),
        removeListener: (channel, listener) => removals.push({ channel, listener })
      }
    };
  } }, { filename: 'desktop/preload.cjs', timeout: 1000 });
  sameNames(Object.keys(bridge), entries.map(item => item.name), 'Preload API differs from manifest');
  assert.ok(Object.isFrozen(bridge), 'Preload API must be frozen');

  // Strip only parsed export prefixes, leaving actual adapter function bodies
  // intact. No Electron instance, filesystem or network is exposed to this VM.
  let adapterSource = read(rendererAdapter);
  const adapterAst = parseScript(adapterSource, rendererAdapter);
  const exports = adapterAst.body.filter(node => node.type === 'ExportNamedDeclaration');
  assert.ok(exports.every(node => node.declaration), 'Renderer adapter must use explicit declaration exports');
  for (const node of exports.reverse()) adapterSource = adapterSource.slice(0, node.start) + adapterSource.slice(node.declaration.start);
  const context = { module: { exports: {} } };
  vm.runInNewContext(`${adapterSource}\nmodule.exports = createElectronHost;`, context, { filename: rendererAdapter, timeout: 1000 });
  const host = context.module.exports(() => bridge);
  sameNames(Object.keys(host), [...entries.map(item => item.name), 'supports'], 'Renderer host API differs from manifest');
  assert.ok(Object.isFrozen(host), 'Renderer host API must be frozen');
  assert.equal(host.supports('invoke'), false, 'Arbitrary invoke must not be supported');
  for (const operation of contract.operations) {
    assert.equal(host.supports(operation.name), true, `${operation.name}: missing host capability`);
    assert.equal(host[operation.name].length, operation.args.length, `${operation.name}: renderer argument count changed`);
    assert.equal(bridge[operation.name].length, operation.args.length, `${operation.name}: preload argument count changed`);
    const args = operation.args.map((_, index) => ({ contractArgument: index }));
    const before = invocations.length;
    assert.equal(await host[operation.name](...args), result, `${operation.name}: return value changed`);
    assert.equal(invocations.length, before + 1, `${operation.name}: must invoke exactly once`);
    const call = invocations[before];
    assert.equal(call.channel, operation.channel, `${operation.name}: channel mismatch`);
    assert.equal(call.args.length, args.length, `${operation.name}: argument count mismatch`);
    args.forEach((arg, index) => assert.equal(call.args[index], arg, `${operation.name}: argument identity changed`));
  }
  for (const event of contract.events) {
    const delivered = [], payload = { contractPayload: event.name };
    const before = listeners.length, removed = removals.length;
    const stop = host[event.name]((...args) => delivered.push(args));
    assert.equal(listeners.length, before + 1, `${event.name}: must subscribe exactly once`);
    const subscription = listeners[before];
    assert.equal(subscription.channel, event.channel, `${event.name}: event channel mismatch`);
    subscription.listener({ mustNotEscape: true }, payload);
    assert.equal(delivered.length, 1);
    assert.equal(delivered[0].length, 1, `${event.name}: leaked native event`);
    assert.equal(delivered[0][0], payload);
    stop(); stop();
    assert.equal(removals.length, removed + 1, `${event.name}: unsubscribe must be idempotent`);
    assert.equal(removals[removed].channel, event.channel);
    assert.equal(removals[removed].listener, subscription.listener);
    subscription.listener({}, payload);
    assert.equal(delivered.length, 1, `${event.name}: delivered after unsubscribe`);
  }
  const nativeAst = parseScript(read('desktop/electron-adapter.cjs'), 'desktop/electron-adapter.cjs');
  const handlers = [], sends = new Set();
  walk(nativeAst, node => {
    if (node.type !== 'CallExpression') return;
    if (memberName(node.callee) === 'handle' && node.callee.object?.name === 'ipcMain') handlers.push(literal(node.arguments[0]));
    if (memberName(node.callee) === 'send') sends.add(literal(node.arguments[0]));
  });
  sameNames(handlers, contract.operations.map(item => item.channel), 'Native IPC handlers differ from manifest');
  sameNames(sends, contract.events.map(item => item.channel), 'Native event channels differ from manifest');
}

async function main() {
  const rendererFiles = sourceFiles('client/src', true);
  const nativeFiles = sourceFiles('desktop');
  rendererFiles.forEach(inspectFile);
  nativeFiles.forEach(inspectFile);
  counts.rendererFiles = rendererFiles.length;
  counts.nativeFiles = nativeFiles.length;
  await checkMappings(JSON.parse(read('contracts/shell-contract.json')));
  const packaging = JSON.parse(read('tools/installer/electron-builder.json'));
  assert.ok(packaging.files.includes('electron-adapter.cjs'), 'Installer files must include electron-adapter.cjs');
  console.log(`Shell contract PASS: ${counts.rendererFiles} renderer source files, ${counts.nativeFiles} desktop source files; tests/builds excluded.`);
  console.log(`Parsed ${counts.scriptBlocks} Vue script blocks, ${counts.vueTemplates} Vue templates, ${counts.typescript} TypeScript sources/blocks with installed parsers.`);
  console.log('Verified 22 request names/signatures/channels/argument identities and 2 event channels/payload-only/idempotent unsubscribe mappings.');
  console.log('Verified renderer/native Electron boundaries, native IPC registrations, and installer adapter inclusion. Authorization behavior is covered by desktop runtime tests.');
}

main().catch(error => { console.error(`Shell contract FAIL: ${error.message}`); process.exitCode = 1; });
