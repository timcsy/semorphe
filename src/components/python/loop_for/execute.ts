/**
 * `python:loop_for` 的 **execute** 路。
 *
 * ⚠️ **`range(...)` 要特別處理**：它在 Python 是一個內建函式，而這個直譯器
 * 沒有 Python 的內建函式表。認不出來的可走訪物件**丟錯，不要靜默跑零圈**
 * ——跑零圈與「這個序列是空的」長得一模一樣。
 *
 * ## 🔴 而 `for n in nums:` 一直到 2026-08-21 都跑不動
 *
 * 這一支原本**只**接受 `range(...)`，其餘一律丟錯。那在只有數字迴圈的時候
 * 是誠實的；而串列字面做出來的同一天，`for n in nums:` 就成了最自然的寫法
 * ——**使用者在瀏覽器按下執行才看到那句「我看不懂」**，而 5068 支測試全綠。
 *
 * > **一顆新元件會讓別處一條「還沒支援」的分支，從誠實變成擋路。**
 *
 * 🟢 現在走訪的是**值**不是數字：串列的每一格、字串的每一個字、字典的每一個鍵
 * （Python 的 `for k in d` 走的是鍵，不是值——做錯會讓學生學到錯的模型）。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue, ObjectFields } from '../../../interpreter/types'
import { BreakSignal, ContinueSignal } from '../../../interpreter/executors/control-flow'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { isNamedCall } from '../../../core/component/traits'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:loop_for', async (node, ctx) => {
    const name = String(node.properties.obj ?? 'i')
    const itNode = (node.children.iterable ?? [])[0]
    // 走訪的是**值**，不是數字——`range` 只是其中一種來源。
    const values: RuntimeValue[] = []

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
      for (let v = start; (step ?? 1) > 0 ? v < stop : v > stop; v += step ?? 1) {
        values.push({ type: 'int', value: v })
      }
    } else if (itNode) {
      const seq = await ctx.evaluate(itNode)
      if (seq.type === 'array' && Array.isArray(seq.value)) {
        values.push(...(seq.value as RuntimeValue[]))
      } else if (seq.type === 'string') {
        // 字串走訪的是**一個一個字**
        for (const ch of String(seq.value)) values.push({ type: 'string', value: ch })
      } else if (seq.type === 'object') {
        // 🔴 字典走的是**鍵**，不是值——`for k in d` 拿到的是 k。
        for (const k of (seq.value as ObjectFields).keys()) values.push({ type: 'string', value: k })
      } else {
        throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, {
          '%1': `這種東西走訪不了（${seq.type}）——for 只走得動串列、文字、字典與 range(...)`,
        })
      }
    } else {
      throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, {
        '%1': '這個 for 只走得動 range(...)——其餘的序列還沒支援',
      })
    }

    for (const bound of values) {
      // 🔴 每一圈都要能覆寫——`declare` 在第二圈會 `DUPLICATE_DECLARATION`。
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
