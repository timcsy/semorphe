/** `python:func_def` 的 **execute** 路——登記，不執行。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:func_def', async (node, ctx) => {
    const name = String(node.properties.name ?? 'f')
    // 型別留空 —— Python 沒有參數型別，而這個欄位是共用結構要的。
    const params = (node.children.params ?? [])
      .map((p) => ({ name: String(p.properties.name ?? ''), type: '' }))
      .filter((p) => p.name)
    ctx.functions.set(name, { name, params, body: node.children.body ?? [], returnType: '' })
  })
}
