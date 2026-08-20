/**
 * `cpp:tone` 的 **execute** 路——**寫進腳位狀態，零輸出**。
 *
 * 🔴 為什麼不印到主控台：`ctx.io` 是**程式的輸出**，學生的 `Serial.println` 走同一條。
 * > **把模擬器的旁白寫進程式的輸出，會讓程式的輸出變成錯的
 * > ——而輸出比對是這個專案量正確性的方式之一。**
 *
 * 先例是 `analog_write/execute.ts`：它也只寫狀態，不說話。
 *
 * ⚠️ **已知後果**：學生按執行，蜂鳴器什麼都不會發生。
 * 那是**視圖層**的缺口（板子視圖，階段 6.11 第 4 項，已推遲），不是這一層該補的。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { boardIn, requirePin, stateOf } from '../../../languages/cpp/core/runtime/arduino-pins'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:tone', async (node, ctx) => {
    const pin = requirePin(ctx.toNumber(await ctx.evaluate((node.children.pin ?? [])[0])), boardIn(ctx))
    const hz = ctx.toNumber(await ctx.evaluate((node.children.frequency ?? [])[0]))
    const state = stateOf(ctx, pin)
    if (state.mode === undefined) state.writtenBeforeMode = true
    state.toneHz = hz
    // ⚠️ **沒有第三個引數與「發聲 0 毫秒」要分得出來**——前者是 `undefined`（一直響）。
    const durNode = (node.children.duration ?? [])[0]
    state.toneMs = durNode ? ctx.toNumber(await ctx.evaluate(durNode)) : undefined
  })
}
