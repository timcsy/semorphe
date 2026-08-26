/**
 * `cpp:raw_code` 的 **execute** 路——**出聲，不要靜默略過**
 *
 * 這顆裝的是**辨識不出來的原始程式碼**。執行它等於執行一段沒有語義的文字，
 * 而那件事做不到——所以它**停在這裡**（2026-08-26），與未知元件同一條路：
 * 指到那一顆、打開變數、等一個決定。
 *
 * 🪦 這裡本來寫著「丟一個**可被 `unknownComponentHandler` 接管**的錯誤……
 * 使用者可以選擇跳過或中止」——⚠️ **那條路從來沒有真的接起來**：
 * 丟出去的錯不會被任何 handler 攔下，而那個 handler 只在「這顆元件沒有執行器」
 * 那條分支上被呼叫。而 `raw_code` **有**執行器（就是這一支）。
 *
 * > **一句描述「它會被誰接住」的註解，攔不住那個接手從來沒發生。**
 *
 * ⚠️ 它原本與另一顆共用 `unimplemented.ts` 的**一個 `for` 迴圈**，
 * 於是兩顆的執行器**來源位置是同一行**——任何按位置記帳的護欄都只算一筆。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:raw_code', async (node, ctx) => {
    // ⚠️ 退路是 `''`，與宣告的 `default` 一致（第二十三條護欄，硬性零）。
    // 原本寫 `?? '(不明)'`——**那是在讀屬性的地方發明第二個缺省**，
    // 而宣告說 default 是空字串。訊息的兜底移到訊息本身。
    const code = String(node.properties?.code ?? '').slice(0, 60)
    const label = code || '(空的)'
    // 🔴 **有宿主的話停在這裡，不要直接丟**（2026-08-26，使用者拍板）：
    //    「跑到那邊要有斷點，讓使用者調整完狀態才能繼續跑下去，或是直接停止」。
    //    ⚠️ 這個檔頭本來寫著它丟的錯「可被 `unknownComponentHandler` 接管」
    //    ——**那條路從來沒有真的接起來**：丟出去的錯不會被任何 handler 攔下。
    if (await ctx.pauseForUnrecognized?.(label, node.id ?? null) === 'continue') return
    throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, { '%1': label })
  })
}
