import type { ConceptExecutor } from '../executor-registry'

export function registerLiteralExecutors(register: (concept: string, executor: ConceptExecutor) => void): void {




  register('cpp:endl', async () => {
    return { type: 'string', value: '\n' }
  })
}
