/**
 * `python:map_iter` 的 **execute** 路——走內建表那一份。
 *
 * 🔴 **不自己算，也不自己挑**：先問使用者定義的類別方法，再回內建表。
 * 規則已經寫在 `languages/python/builtins.ts`，
 * 而使用者手寫的同一個方法走的也是那一份。**兩份會先後錯。**
 *
 * ⚠️ 而**使用者自己的類別有同名方法時要讓路**——那個順序住在同族的
 * 方法分派那一份，不在這裡重寫一遍。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { callMethod } from '../method_call/dispatch'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:map_iter', async (node, ctx) => {
    const self = await ctx.evaluate(node.children.obj[0])
    const args: RuntimeValue[] = []

    return callMethod(self, String(node.properties.kind ?? 'items'), args, ctx)
  })
}
