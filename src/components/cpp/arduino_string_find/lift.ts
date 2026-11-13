/**
 * `cpp:arduino_string_find` 的 **lift** 路——「Arduino `String` 上的 `.indexOf()` 是我」。
 *
 * ⚠️ 判的是接收者的型別（`liftArduinoStringReceiver`），不是方法名——見那支的檔頭。
 * 引數 1–2 個；其他數量不認（不安靜地丟引數）。
 */
import type { SemanticNode } from '../../../core/types'
import { registerMethodBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'
import { liftArduinoStringReceiver } from '../../../languages/cpp/arduino-string'

export function registerLift(): void {
  registerMethodBranch('cpp/arduino_string_find', (obj, method, argChildren, ctx, objNode): SemanticNode | null => {
    if (method !== 'indexOf' || argChildren.length < 1 || argChildren.length > 2) return null
    const recv = liftArduinoStringReceiver(obj, objNode, ctx)
    if (!recv) return null
    const slots: Record<string, SemanticNode[]> = { obj: [recv] }
    const names = ['arg', 'from']
    for (let i = 0; i < names.length; i++) {
      const a = argChildren[i] ? ctx.lift(argChildren[i]) : null
      if (argChildren[i] && !a) return null
      slots[names[i]] = a ? [a] : []
    }
    return createNode('cpp:arduino_string_find', {}, slots)
  })
}
