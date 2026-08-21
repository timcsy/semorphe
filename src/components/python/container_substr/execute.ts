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
    const at = async (k: 'from' | 'to'): Promise<number | undefined> => {
      const n = (node.children[k] ?? [])[0]
      return n ? Math.trunc(ctx.toNumber(await ctx.evaluate(n))) : undefined
    }
    const a = await at('from')
    const b = await at('to')

    if (target.type === 'string') return { type: 'string', value: String(target.value).slice(a, b) }
    if (target.type === 'array') return { type: 'array', value: (target.value as RuntimeValue[]).slice(a, b) }
    throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `${target.type} 切不動` })
  })
}
