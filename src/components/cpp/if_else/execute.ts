/** `cpp:if_else` 的 **execute** 路——從共用檔原封剪過來（批次第三十批）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  /**
     * `if_else` 與 `if` 是**同一件事的兩個概念**，差別只在子節點的名字
     * （`then`／`else` vs `then_body`／`else_body`）。
     *
     * 它長期沒有執行器——有概念定義、有產生器、有積木投影（`cpp_if_else`，
     * 使用者拖得到），跑起來丟未知概念。完備性護欄的五路裡唯一的一個「缺」
     * 就是它，而我第一次看到時以為那是誤報。**實測它是真的。**
     */
    register('cpp:if_else', async (node, ctx) => {
      const condition = await ctx.evaluate(node.children.condition[0])
      await ctx.executeBody(ctx.toBool(condition) ? (node.children.then ?? []) : (node.children.else ?? []))
    })
}
