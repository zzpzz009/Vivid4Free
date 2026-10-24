const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

// The key ships with the resource. This prevents casual copying, not reverse engineering.
const MAGIC = Buffer.from('VIVIDPK1');
function openWorkflows(file = path.join(__dirname, 'engine-data.dat')) {
  let entries;
  const read = kind => {
    if (!['render', 'upscale'].includes(kind)) throw new Error('未知工作流');
    if (!entries) {
      const bytes = fs.readFileSync(file);
      if (bytes.length < 69 || !bytes.subarray(0, 8).equals(MAGIC)) throw new Error('客户端内置资源无效');
      const decipher = crypto.createDecipheriv('aes-256-gcm', bytes.subarray(8, 40), bytes.subarray(40, 52));
      decipher.setAAD(MAGIC);
      decipher.setAuthTag(bytes.subarray(52, 68));
      const raw = zlib.inflateSync(Buffer.concat([decipher.update(bytes.subarray(68)), decipher.final()]), { maxOutputLength: 8 * 1024 * 1024 });
      entries = JSON.parse(raw.toString('utf8'));
    }
    const raw = Buffer.from(entries[kind], 'base64');
    const graph = JSON.parse(raw.toString('utf8'));
    if (!graph || !Object.keys(graph).length || Object.values(graph).some(node => !node || typeof node.class_type !== 'string' || !node.inputs || typeof node.inputs !== 'object')) throw new Error('客户端内置资源无效');
    return { graph, sha256: crypto.createHash('sha256').update(raw).digest('hex') };
  };
  return { load: kind => read(kind).graph, sha256: kind => read(kind).sha256,
    available: kind => { try { read(kind); return true; } catch { return false; } } };
}

module.exports = { openWorkflows, MAGIC };
