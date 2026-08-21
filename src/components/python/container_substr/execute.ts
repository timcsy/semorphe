/**
 * `python:container_substr` 的 **execute** 路——串列與文字都切得動。
 *
 * ⚠️ **切片不會超界**：`xs[1:99]` 在 Python 回到尾巴為止，不丟錯
 * ——那與取一格（`xs[99]` 是 IndexError）**不同**，而做錯會讓學生
 * 學到一個假的規則。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:container_substr', async (node, ctx) => {
    const target = await ctx.evaluate(node.children.obj[0])
    const at = async (k: 'from' | 'to' | 'step'): Promise<number | undefined> => {
      const n = (node.children[k] ?? [])[0]
      return n ? Math.trunc(ctx.toNumber(await ctx.evaluate(n))) : undefined
    }
    const a = await at('from')
    const b = await at('to')
    const step = await at('step')
    if (step === 0) throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, { '%1': 'slice step cannot be zero' })

    const items: RuntimeValue[] | string[] =
      target.type === 'string' ? [...String(target.value)]
      : target.type === 'array' ? (target.value as RuntimeValue[])
      : null as never
    if (items) {
      const out = sliceWithStep(items as unknown[], a, b, step)
      if (target.type === 'string') return { type: 'string', value: (out as string[]).join('') }
      return { type: 'array', value: out as RuntimeValue[] }
    }
    throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `${target.type} 切不動` })
  })
}

/**
 * Python 的切片，**含步長**。
 *
 * 🔴 **負的步長是反向走**（`s[::-1]` 是反轉），而它的起點與終點預設值
 * 與正向**相反**：正向從頭到尾，負向從尾到頭。
 * ⚠️ `Array.slice` 表達不了這件事——所以這裡自己走。
 */
function sliceWithStep(xs: unknown[], from?: number, to?: number, step?: number): unknown[] {
  const n = xs.length
  const st = step ?? 1
  const norm = (v: number): number => (v < 0 ? v + n : v)
  const out: unknown[] = []
  if (st > 0) {
    const s = from === undefined ? 0 : Math.max(0, Math.min(n, norm(from)))
    const e = to === undefined ? n : Math.max(0, Math.min(n, norm(to)))
    for (let i = s; i < e; i += st) out.push(xs[i])
  } else {
    const s = from === undefined ? n - 1 : Math.max(-1, Math.min(n - 1, norm(from)))
    const e = to === undefined ? -1 : Math.max(-1, Math.min(n - 1, norm(to)))
    for (let i = s; i > e; i += st) out.push(xs[i])
  }
  return out
}
