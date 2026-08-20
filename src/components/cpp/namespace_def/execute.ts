/** `cpp:namespace_def` 的 **execute** 路——從共用檔原封剪過來（批次第三批：lift 是只產一種身分的具名策略）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  /**
     * `P p(42);` —— 建構式在 `func_call_expr` 的位置出現，名字就是類別名。
     *
     * 這裡只註冊「建構式的定義」不執行任何東西；真正的呼叫由 `var_declare`
     * 的初始化路徑觸發（見下）。
     */
    /** `namespace N { … }` —— 這個直譯器沒有名稱隔離，本體直接跑 */
    register('cpp:namespace_def', async (node, ctx) => {
      await ctx.executeBody(node.children.body ?? [])
    })
}
