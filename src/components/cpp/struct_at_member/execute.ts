/** `cpp:struct_at_member` 的 **execute** 路——從共用檔原封剪過來（批次第十五批：field_expression 的分支）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { getMember } from '../../../interpreter/executors/variables'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  /** `p.x` */
    register('cpp:struct_at_member', async (node, ctx) => {
      const objName = String(node.properties.obj)
      const o = ctx.scope.get(objName)
      return getMember(o, String(node.properties.member), objName, ctx.structs.staticsOf(o.structName ?? ''))
    })
}
