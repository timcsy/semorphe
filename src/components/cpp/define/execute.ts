/** `cpp:define` 的 **execute** 路——從共用檔原封剪過來（批次第三十五批）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { defined } from '../../../languages/cpp/core/executors/preprocessor'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:define', async (node) => {
      const name = String(node.properties.name ?? '')
      if (name) defined.add(name)
    })
}
