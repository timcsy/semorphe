/**
 * `cpp:method_call` 的 **execute** 路
 *
 * ⚠️ 它原本是 `structs.ts` 裡一個叫 `呼叫方法` 的**閉包**，被兩個位置共用
 * （敘述版與運算式版）。閉包本身沒有捕捉任何東西——它用到的
 * `在實例上執行` 是模組層級的函式，所以提升的代價只是**加一個 export**。
 *
 * > **共用的是演算法（在實例上執行一個方法），不是身分。**
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { runOnInstance } from '../../../languages/cpp/lang/executors/structs'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  /**
   * **標準串流的設定方法——在我們的模型裡是 no-op。**
   *
   * 🔴 它從真實的學生程式來（2026-09-16，218 支裡 6 支撞到）：
   *    `ios::sync_with_stdio(0), cin.tie(0); … cin.ignore();`
   *    ——`cin` 不在作用域裡，於是 `scope.get('cin')` 直接拋 UNDECLARED_VAR，
   *    **整支程式停掉**。
   *
   * ⚠️ 為什麼 `ignore` 也算 no-op：我們的 stdin 是**一串 token／行**，
   *    不是字元流。`cin >> n` 吃掉一個 token 之後，「這一行剩下的東西」
   *    本來就不在路上了——所以什麼都不做才是對的。
   *
   * 🔴 **白名單是刻意窄的**：會【讀走東西】的方法（`get`／`peek`／`getline`／
   *    `read`）**不在裡面**，它們要繼續報錯。
   *
   * > **一個「忽略掉不認識的東西」的放行，與一個「這幾個我知道可以忽略」的白名單，
   * > 差別在前者會把「它其實讀走了一個字」也一起忽略掉。**
   */
  const STREAMS = new Set(['cin', 'cout', 'cerr', 'clog', 'ios', 'ios_base'])
  const NOOP_METHODS = new Set([
    'tie', 'ignore', 'sync_with_stdio', 'precision', 'setf', 'unsetf',
    'flush', 'clear', 'rdbuf', 'exceptions', 'width', 'fill',
  ])

  const callMethod: ComponentExecutor = async (node, ctx) => {
    const objName = String(node.properties.obj)
    const methodName = String(node.properties.method)
    if (STREAMS.has(objName) && NOOP_METHODS.has(methodName)) {
      // ⚠️ 回傳 `cin` 自己——`cin.tie(0)` 在 C++ 裡回傳的是一個串流，
      //    而鏈式寫法（`cin.tie(0)->sync…`）靠它。
      return { type: 'object', structName: objName, value: new Map() }
    }
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
      const args = node.slots.args ?? []
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
    return runOnInstance(obj, m, node.slots.args ?? [], ctx)
  }

  register('cpp:method_call', callMethod)
}
