/** `cpp:member_static` 的 **execute** 路——從共用檔原封剪過來（批次第三十批）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:member_static', async () => {})
}
