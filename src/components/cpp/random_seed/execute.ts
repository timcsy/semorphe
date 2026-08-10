/** `cpp:random_seed` 的 **execute** 路——從共用檔原封剪過來（批次第二批：lift 是 io.ts 的一個純資料分支）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:random_seed', async () => {})
}
