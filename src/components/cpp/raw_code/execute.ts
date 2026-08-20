/**
 * `cpp:raw_code` 的 **execute** 路——**出聲，不要靜默略過**
 *
 * 這顆裝的是**辨識不出來的原始程式碼**。執行它等於執行一段沒有語義的文字，
 * 而那件事做不到——所以它丟一個可被 `unknownConceptHandler` 接管的錯誤，
 * 與未知概念同一條路徑：**使用者可以選擇跳過或中止，但不會不知道。**
 *
 * ⚠️ 它原本與另一顆共用 `unimplemented.ts` 的**一個 `for` 迴圈**，
 * 於是兩顆的執行器**來源位置是同一行**——任何按位置記帳的護欄都只算一筆。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:raw_code', async (node) => {
    // ⚠️ 退路是 `''`，與宣告的 `default` 一致（第二十三條護欄，硬性零）。
    // 原本寫 `?? '(不明)'`——**那是在讀屬性的地方發明第二個缺省**，
    // 而宣告說 default 是空字串。訊息的兜底移到訊息本身。
    const code = String(node.properties?.code ?? '').slice(0, 60)
    throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, {
      '%1': code || '(空的)',
    })
  })
}
