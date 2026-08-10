/** `cpp:array_2d_declare` 的 **execute** 路——從共用檔原封剪過來（批次第十七批：宣告子分支）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { defaultValue } from '../../../interpreter/types'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:array_2d_declare', async (node, ctx) => {
      const name = String(node.properties.name)
      const type = String(node.properties.type || 'int')
      const rows = Number(node.properties.rows || 0)
      const cols = Number(node.properties.cols || 0)

      const elements: import('../../../interpreter/types').RuntimeValue[] = []
      for (let i = 0; i < rows; i++) {
        const row: import('../../../interpreter/types').RuntimeValue[] = []
        for (let j = 0; j < cols; j++) {
          row.push(defaultValue(type))
        }
        elements.push({ type: 'array', value: row })
      }
      ctx.scope.declare(name, { type: 'array', value: elements })
    })
}
