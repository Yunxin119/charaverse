/**
 * Minimal PNG text-chunk reader/writer (browser + node, no deps).
 * Character cards travel as a PNG with a `tEXt` chunk keyed `chara` (base64 JSON);
 * v3 cards add a `ccv3` chunk. We read both and write both.
 */

const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

let crcTable: Uint32Array | null = null
function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
  }
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

export function isPng(bytes: Uint8Array): boolean {
  return bytes.length > 8 && SIG.every((b, i) => bytes[i] === b)
}

interface Chunk { type: string; data: Uint8Array; start: number; end: number }

function* chunks(bytes: Uint8Array): Generator<Chunk> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let off = 8
  while (off + 8 <= bytes.length) {
    const len = dv.getUint32(off)
    const type = String.fromCharCode(bytes[off + 4], bytes[off + 5], bytes[off + 6], bytes[off + 7])
    const dataStart = off + 8
    const end = dataStart + len + 4
    if (end > bytes.length) break
    yield { type, data: bytes.subarray(dataStart, dataStart + len), start: off, end }
    off = end
    if (type === 'IEND') break
  }
}

function latin1(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return s
}

/** All tEXt chunks as { keyword: text } (text is latin1 as stored; card payloads are base64). */
export function readTextChunks(bytes: Uint8Array): Record<string, string> {
  const out: Record<string, string> = {}
  if (!isPng(bytes)) return out
  for (const c of chunks(bytes)) {
    if (c.type !== 'tEXt') continue
    const nul = c.data.indexOf(0)
    if (nul < 0) continue
    out[latin1(c.data.subarray(0, nul))] = latin1(c.data.subarray(nul + 1))
  }
  return out
}

export function base64ToUtf8(b64: string): string {
  const bin = atob(b64.replace(/\s+/g, ''))
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  const CH = 0x8000
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH))
  return btoa(bin)
}

/** Parse the embedded card JSON from a PNG, if any (prefers v3 `ccv3`, then `chara`). */
export function readCardFromPng(bytes: Uint8Array): unknown | null {
  const texts = readTextChunks(bytes)
  for (const key of ['ccv3', 'chara']) {
    const raw = texts[key]
    if (!raw) continue
    try {
      return JSON.parse(base64ToUtf8(raw))
    } catch {
      continue
    }
  }
  return null
}

function makeTextChunk(keyword: string, text: string): Uint8Array {
  const kw = new TextEncoder().encode(keyword)
  const body = Uint8Array.from(text, (ch) => ch.charCodeAt(0) & 0xff)
  const data = new Uint8Array(kw.length + 1 + body.length)
  data.set(kw, 0)
  data[kw.length] = 0
  data.set(body, kw.length + 1)
  const typeAndData = new Uint8Array(4 + data.length)
  typeAndData.set([0x74, 0x45, 0x58, 0x74], 0) // tEXt
  typeAndData.set(data, 4)
  const out = new Uint8Array(4 + typeAndData.length + 4)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, data.length)
  out.set(typeAndData, 4)
  dv.setUint32(4 + typeAndData.length, crc32(typeAndData))
  return out
}

/**
 * Return a new PNG with the given text chunks written right before IEND
 * (existing chunks with the same keywords are removed first).
 */
export function writeTextChunks(bytes: Uint8Array, texts: Record<string, string>): Uint8Array {
  if (!isPng(bytes)) throw new Error('不是 PNG 文件')
  const keep: Uint8Array[] = [bytes.subarray(0, 8)]
  let iend: Uint8Array | null = null
  for (const c of chunks(bytes)) {
    const raw = bytes.subarray(c.start, c.end)
    if (c.type === 'IEND') { iend = raw; break }
    if (c.type === 'tEXt') {
      const nul = c.data.indexOf(0)
      const kw = nul >= 0 ? latin1(c.data.subarray(0, nul)) : ''
      if (kw in texts) continue
    }
    keep.push(raw)
  }
  for (const [k, v] of Object.entries(texts)) keep.push(makeTextChunk(k, v))
  if (iend) keep.push(iend)
  const total = keep.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const p of keep) { out.set(p, off); off += p.length }
  return out
}
