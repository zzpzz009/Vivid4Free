const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const source = path.resolve(__dirname, '../client/dist');
const destination = path.join(__dirname, 'ui');
const { privateSource, packWorkflows } = require('../tools/build-workflows.cjs');
const archiveRoot = path.join(__dirname, 'tests/.tmp');

function tree(directory) {
  const result = [];
  const walk = (base, prefix = '') => {
    for (const item of fs.readdirSync(base, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${item.name}` : item.name;
      const full = path.join(base, item.name);
      if (item.isSymbolicLink()) throw new Error(`不允许复制链接: ${full}`);
      if (item.isDirectory()) walk(full, relative);
      else if (item.isFile()) result.push(relative);
      else throw new Error(`不支持复制特殊文件: ${full}`);
    }
  };
  walk(directory); return result.sort();
}
function sameTree(sourceDir, targetDir, selectedFiles = tree(sourceDir)) {
  if (!fs.existsSync(targetDir) || !fs.existsSync(sourceDir)) return false;
  const a = selectedFiles, b = tree(targetDir);
  return JSON.stringify(a) === JSON.stringify(b) && a.every(file => fs.readFileSync(path.join(sourceDir, file)).equals(fs.readFileSync(path.join(targetDir, file))));
}
function archiveExisting(directory, label) {
  if (!fs.existsSync(directory)) return null;
  fs.mkdirSync(archiveRoot, { recursive: true });
  const archive = path.join(archiveRoot, `${label}-${Date.now()}-${crypto.randomUUID()}`);
  fs.renameSync(directory, archive); return archive;
}
function refresh(sourceDir, destinationDir, label, select) {
  if (!fs.existsSync(sourceDir)) throw new Error(`缺少源目录: ${sourceDir}`);
  const files = select(tree(sourceDir));
  if (sameTree(sourceDir, destinationDir, files)) return false;
  const previous = archiveExisting(destinationDir, label);
  try {
    fs.mkdirSync(destinationDir, { recursive: true });
    for (const file of files) {
      const from = path.join(sourceDir, file), to = path.join(destinationDir, file);
      fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
    }
  } catch (error) {
    if (fs.existsSync(destinationDir)) fs.rmSync(destinationDir, { recursive: true, force: true });
    if (previous) fs.renameSync(previous, destinationDir);
    throw error;
  }
  return true;
}

if (!fs.existsSync(path.join(source, 'index.html'))) throw new Error(`前端尚未构建：缺少 ${path.join(source, 'index.html')}`);
refresh(source, destination, 'ui-archive', files => files);
packWorkflows(privateSource(), path.join(__dirname, 'engine-data.dat'));
// Retain any pre-migration copies only in the ignored rollback directory.
archiveExisting(path.join(__dirname, 'workflows'), 'legacy-workflows');
process.stdout.write('Desktop UI and sealed engine resource refreshed safely.\n');
