/**
 * `python:container_at` 的 **execute** 路——串列、字典、字串各一種取法。
 *
 * 🔴 **取不到就丟錯，不回預設值**：Python 的 `nums[99]` 是 IndexError、
 * `d["沒有"]` 是 KeyError。回一個 0 或空字串的話，錯誤會被帶到下一步去算，
 * 而畫面上看不出哪裡開始錯的。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue, ObjectFields } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:container_at', async (node, ctx) => {
    const target = await ctx.evaluate(node.children.target[0])
    const key = await ctx.evaluate(node.children.key[0])

    if (target.type === 'object') {
      const fields = target.value as ObjectFields
      const k = String(key.value)
      const got = fields.get(k)
      if (got === undefined) throw new RuntimeError(RUNTIME_ERRORS.KEY_NOT_FOUND, { '%1': k })
      return got
    }

    // 串列與字串共用「負數從尾巴算」的規則（Python 的 `a[-1]`）
    const len = target.type === 'string' ? String(target.value).length : (target.value as RuntimeValue[]).length
    let i = Math.trunc(ctx.toNumber(key))
    if (i < 0) i += len
    if (i < 0 || i >= len) throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(key.value) })
    if (target.type === 'string') return { type: 'string', value: String(target.value)[i] }
    return (target.value as RuntimeValue[])[i]
  })
}
