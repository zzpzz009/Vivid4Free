import fs from 'node:fs'

function readFileHead(filePath, maxBytes) {
  const fd = fs.openSync(filePath, 'r')
  try {
    const stat = fs.fstatSync(fd)
    const size = Math.min(stat.size, maxBytes)
    const buf = Buffer.alloc(size)
    fs.readSync(fd, buf, 0, size, 0)
    return buf
  } finally {
    fs.closeSync(fd)
  }
}

function readUInt24LE(buf, offset) {
  return buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16)
}

function parsePng(buf) {
  if (buf.length < 24) return null
  if (buf.readUInt32BE(0) !== 0x89504e47) return null
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  if (!width || !height) return null
  return { width, height }
}

function parseGif(buf) {
  if (buf.length < 10) return null
  const sig = buf.toString('ascii', 0, 3)
  if (sig !== 'GIF') return null
  const width = buf.readUInt16LE(6)
  const height = buf.readUInt16LE(8)
  if (!width || !height) return null
  return { width, height }
}

function parseBmp(buf) {
  if (buf.length < 26) return null
  if (buf.toString('ascii', 0, 2) !== 'BM') return null
  const width = buf.readInt32LE(18)
  const height = Math.abs(buf.readInt32LE(22))
  if (!width || !height) return null
  return { width, height }
}

function parseWebp(buf) {
  if (buf.length < 30) return null
  if (buf.toString('ascii', 0, 4) !== 'RIFF') return null
  if (buf.toString('ascii', 8, 12) !== 'WEBP') return null
  const chunk = buf.toString('ascii', 12, 16)
  if (chunk === 'VP8X') {
    const width = 1 + readUInt24LE(buf, 24)
    const height = 1 + readUInt24LE(buf, 27)
    if (!width || !height) return null
    return { width, height }
  }
  return null
}

function parseJpeg(buf) {
  if (buf.length < 4) return null
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null
  let offset = 2
  const isSof = (marker) =>
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)

  while (offset + 4 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset++
      continue
    }
    while (offset < buf.length && buf[offset] === 0xff) offset++
    if (offset >= buf.length) break
    const marker = buf[offset]
    offset++
    if (marker === 0xd9 || marker === 0xda) break
    if (offset + 2 > buf.length) break
    const segmentLength = buf.readUInt16BE(offset)
    if (segmentLength < 2) break
    if (isSof(marker)) {
      if (offset + 7 > buf.length) break
      const height = buf.readUInt16BE(offset + 3)
      const width = buf.readUInt16BE(offset + 5)
      if (!width || !height) return null
      return { width, height }
    }
    offset += segmentLength
  }
  return null
}

export function readImageMetaFromFile(filePath) {
  const buf = readFileHead(filePath, 256 * 1024)
  const meta =
    parsePng(buf) ||
    parseJpeg(buf) ||
    parseGif(buf) ||
    parseWebp(buf) ||
    parseBmp(buf)
  if (!meta) return null
  const aspectRatio = meta.width && meta.height ? meta.width / meta.height : null
  return { width: meta.width, height: meta.height, aspectRatio }
}

