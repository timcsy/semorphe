/** `cpp:struct_at_ptr` 的 **execute** 路——從共用檔原封剪過來（批次第十五批：field_expression 的分支）。 */
import type { ComponentExecutor, ExecutionContext } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { declareLvalue } from '../../../core/component/lvalue-nodes'
import { getMember } from '../../../interpreter/executors/variables'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

/**
 * 🔴 **這個直譯器有兩種指標，而 `->` 原本只認得其中一種。**
 *
 * ```
 * 符號式   &x        value 是被指變數的【名字】，配一張 pointerTargets
 * 實體式   new T     value 是真的那塊儲存體（一個陣列）＋ offset
 * ```
 *
 * 在此之前這裡無條件走符號式：`String(ptr.value)` 對一塊陣列得到
 * `"[object Object]"`，然後 `scope.get(...)` 丟出
 * **「變數 `[object Object]` 尚未宣告」**——訊息離原因非常遠。
 *
 * > **一個只認得一半的解參考，把「另一種指標」的每一次使用
 * > 都變成一則指著不存在的變數名的錯誤。**
 */
function resolveTarget(
  ptr: RuntimeValue,
  ptrName: string,
  ctx: ExecutionContext,
): { target: RuntimeValue; name: string } {
  if (ptr.type === 'array' && Array.isArray(ptr.value)) {
    const cells = ptr.value as RuntimeValue[]
    const off = ptr.offset ?? 0
    return { target: cells[off], name: `${ptrName}[${off}]` }
  }
  const targetName = String(ptr.value)
  const owner = ctx.pointerTargets.get(ptrName) ?? ctx.scope
  return { target: owner.get(targetName), name: targetName }
}

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
      const { target, name: targetName } = resolveTarget(ptr, ptrName, ctx)
      return getMember(target, String(node.properties.member), targetName, ctx.structs.staticsOf(target?.structName ?? ''))
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
    const { target, name: targetName } = resolveTarget(ptr, ptrName, ctx)
    if (target?.type !== 'object' || !(target.value instanceof Map)) {
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
