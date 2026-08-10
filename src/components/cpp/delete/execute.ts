/** `cpp:delete` 的 **execute** 路——從共用檔原封剪過來（批次第一批）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:delete', async () => {})
}
