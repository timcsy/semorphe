/**
 * `python:string_fill` 的 **execute** 路——走內建表那三份。
 *
 * 🔴 **不自己算，也不自己挑**：先問使用者定義的類別方法，再回內建表。
 * 補幾個、補在哪一邊已經寫在 `languages/python/builtins.ts`，
 * 而使用者手寫的 `.zfill(...)` 走的也是那一份。**兩份會先後錯。**
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
// 🔴 **使用者自己的類別可能也有這個方法**——`callMethod` 先問使用者定義的，再回內建表。
import { callMethod } from '../method_call/dispatch'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:string_fill', async (node, ctx) => {
    const method = String(node.properties.method ?? 'zfill')
    const self = await ctx.evaluate(node.children.obj[0])
    const args: RuntimeValue[] = [await ctx.evaluate(node.children.width[0])]
    const fill = (node.children.fill ?? [])[0]
    if (fill && method !== 'zfill') args.push(await ctx.evaluate(fill))
    return callMethod(self, method, args, ctx)
  })
}
