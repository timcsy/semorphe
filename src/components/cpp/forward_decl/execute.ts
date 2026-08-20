/** `cpp:forward_decl` 的 **execute** 路——從共用檔原封剪過來（批次第十九批：單一建立點的建構子）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:forward_decl', async () => {
      // no-op: forward function declaration
    })
}
