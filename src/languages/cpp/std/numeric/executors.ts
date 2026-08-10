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
function resolveRange(
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

const numOf = (x: unknown): number => Number((x as { value?: unknown })?.value ?? x) || 0

export function registerExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  /**
   * `accumulate(v.begin(), v.end(), init)`
   *
   * ⚠️ **原本是 `async () => ({ type: 'int', value: 0 })`**——一個回傳固定值的
   * 空實作，於是每一個用 `accumulate` 的程式都得到 0 而毫無提示。
   *
   * 而這個殼**就寫在這個檔案裡**「解析不了時擲錯，不回傳『沒事』」
   * 那句話的下面兩行——同一個檔案同時記著教訓與教訓的反例。
   */
  register('cpp:range_sum', async (node, ctx) => {
    const r = resolveRange(ctx as never, String(node.properties.begin), String(node.properties.end))
    const init = (node.children.init ?? [])[0]
    let sum = init ? ctx.toNumber(await ctx.evaluate(init)) : 0
    for (let i = r.from; i < r.to; i++) sum += numOf(r.arr[i])
    return { type: 'int' as const, value: sum }
  })

  register('cpp:range_fill_sequence', async (node, ctx) => {
    const r = resolveRange(ctx as never, String(node.properties.begin), String(node.properties.end))
    const start = ctx.toNumber(await ctx.evaluate((node.children.value ?? [])[0]))
    for (let i = r.from; i < r.to; i++) r.arr[i] = { type: 'int', value: start + (i - r.from) }
  }) // statement, modifies container in-place

  register('cpp:range_sum_partial', async (node, ctx) => {
    const r = resolveRange(ctx as never, String(node.properties.begin), String(node.properties.end))
    const dest = resolveRange(ctx as never, String(node.properties.dest), String(node.properties.dest))
    let acc = 0
    for (let i = r.from; i < r.to; i++) {
      acc += numOf(r.arr[i])
      dest.arr[dest.from + (i - r.from)] = { type: 'int', value: acc }
    }
  }) // statement, modifies destination container

  register('cpp:math_gcd', async (node, ctx) => {
    const a = node.children.a?.[0]
    const b = node.children.b?.[0]
    const va = a ? ctx.toNumber(await ctx.evaluate(a)) : 0
    const vb = b ? ctx.toNumber(await ctx.evaluate(b)) : 0
    const gcd = (x: number, y: number): number => y === 0 ? x : gcd(y, x % y)
    return { type: 'int' as const, value: gcd(Math.abs(va), Math.abs(vb)) }
  })

  register('cpp:math_lcm', async (node, ctx) => {
    const a = node.children.a?.[0]
    const b = node.children.b?.[0]
    const va = a ? ctx.toNumber(await ctx.evaluate(a)) : 0
    const vb = b ? ctx.toNumber(await ctx.evaluate(b)) : 0
    const gcd = (x: number, y: number): number => y === 0 ? x : gcd(y, x % y)
    const g = gcd(Math.abs(va), Math.abs(vb))
    return { type: 'int' as const, value: g === 0 ? 0 : Math.abs(va * vb) / g }
  })
}
