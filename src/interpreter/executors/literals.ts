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

  register('builtin_constant', async (node) => {
    const value = String(node.properties.value)
    switch (value) {
      case 'true': return { type: 'int', value: 1 }
      case 'false': return { type: 'int', value: 0 }
      case 'EOF': return { type: 'int', value: -1 }
      case 'NULL': case 'nullptr': return { type: 'int', value: 0 }
      case 'INT_MAX': return { type: 'int', value: 2147483647 }
      case 'INT_MIN': return { type: 'int', value: -2147483648 }
      case 'LLONG_MAX': return { type: 'int', value: Number.MAX_SAFE_INTEGER }
      case 'LLONG_MIN': return { type: 'int', value: Number.MIN_SAFE_INTEGER }
      default: return { type: 'int', value: 0 }
    }
  })

  register('endl', async () => {
    return { type: 'string', value: '\n' }
  })
}
