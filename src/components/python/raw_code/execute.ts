/**
 * `python:raw_code` 的 **execute** 路——**出聲，不要靜默略過**。
 *
 * 這顆裝的是辨識不出來的原始程式碼。執行一段沒有語義的文字做不到，
 * 所以它**停在這裡**（2026-08-26）——與 `cpp:raw_code` 同一條路。
 * 🪦 這裡本來寫著「丟一個 `unknownComponentHandler` 接得住的錯誤」，
 * ⚠️ **而那條路從來沒有真的接起來**（詳見 cpp 那一支的檔頭）。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:raw_code', async (node, ctx) => {
    // 退路是 `''`，與宣告的 `default` 一致（第二十三條護欄，硬性零）。
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
