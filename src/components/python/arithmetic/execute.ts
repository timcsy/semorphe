/**
 * `python:arithmetic` 的 **execute** 路。
 *
 * 🔴 **語義住在 `apply.ts`**（同一個資料夾）——因為複合指派（`total += i`）
 * 需要一模一樣的規則，而**複製一份就是兩份真相**。
 * 那份檔頭記著這四條規則各自是怎麼被實測踩出來的。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { applyPythonBinary } from './apply'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:arithmetic', async (node, ctx) => {
    const op = String(node.properties.operator ?? '+')
    const l = await ctx.evaluate(node.children.left[0])
    const r = await ctx.evaluate(node.children.right[0])
    return applyPythonBinary(op, l, r, ctx)
  })
}
