/**
 * `python:return` 的 **execute** 路——**丟訊號，不是回值**。
 *
 * ⚠️ 第一版寫成 `return value`，而 `executeBody` 會把它丟掉
 * ——症狀是 `print(add(2, 3))` 印出 `None`：**函式跑完了、值算對了，
 * 而它從來沒有離開那個函式**。
 *
 * > **「回傳」在語義樹裡表達不出來**——它是一條跳離目前這段的邊，
 * > 而樹只有父子關係。所以直譯器用丟訊號代替（`break`／`continue` 同理）。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { ReturnSignal } from '../../../interpreter/executors/functions'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:return', async (node, ctx) => {
    const kid = (node.children.value ?? [])[0]
    // 沒有值的 `return` 回 void —— 那正是 Python 的 `None`。
    throw new ReturnSignal(kid ? await ctx.evaluate(kid) : { type: 'void', value: null })
  })
}
