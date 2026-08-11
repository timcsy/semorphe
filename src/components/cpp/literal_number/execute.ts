/** `cpp:literal_number` 的 **execute** 路——從共用檔原封剪過來（批次第三十六批：字面值與二元運算子）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:literal_number', async (node) => {
      const raw = String(node.properties.value)
      const num = Number(raw)
      if (raw.includes('.')) {
        return { type: 'double', value: num }
      }
      return { type: 'int', value: Math.trunc(num) }
    })
}
