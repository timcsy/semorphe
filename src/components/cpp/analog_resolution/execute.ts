/**
 * `cpp:analog_resolution` 的 **execute** 路——**今天沒有可觀察的效果**。
 *
 * ## 🔴 而那是誠實的，不是還沒做
 *
 * 它改的是 `analogRead` 的值域上限（預設 10 bit ＝ 0–1023）。
 * 而模擬的 `analogRead` 在**沒接東西時一律回 0**（見 `analog_read/execute.ts`）
 * ——解析度改成 12 bit，讀回來還是 0。**沒有差別可以觀察。**
 *
 * ## ⚠️ 為什麼不記進腳位模型
 *
 * 那會多出一格**沒有人讀**的狀態——而這個專案替那個病取過名字：
 * 「機制有了，沒人接上」。⚠️ 記一個沒有消費者的東西，比不記更糟：
 * 它看起來已經處理過了。
 *
 * ## ⚠️ 而它也不是 noop
 *
 * 沒有寫成 `skipPaths` 或空函式——那會讓「**顯式的空**」與「忘了寫」分不出來。
 * 這裡是真的執行器，它做的事是**驗參數**（位元數不合理要出聲）。
 *
 * 虛擬硬體接上來時，這裡改成記進板子層級的狀態，而 `analog_read` 讀它。
 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:analog_resolution', async (node, ctx) => {
    const bits = ctx.toNumber(await ctx.evaluate((node.children.bits ?? [])[0]))
    // ⚠️ 真板子接受 1–16（ESP32 是 9–12）。超出範圍在真板子上被夾住而不出聲，
    //    🔴 而**一個什麼都不做又不出聲的呼叫，是最難查的那種錯**（`requirePin` 檔頭同一條）。
    if (!Number.isFinite(bits) || bits < 1 || bits > 16) {
      throw new Error(`類比讀取解析度 ${bits} 不合理——真板子接受 1–16 位元（ESP32 是 9–12）`)
    }
  })
}
