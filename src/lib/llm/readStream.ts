/**
 * Read an AI SDK UI message stream (SSE `data: {...}` lines) and hand text deltas to a callback.
 * Resolves with the full text; `error` carries the stream's own error event when there was one.
 */
export async function readUiTextStream(
  body: ReadableStream<Uint8Array>,
  onDelta?: (full: string, delta: string) => void,
): Promise<{ text: string; error: string | null }> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let full = ''
  let error: string | null = null
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      let chunk: { type: string; delta?: string; errorText?: string }
      try { chunk = JSON.parse(payload) } catch { continue }
      if (chunk.type === 'text-delta' && chunk.delta) {
        full += chunk.delta
        onDelta?.(full, chunk.delta)
      } else if (chunk.type === 'error') {
        error = chunk.errorText || 'AI 调用失败'
      }
    }
  }
  return { text: full, error }
}
