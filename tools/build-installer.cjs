const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');

const sourceRoot = path.resolve(__dirname, '..');
let projectRoot = sourceRoot;
try {
  const top = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: sourceRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  if (path.resolve(top).toLowerCase() !== sourceRoot.toLowerCase()) throw new Error('Source is not the project Git root');
  const common = execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: sourceRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  projectRoot = path.dirname(path.resolve(sourceRoot, common));
} catch { /* Source archives build into their own release directory. */ }
const output = path.join(projectRoot, 'release', 'installer');
const desktop = path.join(sourceRoot, 'desktop');
const config = path.join(sourceRoot, 'tools', 'installer', 'electron-builder.json');
const builder = path.join(projectRoot, 'tools', 'installer', 'node_modules', 'electron-builder', 'cli.js');
const vite = path.join(sourceRoot, 'client', 'node_modules', 'vite', 'bin', 'vite.js');
const version = JSON.parse(fs.readFileSync(path.join(desktop, 'package.json'), 'utf8')).version;
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const signed = Boolean(env.CSC_LINK || env.WIN_CSC_LINK || env.VIVID_SIGNING_CERT_SHA1);
require('./generate-release-metadata.cjs').generate(true);
if (process.argv.length > 3 || (process.argv[2] && process.argv[2] !== '--check')) throw new Error('只支持无参数构建或 --check；安装包输出目录不可临时覆盖');
for (const file of [builder, vite, config]) if (!fs.existsSync(file)) throw new Error(`缺少构建依赖：${file}`);
if (process.argv[2] === '--check') {
  console.log(JSON.stringify({ sourceRoot, projectRoot, output, version, signing: signed ? 'authenticode' : 'unsigned' }, null, 2));
  process.exit(0);
}

console.log(signed ? '已配置证书，将签名并验证发行文件。' : '未配置证书，按未签名方式打包；Windows 可能提示未知发布者。');
function run(script, args, cwd) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd, env, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`构建失败（${result.status}）：${path.basename(script)}`);
}
run(vite, ['build'], path.join(sourceRoot, 'client'));
run(path.join(desktop, 'prepare-ui.cjs'), [], sourceRoot);
const signingArgs = [`--config.win.signExecutable=${signed}`, `--config.win.forceCodeSigning=${signed}`,
  ...(env.VIVID_SIGNING_CERT_SHA1 ? [`--config.win.signtoolOptions.certificateSha1=${env.VIVID_SIGNING_CERT_SHA1}`] : [])];
run(builder, ['--projectDir', desktop, '--config', config, `--config.directories.output=${output}`, ...signingArgs, '--win', 'nsis', '--x64', '--publish', 'never'], sourceRoot);

const artifact = `VividDesktop-Setup-${version}-x64.exe`;
const installer = path.join(output, artifact);
if (signed) require('../desktop/build/verify-signature.cjs').verify(installer);
const latest = path.join(output, 'VividDesktop-Setup-latest-x64.exe');
const temporary = `${latest}.tmp`;
fs.copyFileSync(installer, temporary);
fs.renameSync(temporary, latest);
let sourceCommit = null;
let sourceDirty = null;
try { sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot, encoding: 'utf8' }).trim(); } catch {}
try { sourceDirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: sourceRoot, encoding: 'utf8' }).trim()); } catch {}
const manifest = { version, installer: artifact, latest: path.basename(latest), bytes: fs.statSync(installer).size,
  sha256: crypto.createHash('sha256').update(fs.readFileSync(installer)).digest('hex'), signed, sourceCommit, sourceDirty, builtAt: new Date().toISOString() };
fs.writeFileSync(path.join(output, 'latest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`安装包固定入口：${latest}`);
