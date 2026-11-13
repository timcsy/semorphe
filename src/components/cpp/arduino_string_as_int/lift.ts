/**
 * `cpp:arduino_string_as_int` 的 **lift** 路——「Arduino `String` 上的 `.toInt()` 是我」。
 *
 * ⚠️ 判的是接收者的型別（`liftArduinoStringReceiver`），不是方法名——見那支的檔頭。
 * 不吃引數；其他數量不認（不安靜地丟引數）。
 */
import type { SemanticNode } from '../../../core/types'
import { registerMethodBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'
import { liftArduinoStringReceiver } from '../../../languages/cpp/arduino-string'

export function registerLift(): void {
  registerMethodBranch('cpp/arduino_string_as_int', (obj, method, argChildren, ctx, objNode): SemanticNode | null => {
    if (method !== 'toInt' || argChildren.length !== 0) return null
    const recv = liftArduinoStringReceiver(obj, objNode, ctx)
    if (!recv) return null
    return createNode('cpp:arduino_string_as_int', {}, { obj: [recv] })
  })
}
