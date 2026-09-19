/** `cpp:struct_at_member` 的 **execute** 路——從共用檔原封剪過來（批次第十五批：field_expression 的分支）。 */
import type { ComponentExecutor, ExecutionContext } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { declareLvalue } from '../../../core/component/lvalue-nodes'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { getMember } from '../../../interpreter/executors/variables'
import { resolveAlias } from '../../../interpreter/aliases'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  // 🔴 **與執行器同一個生命週期**——左值解析要用到執行環境，
  //    而「這種節點可以被寫回」與「這種節點怎麼求值」是同一顆元件的兩面。
  registerLvalue()

  /** `p.x` */
    register('cpp:struct_at_member', async (node, ctx) => {
      // 🟢 **接收者一律是接點**（2026-08-26）——混合形狀退場，字串回退跟著消失。
      const objNode = (node.slots.obj ?? [])[0]
      if (!objNode) throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': '這個取成員沒有接收者' })
      const o = await ctx.evaluate(objNode)
      const objName = String(objNode.properties?.name ?? '')
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
    const objNode = (node.slots.obj ?? [])[0]
    if (!objNode) throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': '這個取成員沒有接收者' })
    const o = await ctx.evaluate(objNode)
    const objName = String(objNode.properties?.name ?? '')
    if (o.type !== 'object' || !(o.value instanceof Map)) {
      /**
       * 🔴 **訊息要說得出是誰**（2026-09-19）。接收者不是一個變數時
       * `objName` 是空字串，於是這句話變成「（不是一個結構）」
       * ——一個連主詞都沒有的句子。
       */
      throw new RuntimeError(RUNTIME_ERRORS.UNDECLARED_VAR, {
        '%1': `${objName || objNode.componentId}.${String(node.properties.member)}`
          + ` —— 接收者不是一個結構（它是 ${o.type}）`,
      })
    }
    const fields = o.value as Map<string, RuntimeValue>
    // 🔴 **寫的那一側也要認別名**（`#define x first`）——只認讀的話，
    //    `A[i].x = 7` 會在這個 Map 上長出一個叫 `x` 的新欄位，
    //    而 `A[i].first` 讀到的還是舊值。症狀是「改了沒反應」，比拋錯難查。
    const rawMember = String(node.properties.member)
    const member = fields.has(rawMember) ? rawMember : resolveAlias(rawMember)
    return {
      read: () => fields.get(member) ?? { type: 'int', value: 0 },
      write: (v) => { fields.set(member, v as RuntimeValue) },
    }
  })
}
