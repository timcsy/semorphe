/** `cpp:struct_at_member` 的 **execute** 路——從共用檔原封剪過來（批次第十五批：field_expression 的分支）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { getMember } from '../../../interpreter/executors/variables'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
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
