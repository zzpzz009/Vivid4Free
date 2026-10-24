const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { MAGIC, openWorkflows } = require('../desktop/workflow-store.cjs');

const privateSource = () => path.resolve(process.env.VIVID_WORKFLOW_SOURCE_DIR || path.join(__dirname, '../../VividPrivate/workflows'));
function packWorkflows(source, destination) {
  const entries = {};
  for (const [kind, name] of [['render', 'preview.json'], ['upscale', 'upscale.json']]) {
    const file = path.join(source, name);
    if (!fs.existsSync(file)) throw new Error(`缺少私有工作流 ${name}；请配置 VIVID_WORKFLOW_SOURCE_DIR，详见 docs/workflow-packaging.md`);
    const raw = fs.readFileSync(file);
    const graph = JSON.parse(raw.toString('utf8'));
    if (!graph || !Object.keys(graph).length || Object.values(graph).some(node => !node || typeof node.class_type !== 'string' || !node.inputs || typeof node.inputs !== 'object')) throw new Error(`无效的 API 工作流: ${name}`);
    entries[kind] = raw.toString('base64');
  }
  const key = crypto.randomBytes(32), iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(MAGIC);
  const data = Buffer.concat([cipher.update(zlib.deflateSync(Buffer.from(JSON.stringify(entries)))), cipher.final()]);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp`;
  try {
    fs.writeFileSync(temporary, Buffer.concat([MAGIC, key, iv, cipher.getAuthTag(), data]));
    const store = openWorkflows(temporary);
    for (const kind of Object.keys(entries)) {
      if (store.sha256(kind) !== crypto.createHash('sha256').update(Buffer.from(entries[kind], 'base64')).digest('hex')) throw new Error('工作流封装校验失败');
    }
    fs.renameSync(temporary, destination);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}

if (require.main === module) {
  packWorkflows(privateSource(), path.resolve(__dirname, '../desktop/engine-data.dat'));
  console.log('私有工作流已封装，原始字节 SHA256 校验通过。');
}
module.exports = { privateSource, packWorkflows };
