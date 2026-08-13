/**
 * `cpp:method_call` 的 **execute** 路
 *
 * ⚠️ 它原本是 `structs.ts` 裡一個叫 `呼叫方法` 的**閉包**，被兩個位置共用
 * （敘述版與運算式版）。閉包本身沒有捕捉任何東西——它用到的
 * `在實例上執行` 是模組層級的函式，所以提升的代價只是**加一個 export**。
 *
 * > **共用的是演算法（在實例上執行一個方法），不是身分。**
 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { runOnInstance } from '../../../languages/cpp/core/executors/structs'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  const callMethod: ConceptExecutor = async (node, ctx) => {
    const objName = String(node.properties.obj)
    const methodName = String(node.properties.method)
    const obj = ctx.scope.get(objName)
    if (obj.type !== 'object') {
      throw new RuntimeError(RUNTIME_ERRORS.UNDECLARED_VAR, { '%1': `${objName}（不是一個物件）` })
    }
    const m = ctx.structs.method(obj.structName ?? '', methodName)
    if (!m) {
      // **無參數的取值方法，而值就存在同名欄位裡** —— `e.what()`。
      //
      // 標準例外（`cpp:exception_make`）把訊息存成一個叫 `what` 的欄位，
      // 因為**替它造一個方法本體要在膠囊裡寫死別顆元件的身分**
      // （`cpp:return` ＋ `cpp:struct_at_member` 的節點），而就近性護欄會報。
      //
      // ⚠️ 範圍很窄，所以它不會掩蓋「方法打錯字」：
      // **必須無引數、且必須真的有那個同名欄位**——兩者有一個不成立就照樣丟錯。
      //
      // > **一個退路的安全性不在它退到哪裡，在它的入口條件有多窄。**
      const args = node.children.args ?? []
      if (args.length === 0 && obj.value instanceof Map && obj.value.has(methodName)) {
        return obj.value.get(methodName)!
      }
    }
    if (!m) {
      // 出聲，不靜默略過——打錯方法名的程式會跑完而什麼都沒做
      throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, {
        '%1': `${obj.structName ?? '?'}::${methodName}`,
      })
    }
    if (m.pure) {
      // 純虛擬沒有本體。靜默回傳的話，忘了覆寫的程式會跑完而什麼都沒做。
      throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, {
        '%1': `${obj.structName ?? '?'}::${methodName}（純虛擬，沒有實作）`,
      })
    }
    return runOnInstance(obj, m, node.children.args ?? [], ctx)
  }

  register('cpp:method_call', callMethod)
}
