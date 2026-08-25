/** `cpp:struct_at_member` 的 **execute** 路——從共用檔原封剪過來（批次第十五批：field_expression 的分支）。 */
import type { ComponentExecutor, ExecutionContext } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { declareLvalue } from '../../../core/component/lvalue-nodes'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { getMember } from '../../../interpreter/executors/variables'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  // 🔴 **與執行器同一個生命週期**——左值解析要用到執行環境，
  //    而「這種節點可以被寫回」與「這種節點怎麼求值」是同一顆元件的兩面。
  registerLvalue()

  /** `p.x` */
    register('cpp:struct_at_member', async (node, ctx) => {
      const objName = String(node.properties.obj)
      // ⚠️ **先問接點**：`v[0].first` 的 obj 是一個運算式，不是一個名字。
      // 字串屬性裝不下它（`ctx.scope.get("v[0]")` 查不到，丟 UNDECLARED_VAR）。
      // 見 `lift.ts` 的檔頭——兩種並存是刻意的。
      const objNode = (node.children.obj ?? [])[0]
      const o = objNode ? await ctx.evaluate(objNode) : ctx.scope.get(objName)
      return getMember(o, String(node.properties.member), objName, ctx.structs.staticsOf(o.structName ?? ''))
    })
}

/**
 * **我可以被寫回**——物件的一個欄位（`p.x`）。
 *
 * 🟢 **`o.x.y` 因此解得出來**：接收者是**另一顆節點**，求它的值回傳的是
 * 同一個物件（`Map` 是參照）。第一版把接收者存成字串屬性，
 * 於是 `v[0].first` 會去 `ctx.scope.get("v[0]")` 查一個不存在的名字。
 * ⚠️ 所以這裡與 `execute` 同一條規則：**先問接點**。
 */
export function registerLvalue(): void {
  declareLvalue('cpp:struct_at_member', async (node, ctx: ExecutionContext) => {
    const objNode = (node.children.obj ?? [])[0]
    const objName = String(node.properties.obj ?? '')
    const o = objNode ? await ctx.evaluate(objNode) : ctx.scope.get(objName)
    if (o.type !== 'object' || !(o.value instanceof Map)) {
      throw new RuntimeError(RUNTIME_ERRORS.UNDECLARED_VAR, { '%1': `${objName}（不是一個結構）` })
    }
    const fields = o.value as Map<string, RuntimeValue>
    const member = String(node.properties.member)
    return {
      read: () => fields.get(member) ?? { type: 'int', value: 0 },
      write: (v) => { fields.set(member, v as RuntimeValue) },
    }
  })
}
