import { isPng, readCardFromPng, utf8ToBase64, writeTextChunks } from './png'
import { importCardJson, toCharaverseCard, toCommonCardV2, type ExportSource, type ImportedCard } from './convert'

/**
 * Browser-side download / file-reading helpers for character cards.
 * Pure conversions live in ./convert and ./png; this file only touches DOM APIs.
 */

const CANVAS_SIZE = 512
// Fallback cover colours when the character has no usable avatar (oxblood / cream, see docs §5.1).
const FALLBACK_BG = '#41140e'
const FALLBACK_FG = '#f2dece'

function safeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').trim().slice(0, 80)
  return cleaned || '角色'
}

export function downloadText(name: string, text: string, mime = 'application/json'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  downloadBlob(name, blob)
}

export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Lossless CharaVerse JSON → `<name>.card.json`. */
export function downloadCharacterJson(character: ExportSource): void {
  const card = toCharaverseCard(character)
  downloadText(`${safeFileName(character.name)}.card.json`, JSON.stringify(card, null, 2))
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error('生成 PNG 失败'))
      resolve(new Uint8Array(await blob.arrayBuffer()))
    }, 'image/png')
  })
}

/** 512×512 poster-style cover: solid background + the first character of the name. */
async function generateCoverPng(name: string): Promise<Uint8Array> {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_SIZE
  canvas.height = CANVAS_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('浏览器不支持 canvas')
  ctx.fillStyle = FALLBACK_BG
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
  ctx.fillStyle = FALLBACK_FG
  ctx.font = `600 ${Math.round(CANVAS_SIZE * 0.48)}px "Fraunces", "Playfair Display", Georgia, "Songti SC", serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const initial = Array.from(name.trim())[0] ?? '?'
  ctx.fillText(initial, CANVAS_SIZE / 2, CANVAS_SIZE / 2 + CANVAS_SIZE * 0.03)
  return canvasToPngBytes(canvas)
}

/** Re-encode arbitrary image bytes as PNG via an <img> + canvas round-trip (throws when the image cannot be decoded). */
async function reencodeAsPng(blob: Blob): Promise<Uint8Array> {
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('图片解码失败'))
      el.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth || CANVAS_SIZE
    canvas.height = img.naturalHeight || CANVAS_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('浏览器不支持 canvas')
    ctx.drawImage(img, 0, 0)
    return await canvasToPngBytes(canvas)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Fetch the avatar and make sure we end up with PNG bytes; any failure falls back to a generated cover. */
async function avatarPngBytes(character: ExportSource): Promise<Uint8Array> {
  const url = character.avatar_url
  if (url) {
    try {
      const res = await fetch(url, { mode: 'cors' })
      if (res.ok) {
        const blob = await res.blob()
        const bytes = new Uint8Array(await blob.arrayBuffer())
        if (isPng(bytes)) return bytes
        return await reencodeAsPng(blob)
      }
    } catch {
      // cross-origin / network failure → generated cover below
    }
  }
  return generateCoverPng(character.name)
}

/** Common card v2 embedded in a PNG `chara` chunk → `<name>.png`. */
export async function downloadCharacterPng(character: ExportSource): Promise<void> {
  const base = await avatarPngBytes(character)
  const payload = utf8ToBase64(JSON.stringify(toCommonCardV2(character)))
  const out = writeTextChunks(base, { chara: payload })
  downloadBlob(`${safeFileName(character.name)}.png`, new Blob([out as BlobPart], { type: 'image/png' }))
}

export type ReadCardResult = { card: ImportedCard; avatarFile?: File; raw: unknown } | { error: string }

const MAX_CARD_BYTES = 20 * 1024 * 1024

/** Parse a picked `.png` or `.json` card file. PNG cards carry their image back as `avatarFile`. */
export async function readCardFile(file: File): Promise<ReadCardResult> {
  if (file.size > MAX_CARD_BYTES) return { error: `文件过大（${Math.round(file.size / 1024 / 1024)} MB，上限 ${MAX_CARD_BYTES / 1024 / 1024} MB）` }
  const isPngFile = file.type === 'image/png' || /\.png$/i.test(file.name)
  if (isPngFile) {
    let bytes: Uint8Array
    try {
      bytes = new Uint8Array(await file.arrayBuffer())
    } catch {
      return { error: '读取文件失败' }
    }
    if (!isPng(bytes)) return { error: '不是有效的 PNG 文件' }
    const raw = readCardFromPng(bytes)
    if (raw === null) return { error: '这张 PNG 里没有角色卡数据' }
    const card = importCardJson(raw)
    if (!card) return { error: '无法识别 PNG 内嵌的角色卡格式' }
    return { card, avatarFile: file, raw }
  }
  let text: string
  try {
    text = await file.text()
  } catch {
    return { error: '读取文件失败' }
  }
  return readCardText(text)
}

/** Parse pasted / file JSON text. */
export function readCardText(text: string): ReadCardResult {
  const trimmed = text.trim()
  if (!trimmed) return { error: '内容是空的' }
  let raw: unknown
  try {
    raw = JSON.parse(trimmed)
  } catch {
    return { error: 'JSON 解析失败，请检查格式' }
  }
  const card = importCardJson(raw)
  if (!card) return { error: '无法识别的角色卡格式（支持 CharaVerse 卡与通用角色卡 v1 / v2 / v3）' }
  return { card, raw }
}
