/**
 * `<numeric>` 的執行路——膠囊的第五面牆。
 *
 * 在此之前這 5 個執行器**內嵌在核心執行引擎的建構式裡**，讓核心層認識了
 * 5 個 C++ 專屬的概念身分。
 *
 * 見 specs/055-finish-executor-move/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'

import { RuntimeError, RUNTIME_ERRORS } from '../../../../interpreter/errors'

/**
 * 把 `begin`／`end` 這種**字串**屬性解析回「哪個陣列、從哪到哪」。
 *
 * ⚠️ **技術債**：範圍本來就該是結構化的（`{ array, from, to }`），存成字串
 * 之後每個消費者都要自己 parse。專案教訓寫過這件事——「需要 parse 回結構
 * 才能用的字串，就不該是字串」。這裡先解析，型別結構化另外排。
 *
 * 支援 `a`、`a+3`、`a.begin()`、`a.end()`、`v.begin()+2`。
 *
 * **解析不了時擲錯，不回傳「沒事」**——原本的實作是空操作，於是
 * `sort(a, a+3)` 靜靜地什麼都不做，學生拿到未排序的陣列而毫無提示。
 */
export function resolveRange(
  ctx: { scope: { get(n: string): { type: string; value: unknown } | undefined } },
  begin: string,
  end: string,
): { arr: unknown[]; from: number; to: number; name: string } {
  const parse = (s: string): { name: string; offset: number; atEnd: boolean } => {
    const t = s.trim()
    const m = /^([A-Za-z_]\w*)\s*(?:\.\s*(begin|end)\s*\(\s*\))?\s*(?:\+\s*(\d+))?$/.exec(t)
    if (!m) throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `無法解析範圍「${s}」` })
    return { name: m[1], offset: m[3] ? parseInt(m[3], 10) : 0, atEnd: m[2] === 'end' }
  }
  const b = parse(begin)
  const e = parse(end)
  if (b.name !== e.name) {
    throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `範圍跨越兩個容器：${b.name} 與 ${e.name}` })
  }
  const v = ctx.scope.get(b.name)
  if (!v || v.type !== 'array' || !Array.isArray(v.value)) {
    throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `${b.name} 不是陣列` })
  }
  const arr = v.value as unknown[]
  return { arr, from: b.offset, to: e.atEnd ? arr.length : e.offset, name: b.name }
}

export const numOf = (x: unknown): number => Number((x as { value?: unknown })?.value ?? x) || 0

export function registerExecutors(
  _register: (concept: string, executor: ConceptExecutor) => void,
): void {


 // statement, modifies container in-place

 // statement, modifies destination container




}
