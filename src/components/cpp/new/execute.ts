/** `cpp:new` 的 **execute** 路——從共用檔原封剪過來（批次第三批：lift 是只產一種身分的具名策略）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:new', async (node) => {
      return { type: 'pointer' as any, value: `heap_${node.properties.type ?? 'int'}` }
    })
}
