/**
 * `cpp:math_binary` 的 **lift** 路——**一顆身分涵蓋 5 個函式名**
 *
 * 與 `cpp:math_unary` 同一個處置，差在兩個引數槽。
 * 形狀的來歷見 `../math_pow/lift.ts`。
 *
 * ⚠️ **`max` / `min` 不在這張表裡**——它們是 `<algorithm>` 的，
 * 而執行器的 switch 仍認得（見 `execute.ts`）。
 */
import { registerCallComponent } from '../../../core/component/call-components'

const binaryFuncs = ['fmod', 'hypot', 'atan2', 'fmin', 'fmax']

export function registerLift(): void {
  registerCallComponent(binaryFuncs, {
    componentId: 'cpp:math_binary',
    argSlots: ['arg1', 'arg2'],
    funcProp: 'func',
    source: 'cpp/math_binary',
  })
}
