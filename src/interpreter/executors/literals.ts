import type { ConceptExecutor } from '../executor-registry'
import { unescapeC } from '../../core/registry/transform-registry'

export function registerLiteralExecutors(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('number_literal', async (node) => {
    const raw = String(node.properties.value)
    const num = Number(raw)
    if (raw.includes('.')) {
      return { type: 'double', value: num }
    }
    return { type: 'int', value: Math.trunc(num) }
  })

  register('string_literal', async (node) => {
    return { type: 'string', value: unescapeC(String(node.properties.value)) }
  })

  register('endl', async () => {
    return { type: 'string', value: '\n' }
  })
}
