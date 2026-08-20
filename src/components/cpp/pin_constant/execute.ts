/**
 * `cpp:pin_constant` 的 **execute** 路。
 *
 * ⚠️ **這些數值是 Arduino 核心的實際定義**，不是隨手挑的：
 *
 * ```
 * HIGH 1   LOW 0            電位
 * INPUT 0  OUTPUT 1  INPUT_PULLUP 2   腳位模式
 * A0 14                     Uno 上類比腳接在數位編號 14 之後
 * ```
 *
 * 🔴 **而 `LOW` 與 `INPUT` 都是 0、`HIGH` 與 `OUTPUT` 都是 1**——那不是巧合，
 * 是 Arduino 自己就這樣定義的，而**它正是初學者最常撞到的坑**
 * （`digitalWrite(13, OUTPUT)` 編得過、跑得動、而意思是 `HIGH`）。
 * ⚠️ 本輪**不擋這個誤用**——擋它需要知道引數的角色，那是診斷系統的事。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

const PIN_CONSTANTS: Record<string, number> = {
  HIGH: 1, LOW: 0,
  INPUT: 0, OUTPUT: 1, INPUT_PULLUP: 2,
  A0: 14,
}

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:pin_constant', async (node) => {
    // ⚠️ 退路要與 component.json 宣告的 default 一致——第二十三條護欄在看
    const name = String(node.properties.value ?? 'HIGH')
    const value = PIN_CONSTANTS[name]
    // ⚠️ **判不出來就丟錯，不要回 0**——`LOW` 本身就是 0，
    // 所以「回 0」與「這個名字不認得」在下游長得一模一樣（第三十三條護欄在看這個）。
    if (value === undefined) throw new Error(`cpp:pin_constant 不認得這個名字：${JSON.stringify(name)}`)
    return { type: 'int', value }
  })
}

export { PIN_CONSTANTS }
