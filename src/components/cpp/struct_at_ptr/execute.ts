/** `cpp:struct_at_ptr` 的 **execute** 路——從共用檔原封剪過來（批次第十五批：field_expression 的分支）。 */
import type { ComponentExecutor, ExecutionContext } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { declareLvalue } from '../../../core/component/lvalue-nodes'
import { getMember } from '../../../interpreter/executors/variables'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  registerLvalue()
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

/**
 * **我可以被寫回**——透過指標寫一個欄位（`p->x = 1`／`p->x += 1`）。
 *
 * ⚠️ **解參考在解析的當下做一次**：`p` 之後被改指向別的物件時，
 * 寫回仍然要寫進**當時**那一個——與 `a[i]` 的索引同一條規則。
 */
export function registerLvalue(): void {
  declareLvalue('cpp:struct_at_ptr', async (node, ctx: ExecutionContext) => {
    const ptrName = String(node.properties.obj)
    const ptr = ctx.scope.get(ptrName)
    if (ptr.value === null || ptr.value === undefined) {
      throw new RuntimeError(RUNTIME_ERRORS.UNDECLARED_VAR, { '%1': `${ptrName}（空指標）` })
    }
    const targetName = String(ptr.value)
    const owner = ctx.pointerTargets.get(ptrName) ?? ctx.scope
    const target = owner.get(targetName)
    if (target.type !== 'object' || !(target.value instanceof Map)) {
      throw new RuntimeError(RUNTIME_ERRORS.UNDECLARED_VAR, { '%1': `${targetName}（不是一個結構）` })
    }
    const fields = target.value as Map<string, RuntimeValue>
    const member = String(node.properties.member)
    return {
      read: () => fields.get(member) ?? { type: 'int', value: 0 },
      write: (v) => { fields.set(member, v as RuntimeValue) },
    }
  })
}
