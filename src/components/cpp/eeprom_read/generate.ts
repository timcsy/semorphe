/** `cpp:eeprom_read` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:eeprom_read', (node, ctx) => {
    const address = generateExpression((node.children.address ?? [])[0], ctx)
    return `EEPROM.read(${address})`
  })
}
