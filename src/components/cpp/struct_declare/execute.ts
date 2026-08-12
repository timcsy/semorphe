/** `cpp:struct_declare` 的 **execute** 路——從共用檔原封剪過來（批次第四批：閉包提升之後才搬得動的三顆）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import type { FieldDecl } from '../../../interpreter/struct-types'
import { installMethodExecutors } from '../../../languages/cpp/core/executors/structs'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:struct_declare', async (node, ctx) => {
      installMethodExecutors(ctx)
      const name = String(node.properties.name)
      const fields: FieldDecl[] = []
      for (const m of node.children.members ?? []) {
        const fname = m.properties?.name
        if (fname === undefined) continue
        fields.push({ name: String(fname), type: String(m.properties?.type ?? 'int') })
      }
      ctx.structs.declare(name, fields)
    })
}
