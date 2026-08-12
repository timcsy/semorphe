/** `cpp:class_def` 的 **execute** 路——從共用檔原封剪過來（批次第四批：閉包提升之後才搬得動的三顆）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { splitMember, installMethodExecutors } from '../../../languages/cpp/core/executors/structs'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  /**
     * `class C { public: … private: … };`
     *
     * 存取控制（public／private）**這一片不做**——兩區的成員一視同仁。
     * 那讓 `cpp_class_def` 從殼變成可執行，但**不代表類別支援完整了**：
     * 存取控制、繼承、虛擬函式仍然是殼，完備性報表照樣數它們。
     */
    register('cpp:class_def', async (node, ctx) => {
      installMethodExecutors(ctx)
      const name = String(node.properties.name)
      const { fields, methods, ctor, dtor, statics } = splitMember([
        ...(node.children.public ?? []),
        ...(node.children.private ?? []),
      ])
      // 存取控制（public／private）這一片仍不做——兩區一視同仁。
      ctx.structs.declare(name, fields, methods, ctor, {
        base: node.properties.base ? String(node.properties.base) : undefined,
        statics,
        dtor,
      })
    })
}
