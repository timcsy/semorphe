/**
 * `python:global` 的 **execute** 路。
 *
 * 🔴 **它做的事是「把這個名字接到最外層」**：之後這一層的讀寫都走過去。
 * 作用域本來就有這個機制（參照別名），所以這裡不需要新的概念。
 *
 * ⚠️ **最外層還沒有那個名字時要先建**——Python 允許
 * `global x` 之後 `x = 5` 憑空造一個模組層的變數。
 * 不建的話寫回去會說「沒有這個變數」，而使用者寫的是完全正確的 Python。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { Scope } from '../../../interpreter/scope'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:global', async (node, ctx) => {
    const name = String(node.properties.name ?? '')
    let root: Scope = ctx.scope
    while (root.parent) root = root.parent
    if (root === ctx.scope) return // 已經在最外層，這個宣告不做事
    if (!root.hasLocal(name)) root.declare(name, { type: 'void', value: null })
    ctx.scope.declareRef(name, root, name)
  })
}
