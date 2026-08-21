/**
 * `python:compare` 的 **execute** 路。
 *
 * ⚠️ **語義住在 `compare.ts`**（同一個資料夾）——同族的串接比較（`0 < x < 10`）
 * 需要一模一樣的規則，而複製一份就是兩份真相。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { comparePython } from './compare'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:compare', async (node, ctx) => {
    const op = String(node.properties.operator ?? '<')
    const l = await ctx.evaluate(node.children.left[0])
    const r = await ctx.evaluate(node.children.right[0])
    return { type: 'bool', value: comparePython(op, l, r, ctx) }
  })
}
