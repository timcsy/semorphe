/** `cpp:func_def` 的 **execute** 路——從共用檔原封剪過來（批次第四十二批：樹根與進入點）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:func_def', async (node, ctx) => {
      const name = String(node.properties.name)
      const returnType = String(node.properties.return_type || 'void')
      const paramChildren = node.children.params ?? []
      const params = paramChildren.map(p => ({
        type: String(p.properties.type ?? 'int'),
        name: String(p.properties.name ?? ''),
      }))
      ctx.functions.set(name, {
        name,
        params,
        returnType,
        body: node.children.body ?? [],
      })
    })
}
