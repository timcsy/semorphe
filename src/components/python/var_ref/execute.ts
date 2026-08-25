/**
 * `python:var_ref` 的 **execute** 路——查作用域，查不到再問「它是不是一個函式」。
 *
 * 🔴 **Python 的函式是值**：`sorted(w, key=len)`／`sorted(w, key=score)` 裡的
 * 那個裸名不是變數，而作用域裡當然查不到它。錯誤訊息會是
 * `UNDECLARED_VAR: len`——看起來像「你打錯字了」，而使用者寫的是完全正確的 Python。
 */
import type { ComponentExecutor, ExecutionContext } from '../../../interpreter/executor-registry'
import { declareLvalue } from '../../../core/component/lvalue-nodes'
import { funcValueOf } from '../func_def/call'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  registerLvalue()
  register('python:var_ref', async (node, ctx) => {
    // ⚠️ **不要自己判「查不到」再丟錯**——`scope.get` 查不到時**自己會拋**，
    // 而且它拋的錯**帶近似名建議**（`int score` 打成 `scor` 時會說「你是不是要 score」）。
    // 自己先判一次等於把那個建議丟掉，而症狀是「錯誤訊息變難懂」——沒有人會發現。
    const name = String(node.properties.name ?? '')
    // ⚠️ 順序：**變數優先**——`len = 3` 之後那個名字就是變數了
    if (!ctx.scope.has(name)) {
      const fn = funcValueOf(name, ctx)
      if (fn) return fn
    }
    return ctx.scope.get(name)
  })
}

/**
 * **我可以被寫回**——一個名字（`x`），寫回作用域。
 *
 * ⚠️ 這裡**不走 `funcValueOf` 那條退路**：`len += 1` 的左邊就是要一個變數，
 * 而內建函式不是位置。`scope.get` 查不到時自己會拋（帶近似名建議）。
 */
export function registerLvalue(): void {
  declareLvalue('python:var_ref', async (node, ctx: ExecutionContext) => {
    const name = String(node.properties.name ?? '')
    return {
      read: () => ctx.scope.get(name),
      write: (v) => { ctx.scope.set(name, v as never) },
    }
  })
}
