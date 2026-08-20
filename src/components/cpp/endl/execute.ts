/** `cpp:endl` 的 **execute** 路——從共用檔原封剪過來（批次第三十七批）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:endl', async () => {
      return { type: 'string', value: '\n' }
    })
}
