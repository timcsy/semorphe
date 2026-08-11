/** `cpp:literal_string` 的 **execute** 路——從共用檔原封剪過來（批次第三十六批：字面值與二元運算子）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { unescapeC } from '../../../core/registry/transform-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:literal_string', async (node) => {
      return { type: 'string', value: unescapeC(String(node.properties.value)) }
    })
}
