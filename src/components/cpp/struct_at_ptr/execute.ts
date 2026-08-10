/** `cpp:struct_at_ptr` 的 **execute** 路——從共用檔原封剪過來（批次第十五批：field_expression 的分支）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { getMember } from '../../../interpreter/executors/variables'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  /** `p->x` */
    register('cpp:struct_at_ptr', async (node, ctx) => {
      const ptrName = String(node.properties.obj)
      const ptr = ctx.scope.get(ptrName)
      if (ptr.value === null || ptr.value === undefined) {
        // 對空指標取成員在真的 C++ 會當掉。**出聲**，不要靜默回預設值。
        throw new RuntimeError(RUNTIME_ERRORS.UNDECLARED_VAR, { '%1': `${ptrName}（空指標）` })
      }
      const targetName = String(ptr.value)
      const owner = ctx.pointerTargets.get(ptrName) ?? ctx.scope
      const target = owner.get(targetName)
      return getMember(target, String(node.properties.member), targetName, ctx.structs.staticsOf(target.structName ?? ''))
    })
}
