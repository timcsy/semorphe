import type { LoadOutcome } from './storage'
import { msg } from './messages'

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

/**
 * **跑到一個看不懂的東西，停在那裡的那一句。**
 *
 * 使用者 2026-08-26 逐字：「跑到那邊要有斷點，讓使用者調整完狀態才能繼續跑下去，
 * 或是直接停止」。所以這一句要回答三件事：**停在哪**（指名那顆元件）、
 * **為什麼**（是系統不會，不是你寫錯）、**接下來能做什麼**（改狀態／繼續／停止）。
 *
 * ⚠️ **走訊息埠而不是寫死中文**——這個檔上面那兩則是寫死的（歷史遺留），
 * 而 2026-08-26 才剛修過「中文介面顯示英文退路」那一類的缺陷。
 * **不往那個方向再加。** 退路仍然是中文，因為沒有宿主翻譯表時它至少是可讀的。
 */
export function describeUnknownPause(component: string): string {
  return msg('EXEC_UNKNOWN_PAUSE', '這一塊我還不會執行（{component}）——先停在這裡。你可以在「變數」那一頁調整狀態，然後按繼續；或是直接停止。')
    .replace('{component}', component)
}

/**
 * **選了繼續之後留下的痕跡。**
 *
 * 🔴 少了這一行，輸出看起來就像那一行真的跑過了——而
 * `principles.md:135` 逐字：「降級必須單調遞減、**必須可見**」。
 */
export function describeUnknownContinued(component: string): string {
  return msg('EXEC_UNKNOWN_CONTINUED', '（{component} 這一行沒有執行，是你選擇繼續的）')
    .replace('{component}', component)
}

/**
 * **改不動那個變數時的那一句。**
 *
 * ⚠️ 一個按了沒反應的編輯框，比一個唯讀的更糟：唯讀至少誠實。
 */
export function describeSetVariableRefused(name: string, value: string): string {
  return msg('EXEC_SET_VAR_REFUSED', '改不動「{name}」——「{value}」不是它的型別接得住的值，或者這個名字現在不在可見範圍裡。')
    .replace('{name}', name).replace('{value}', value)
}

/**
 * **這次執行有人插手過的那一句。**
 *
 * 🔴 `principles.md:135`：「降級必須……**必須可見**」。
 * 一個手填過變數的執行，輸出**不是這支程式單獨產生的**——
 * 畫面上不說的話，那個結果會被當成程式的結果。
 *
 * ⚠️ 它**只陳述，不問**（2026-08-26 的教訓：別新增一個問句）。
 */
export function describeInterventions(count: number): string {
  return msg(
    'EXEC_INTERVENTIONS',
    '⚠️ 這次執行有 {count} 筆是你手動填進去的，所以上面的結果不是這支程式單獨跑出來的。',
  ).replace('{count}', String(count))
}
