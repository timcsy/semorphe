/**
 * `python:with` 的 **execute** 路——**進去、跑、保證收尾**。
 *
 * ## 這一顆做得到的與做不到的
 *
 * ```
 * 🟢 使用者自己寫的資源類別    __enter__ / __exit__ 兩個方法都會被呼叫
 * 🟢 收尾保證                 主體丟例外時 __exit__ 照樣跑（try / finally）
 * 🔴 檔案                     `open` 不在內建表裡——這個工具沒有檔案系統
 * ```
 *
 * ⚠️ **最常見的那個用法（`with open(...) as f`）會在算那個運算式時就出聲**：
 * 使用者看到「沒有這個函式 open」——**那句話是真的**，而它指的正是真正缺的東西。
 *
 * > **認得出形狀而做不到行為時，要在【執行的那一刻】說為什麼
 * > ——不是在抬升的時候假裝不認得。**
 *
 * ⚠️ **沒有 `__enter__` 的東西這裡不報錯**（真的 Python 會）：綁的是那個值本身。
 * 那是一個**已知的寬鬆**——它讓 `with 一個普通的值 as x` 跑得動而不是炸掉，
 * 代價是初學者少看到一個錯誤訊息。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { callMethod } from '../method_call/dispatch'

const NONE: RuntimeValue = { type: 'void', value: null }

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:with', async (node, ctx) => {
    const resource = await ctx.evaluate(node.children.value[0])
    const has = (m: string): boolean =>
      resource.type === 'object' && !!resource.structName && ctx.functions.has(`${resource.structName}.${m}`)

    const bound = has('__enter__') ? await callMethod(resource, '__enter__', [], ctx) : resource
    const name = String(node.properties.name ?? '').trim()
    if (name) {
      if (ctx.scope.hasLocal(name)) ctx.scope.set(name, bound)
      else ctx.scope.declare(name, bound)
    }
    try {
      await ctx.executeBody(node.children.body ?? [])
    } finally {
      // 🔴 **收尾在 finally**——主體丟例外時它照樣要跑，那正是 `with` 存在的理由
      if (has('__exit__')) await callMethod(resource, '__exit__', [NONE, NONE, NONE], ctx)
    }
  })
}
