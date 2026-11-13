/**
 * `cpp:arduino_string_trim` 的 **lift** 路——「Arduino `String` 上的 `.trim()` 是我」。
 *
 * ⚠️ 判的是接收者的型別（`liftArduinoStringReceiver`），不是方法名——見那支的檔頭。
 * `trim()` 不吃引數；帶了引數就不是它（不安靜地丟引數）。
 */
import type { SemanticNode } from '../../../core/types'
import { registerMethodBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'
import { liftArduinoStringReceiver } from '../../../languages/cpp/arduino-string'

export function registerLift(): void {
  registerMethodBranch('cpp/arduino_string_trim', (obj, method, argChildren, ctx, objNode): SemanticNode | null => {
    if (method !== 'trim' || argChildren.length !== 0) return null
    const recv = liftArduinoStringReceiver(obj, objNode, ctx)
    if (!recv) return null
    return createNode('cpp:arduino_string_trim', {}, { obj: [recv] })
  })
}
