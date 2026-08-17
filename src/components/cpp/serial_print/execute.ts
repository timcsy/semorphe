/**
 * `cpp:serial_print` 的 **execute** 路——🔴 **接【現有的】主控台**。
 *
 * `ctx.io` 是 `cpp:print`（`cout`）與 `cpp:print_formatted`（`printf`）
 * 走的同一個出口。**不新開面板**——序列埠監控視窗與主控台在教學上是同一件事，
 * 而多開一個面板會讓學生要看兩個地方。
 *
 * ⚠️ 而三顆概念宣告了同一個 `ioRole: 'print'`：那是**一條等價邊**，
 * 不是「剛好都會輸出」。
 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { valueToString } from '../../../interpreter/types'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:serial_print', async (node, ctx) => {
    const value = (node.children.value ?? [])[0]
    if (value) ctx.io.write(valueToString(await ctx.evaluate(value)))
    if (String(node.properties.newline ?? 'true') === 'true') ctx.io.writeNewline()
  })
}
