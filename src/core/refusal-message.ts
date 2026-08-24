import type { LoadOutcome } from './storage'

/**
 * 把拒絕的理由講成使用者看得懂的一句話。
 *
 * 「載入失敗」是**無法行動的**訊息——使用者不知道發生什麼事，也不知道東西
 * 還在不在。所以這裡一定要說出兩件事：**為什麼**，以及**原檔還在不在**。
 *
 * 獨立成一個模組是為了可測——它不該需要把整個應用程式外殼載進來才驗得了。
 *
 * 見 specs/052-storage-integrity-gate/spec.md FR-022
 */
export function describeRefusal(outcome: Extract<LoadOutcome, { kind: 'refused' }>): string {
  const r = outcome.reason
  const cause =
    r.code === 'too-new'
      ? `這份存檔來自較新的版本（${r.found}，目前是 ${r.current}）`
      : r.code === 'no-upgrade-path'
        ? `這份存檔的格式太舊（版本 ${r.found}），沒有可用的升級方式`
        : r.code === 'upgrade-failed'
          ? `升級這份存檔時失敗（版本 ${r.found}）`
          : `這份資料不是可用的存檔（${r.detail}）`

  const destination = outcome.backedUpTo
    ? '原檔已保留，未被覆蓋。'
    : '⚠️ 原檔無法備份，請先手動匯出再繼續操作。'

  return `上次的存檔沒有載入：${cause}。${destination}`
}

/**
 * **執行被拒絕時要說的話。**
 *
 * 形狀與上面那則相同，而那不是巧合——`knowledge/history/017` 逐字：
 *
 * > 「一道檢查一旦會**拒絕**，就必須同時回答**被拒絕的東西去哪了**。」
 *
 * 所以這裡一定要說出兩件事：**為什麼**，以及**使用者的程式還在**。
 *
 * ⚠️ **不可以只說「執行失敗」**——那是無法行動的訊息，
 * 使用者不知道發生什麼事，也不知道他打的東西還在不在。
 */
export function describeExecutionRefusal(count: number): string {
  const what = count > 1 ? `這段程式有 ${count} 處語法還不完整` : '這段程式有一處語法還不完整'
  return `${what}，所以還不能執行。你打的程式沒有被改動——補好之後再按一次執行就可以了。`
}
