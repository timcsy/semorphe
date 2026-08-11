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
import { 在實例上執行 } from '../../../languages/cpp/core/executors/structs'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  const 呼叫方法: ConceptExecutor = async (node, ctx) => {
    const objName = String(node.properties.obj)
    const methodName = String(node.properties.method)
    const obj = ctx.scope.get(objName)
    if (obj.type !== 'object') {
      throw new RuntimeError(RUNTIME_ERRORS.UNDECLARED_VAR, { '%1': `${objName}（不是一個物件）` })
    }
    const m = ctx.structs.method(obj.structName ?? '', methodName)
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
    return 在實例上執行(obj, m, node.children.args ?? [], ctx)
  }

  register('cpp:method_call', 呼叫方法)
}
