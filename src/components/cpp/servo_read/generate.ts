/** `cpp:servo_read` 的 **generate** 路。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:servo_read', (node) => {
    const obj = String(node.properties.obj ?? 'myServo')
    return `${obj}.read()`
  })
}
