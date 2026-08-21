/**
 * `python:string_insert` 的 **execute** 路——求值 ＋ 套格式。
 *
 * ⚠️ **格式規格本身住在 `languages/python/format-spec.ts`**——
 * `"…".format(...)` 需要一模一樣的規則，而它在 2026-08-22 之前是另一份
 * （這邊只認 `.Nf`、那邊只認 `{}`）。
 *
 * 🔴 認不得的格式**丟錯**，不是靜默照原樣印：靜默的話 `f"{x:>10}"`
 * 會印出沒有補齊的字，而畫面上看不出哪裡不對。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { applyFormatSpec } from '../../../languages/python/format-spec'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:string_insert', async (node, ctx) => {
    const value = (node.children.value ?? [])[0]
    const v = value ? await ctx.evaluate(value) : { type: 'string' as const, value: '' }
    return { type: 'string', value: applyFormatSpec(v, String(node.properties.format ?? '')) }
  })
}
