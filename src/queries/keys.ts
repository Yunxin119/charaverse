/** Centralized query keys so invalidation stays consistent. */
export const qk = {
  profile: (userId: string) => ['profile', userId] as const,
  characters: (userId: string) => ['characters', userId] as const,
  character: (id: number | string) => ['character', String(id)] as const,
  publicCharacters: (params: Record<string, unknown>) => ['characters', 'public', params] as const,
  sessions: (userId: string) => ['sessions', userId] as const,
  session: (id: string) => ['session', id] as const,
  messages: (sessionId: string) => ['messages', sessionId] as const,
}
