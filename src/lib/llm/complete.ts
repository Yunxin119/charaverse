import 'server-only'
import { generateText, type ModelMessage } from 'ai'
import { resolveModel } from './providers'
import type { Connection } from './connection'

export interface CompleteInput {
  connection: Connection
  instructions?: string
  messages: ModelMessage[]
  sampling?: { temperature?: number; top_p?: number; max_tokens?: number }
  timeoutMs?: number
}

/** Non-streaming completion for background jobs (summaries, diaries, memory extraction). */
export async function completeText(input: CompleteInput): Promise<{ text: string; model: string }> {
  const { model, label } = resolveModel(input.connection)
  const result = await generateText({
    model,
    instructions: input.instructions || undefined,
    messages: input.messages,
    allowSystemInMessages: true,
    temperature: input.sampling?.temperature ?? 1,
    topP: input.sampling?.top_p,
    maxOutputTokens: input.sampling?.max_tokens ?? 4096,
    abortSignal: AbortSignal.timeout(input.timeoutMs ?? 110_000),
    maxRetries: 1,
  })
  return { text: result.text, model: label }
}
