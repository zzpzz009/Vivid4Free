// Rasterize the existing vector brand into Windows icon sizes. Requires sharp.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const folder = path.join(__dirname, '../desktop/assets');
const source = fs.readFileSync(path.join(folder, 'app-icon.svg'));
const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];

(async () => {
  const frames = await Promise.all(sizes.map(size => sharp(source, { density: 384 })
    .resize(size, size).png().toBuffer()));
  const directory = Buffer.alloc(6 + sizes.length * 16);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(sizes.length, 4);
  let offset = directory.length;
  sizes.forEach((size, index) => {
    const entry = 6 + index * 16;
    directory[entry] = directory[entry + 1] = size === 256 ? 0 : size;
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(frames[index].length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += frames[index].length;
  });
  fs.writeFileSync(path.join(folder, 'app-icon.ico'), Buffer.concat([directory, ...frames]));
  fs.writeFileSync(path.join(folder, 'app-icon.png'), frames.at(-1));
  console.log(`VividDesktop icon: ${sizes.join(', ')} px; ICO + 256 px PNG refreshed.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
