/**
 * 積木欄位寫入——**失敗不再沉默**。
 *
 * ## 原本的形狀
 *
 * ```
 * try { this.setFieldValue('x', 'SEL_0') } catch (_e) { /* ignore *\/ }
 * ```
 *
 * `block-registrar.ts` 裡有 16 個。專案記憶點名過它：
 *
 * > 「正好吞掉『欄位名不對』這個**已知會發生**的錯誤。」
 *
 * 那正是 `cin >> s` 變成 `cin >> x` 那一族——欄位名對不上時靜靜地退回預設值，
 * 從使用者角度「程式碼就是錯了」，而系統毫無提示。
 *
 * ## 為什麼不直接讓它擲出去
 *
 * 這些呼叫在積木建立與 mutator 重組的路徑上。擲出去會讓積木整個建不起來，
 * 那比欄位值不對更糟——`knowledge/history/017`：**一道會拒絕的檢查，必須先
 * 回答「被拒絕的東西去哪了」**。
 *
 * ## 所以：吞掉，但**數起來**
 *
 * 從「沉默」變成「可量測」。數字進護欄與棘輪，逐一消除排在後面。
 *
 * 見 specs/057-single-source-input-names
 */

export interface FieldWriteFailure {
  block: string
  field: string
  value: string
  reason: string
}

const failures: FieldWriteFailure[] = []

/**
 * 寫入欄位；失敗時**記下來**而不是丟掉。
 *
 * @returns 有沒有寫成功——呼叫端可以據此決定要不要走替代路徑
 */
export function setFieldSafely(
  block: { type?: string; setFieldValue(value: unknown, name: string): void },
  field: string,
  value: unknown,
): boolean {
  try {
    block.setFieldValue(value, field)
    return true
  } catch (e) {
    failures.push({
      block: String(block.type ?? '(unknown)'),
      field,
      value: String(value),
      reason: (e as Error)?.message?.slice(0, 80) ?? String(e),
    })
    return false
  }
}

/** 目前累積的失敗（護欄用） */
export function fieldWriteFailures(): readonly FieldWriteFailure[] {
  return failures
}

/** 測試用：清空 */
export function resetFieldWriteFailures(): void {
  failures.length = 0
}
