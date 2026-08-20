/**
 * `cpp:pulse_read` 的 **execute** 路——**沒接東西回 0**。
 *
 * ## 🔴 而那不是靜默降級
 *
 * 真的 `pulseIn` **在逾時之前沒有等到脈衝就回 0**。所以模擬回 0
 * ＝「這根腳位上沒有回音」——**與真板子在沒接東西時的行為一致**，
 * 不是一個為了讓程式跑完而編出來的數字。
 *
 * 先例（`digital_read/execute.ts` 檔頭）：
 * > 沒接東西的腳位讀回 0——那與真板子不同（真板子會浮動），
 * > 而**可重現比擬真重要**：一個每次讀到不同值的模擬器，測不出任何東西。
 *
 * ## ⚠️ 為什麼**不能**走 `skipPaths`
 *
 * `interpreter.ts:281` 的 `isSkipped` 是安靜 `return`——對**語句**安全，
 * 而這顆是**運算式**：`distance = pulseIn(trig, HIGH) * 0.034 / 2` 會把
 * `undefined` 餵給 `ctx.toNumber`，而它第一行就讀 `val.type`。
 *
 * > **一個對語句安全的「不執行」，對運算式是一顆未爆彈
 * > ——因為語句的回傳值沒有人接，而運算式的有。**
 *
 * 🔴 掃過 189 顆膠囊：用 `skipPaths: execute` 的 26 顆**全部是語句，零顆運算式**。
 *
 * ## 之後
 *
 * 虛擬硬體接上來時，這裡改成從腳位狀態讀真的脈衝長度（`PinState` 再加一格）。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { boardIn, requirePin } from '../../../languages/cpp/core/runtime/arduino-pins'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:pulse_read', async (node, ctx) => {
    // ⚠️ 腳位仍然要驗——超出範圍要出聲，而不是安靜地回 0。
    requirePin(ctx.toNumber(await ctx.evaluate((node.children.pin ?? [])[0])), boardIn(ctx))
    return { type: 'int', value: 0 }
  })
}
