/**
 * `python:var_assign_compound` 的 **execute** 路——取值、運算、寫回。
 *
 * 🔴 **運算那一步走同族算術元件的 `apply.ts`**，不自己算：
 * `/=` 是真除法、`%=` 跟著除數的正負號、還有一個 `//=`
 * ——這四條規則這個專案各踩過一次，而**複製一份就是再踩一次的邀請**。
 *
 * ⚠️ 共用的那支複合指派執行器（C++ 在用的那個）**不能重用**：它的 `/=`
 * 是整數除法、`%=` 是 C 的取餘、而且沒有 `//=`。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { applyPythonBinary } from '../arithmetic/apply'
import type { ObjectFields, RuntimeValue } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:var_assign_compound', async (node, ctx) => {
    const name = String(node.properties.name)
    const op = String(node.properties.operator ?? '+=').replace(/=$/, '')
    const rhs = await ctx.evaluate(node.children.value[0])

    // `nums[0] += 5` —— 左邊整段被當成名字存著（lift 那側用 `text`）。
    // 🔴 **收了就要做對**：不做的話執行時說「沒有名為 `nums[0]` 的變數」
    //    ——那句話讀起來像使用者打錯字。
    const idx = /^([A-Za-z_]\w*)\[(.+)\]$/.exec(name)
    if (idx) {
      const container = ctx.scope.has(idx[1]) ? ctx.scope.get(idx[1]) : null
      if (container?.type === 'array') {
        const arr = container.value as RuntimeValue[]
        // 索引是一個字面或一個變數名——複雜的運算式還沒收（見 component.json）
        const k = /^-?\d+$/.test(idx[2])
          ? Number(idx[2])
          : ctx.scope.has(idx[2]) ? Math.trunc(ctx.toNumber(ctx.scope.get(idx[2]))) : NaN
        const at = k < 0 ? arr.length + k : k
        if (Number.isNaN(at) || at < 0 || at >= arr.length) {
          throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': idx[2] })
        }
        arr[at] = applyPythonBinary(op, arr[at], rhs, ctx)
        return
      }
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `${idx[1]} 不是一個可以用位置取的東西` })
    }

    // `self.n += k` —— 讀寫的是那個物件的欄位（與同族的單一指派同一條路）
    const dot = name.lastIndexOf('.')
    if (dot > 0) {
      const recvName = name.slice(0, dot)
      const field = name.slice(dot + 1)
      if (ctx.scope.has(recvName)) {
        const recv = ctx.scope.get(recvName)
        if (recv.type === 'object') {
          const fields = recv.value as ObjectFields
          const cur = fields.get(field)
          if (cur === undefined) throw new RuntimeError(RUNTIME_ERRORS.KEY_NOT_FOUND, { '%1': field })
          fields.set(field, applyPythonBinary(op, cur, rhs, ctx))
          return
        }
      }
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `${recvName} 不是一個可以存欄位的東西` })
    }

    ctx.scope.set(name, applyPythonBinary(op, ctx.scope.get(name), rhs, ctx))
  })
}
