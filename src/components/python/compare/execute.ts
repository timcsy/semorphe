/**
 * `python:compare` 的 **execute** 路。
 *
 * ⚠️ **語義住在 `languages/python/compare.ts`**——串接比較與排序需要一模一樣的
 * 規則，而排序的消費者在內建函式表那一側。複製一份就是兩份真相。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
// ⚠️ **語義住在語言套件裡**（`languages/python/compare.ts`）——串接比較與
//    排序要一模一樣的規則，而排序在內建函式表那一側。
import { comparePython } from '../../../languages/python/compare'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:compare', async (node, ctx) => {
    const op = String(node.properties.operator ?? '<')
    const l = await ctx.evaluate(node.children.left[0])
    const r = await ctx.evaluate(node.children.right[0])
    return { type: 'bool', value: comparePython(op, l, r, ctx) }
  })
}
