/** `cpp:break` 的 **execute** 路——從共用檔原封剪過來（批次第十二批：lift 是一整筆 pattern）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { BreakSignal } from '../../../interpreter/executors/control-flow'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:break', async () => { throw new BreakSignal() })
}
