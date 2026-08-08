/**
 * `<algorithm>` 的執行路——膠囊的第五面牆。
 *
 * 在此之前這 6 個執行器**內嵌在核心執行引擎的建構式裡**，讓核心層認識了
 * 6 個 C++ 專屬的概念身分。
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
  register('cpp:swap', async (node, ctx) => {
    const a = String(node.properties.a)
    const b = String(node.properties.b)
    const va = ctx.scope.get(a)
    const vb = ctx.scope.get(b)
    ctx.scope.set(a, vb)
    ctx.scope.set(b, va)
  })

  register('cpp:sort', async (node, ctx) => {
    const r = resolveRange(ctx as never, String(node.properties.begin), String(node.properties.end))
    const slice = r.arr.slice(r.from, r.to).sort((a, b) => numOf(a) - numOf(b))
    for (let i = 0; i < slice.length; i++) r.arr[r.from + i] = slice[i]
  })

  register('cpp:reverse', async (node, ctx) => {
    const r = resolveRange(ctx as never, String(node.properties.begin), String(node.properties.end))
    const slice = r.arr.slice(r.from, r.to).reverse()
    for (let i = 0; i < slice.length; i++) r.arr[r.from + i] = slice[i]
  })

  register('cpp:fill', async (node, ctx) => {
    const r = resolveRange(ctx as never, String(node.properties.begin), String(node.properties.end))
    const v = await ctx.evaluate((node.children.value ?? [])[0])
    for (let i = r.from; i < r.to; i++) r.arr[i] = v
  })

  register('cpp:min', async (node, ctx) => {
    const a = node.children.a?.[0]
    const b = node.children.b?.[0]
    const va = a ? await ctx.evaluate(a) : { type: 'int' as const, value: 0 }
    const vb = b ? await ctx.evaluate(b) : { type: 'int' as const, value: 0 }
    const na = ctx.toNumber(va)
    const nb = ctx.toNumber(vb)
    return na <= nb ? va : vb
  })

  register('cpp:max', async (node, ctx) => {
    const a = node.children.a?.[0]
    const b = node.children.b?.[0]
    const va = a ? await ctx.evaluate(a) : { type: 'int' as const, value: 0 }
    const vb = b ? await ctx.evaluate(b) : { type: 'int' as const, value: 0 }
    const na = ctx.toNumber(va)
    const nb = ctx.toNumber(vb)
    return na >= nb ? va : vb
  })
}
