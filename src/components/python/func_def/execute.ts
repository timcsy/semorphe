/** `python:func_def` 的 **execute** 路——登記，不執行。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:func_def', async (node, ctx) => {
    const name = String(node.properties.name ?? 'f')
    const params = String(node.properties.params ?? '')
      .split(',').map((s) => s.trim()).filter(Boolean)
      // 型別留空 —— Python 沒有參數型別，而這個欄位是共用結構要的。
      .map((n) => ({ name: n, type: '' }))
    ctx.functions.set(name, { name, params, body: node.children.body ?? [], returnType: '' })
  })
}
