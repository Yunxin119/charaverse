/**
 * Cheap, provider-agnostic token estimate.
 * CJK (Han / kana / hangul / full-width punctuation) characters count 1 token each;
 * everything else counts words x 1.3. Always rounds up.
 */

const CJK_RE =
  /[ᄀ-ᇿ⺀-⿟　-〿぀-ヿ㄀-ㄯ㄰-㆏ㆠ-ㇿ㐀-䶿一-鿿ꥠ-꥿가-퟿豈-﫿︰-﹏＀-￯]/g

export function estimateTokens(text: string): number {
  if (!text) return 0
  const cjkMatches = text.match(CJK_RE)
  const cjkCount = cjkMatches ? cjkMatches.length : 0
  const rest = text.replace(CJK_RE, ' ')
  const words = rest.split(/\s+/).filter((w) => w.length > 0).length
  return cjkCount + Math.ceil(words * 1.3)
}

export function estimateMessagesTokens(messages: ReadonlyArray<{ content: string }>): number {
  let total = 0
  for (const m of messages) total += estimateTokens(m.content)
  return total
}
