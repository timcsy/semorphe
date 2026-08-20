/** `python:var_ref` 的 **execute** 路——查作用域。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:var_ref', async (node, ctx) => {
    // ⚠️ **不要自己判「查不到」再丟錯**——`scope.get` 查不到時**自己會拋**，
    // 而且它拋的錯**帶近似名建議**（`int score` 打成 `scor` 時會說「你是不是要 score」）。
    // 自己先判一次等於把那個建議丟掉，而症狀是「錯誤訊息變難懂」——沒有人會發現。
    return ctx.scope.get(String(node.properties.name ?? ''))
  })
}
