/**
 * `python:loop_for` 的 **execute** 路。
 *
 * ⚠️ **`range(...)` 要特別處理**：它在 Python 是一個內建函式，而這個直譯器
 * 沒有 Python 的內建函式表。認不出來的可走訪物件**丟錯，不要靜默跑零圈**
 * ——跑零圈與「這個序列是空的」長得一模一樣。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { BreakSignal, ContinueSignal } from '../../../interpreter/executors/control-flow'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { isNamedCall } from '../../../core/component/traits'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:loop_for', async (node, ctx) => {
    const name = String(node.properties.obj ?? 'i')
    const itNode = (node.children.iterable ?? [])[0]
    const values: number[] = []

    // 🔴 **問性狀，不看身分**——`namedCall` 的意思是「`properties.name` 是被呼叫的名字」，
    // 而這一段只需要那件事。寫死另一顆元件的身分會讓就近性護欄兩個方向都報，
    // 而**更實際的代價是：那顆元件改名時這裡不會有人發現**。
    if (itNode && isNamedCall(itNode.componentId) && itNode.properties.name === 'range') {
      const args = itNode.children.args ?? []
      const nums: number[] = []
      for (const a of args) nums.push(ctx.toNumber(await ctx.evaluate(a)))
      const [start, stop, step] =
        nums.length === 1 ? [0, nums[0], 1] : nums.length === 2 ? [nums[0], nums[1], 1] : nums
      if ((step ?? 1) === 0) throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, { '%1': 'range 的步長是 0' })
      for (let v = start; (step ?? 1) > 0 ? v < stop : v > stop; v += step ?? 1) values.push(v)
    } else {
      throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, {
        '%1': '這個 for 只走得動 range(...)——其餘的序列還沒支援',
      })
    }

    for (const v of values) {
      // 🔴 每一圈都要能覆寫——`declare` 在第二圈會 `DUPLICATE_DECLARATION`。
      const bound = { type: 'int' as const, value: v }
      if (ctx.scope.has(name)) ctx.scope.set(name, bound)
      else ctx.scope.declare(name, bound)
      try {
        await ctx.executeBody(node.children.body ?? [])
      } catch (signal) {
        if (signal instanceof BreakSignal) break
        if (signal instanceof ContinueSignal) continue
        throw signal
      }
    }
  })
}
