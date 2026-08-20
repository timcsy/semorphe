/**
 * 元件身分的格式：`<scope>:<name>`
 *
 * ## scope 是**所有權**，不是分類也不是位置
 *
 * 域已經是宣告裡的欄位，把它再編進 id 就是雙重真相——而且是最糟的那種，
 * 因為 **id 進了存檔就改不動**。
 *
 * Go／Modelica 走另一條路（id ＝ 位置），買到「就近性不可能違反」，
 * 代價是**搬家＝改名＝存檔遷移**。不採。
 *
 * ## 沒有裸名，沒有例外
 *
 * 不留「沒有冒號就是核心」這條解析特例——**特例是偵測，統一格式是消除**。
 *
 * 見 `knowledge/draft/2026-08-07-元件目錄與膠囊契約.md:66-130`（四個決定逐條寫定）。
 */

/**
 * 允許的 scope。**明列，不是「任何冒號前的東西」。**
 *
 * ⚠️ 沒有白名單的話，`cpp:foo` 打成 `cop:foo` 會被當成一個合法的新命名空間，
 * 而不是錯字。
 *
 * 未落地（域尚不存在）：`hw`（硬體）、`@<user>`（第三方）。
 */
// ⚠️ `lang` 已於 D1（2026-08-09）退場——它是一個**假的通用宣稱**。
// 各套件自理，通用性住在轉換規範裡。見 `knowledge/concepts/元件.md`。
/**
 * 合法的 scope——🔴 **由【元件資料夾】決定，不是一份寫死的白名單**（spec 156）。
 *
 * 舊版是 `const SCOPES = ['cpp']`：**核心寫死了「只有 C++ 這個語言」**。
 * 第一顆 Python 元件進來時它當場報「scope 不在白名單」——
 * ⚠️ 而那條檢查**想擋的是打錯字**（`cop:foo`），不是「第二個語言」。
 *
 * 🟢 **正解是用結構取代白名單**：`src/components/<scope>/<name>/` 的
 * 資料夾名**就是**那個宣告。於是
 *
 * ```
 * cop:foo 放在 components/cpp/    → 資料夾說 cpp、身分說 cop → 抓得到
 * python:print 放在 components/python/ → 一致 → 放行
 * ```
 *
 * > **一份白名單會在第二個成員出現時擋住它；
 * > 而一個結構對應只擋【不一致】。**
 *
 * ⚠️ 這裡保留 `KNOWN_SCOPES` 只為了**訊息可讀**（印出目前有哪些），
 * 判定本身**不看它**。
 */
export const SCOPES = ['cpp'] as const
export type Scope = string

export interface ParsedId {
  scope: string
  name: string
}

/** 拆開 `<scope>:<name>`。格式不合回傳 `null`——**不猜** */
export function parseComponentId(id: string): ParsedId | null {
  const i = id.indexOf(':')
  if (i <= 0 || i === id.length - 1) return null
  const scope = id.slice(0, i)
  const name = id.slice(i + 1)
  // 名字裡不得再有冒號——KiCad 的規範同樣強制這一點，因為 split 不能有第二種切法
  if (name.includes(':')) return null
  return { scope, name }
}

/** 這個身分的格式合法嗎（含 scope 在白名單內） */
export function isValidComponentId(id: string): boolean {
  const p = parseComponentId(id)
  if (!p) return false
  // 🔴 **不比對白名單**（spec 156）——只要求格式正確；
  //    「scope 與資料夾一致」由 `audit-identity-namespace` 用結構判定。
  return p.scope.length > 0 && /^[a-z][a-z0-9_]*$/.test(p.scope)
}

/** 有命名空間嗎（不檢查 scope 是否在白名單內）——遷移期間用來分辨新舊格式 */
export function isNamespaced(id: string): boolean {
  return parseComponentId(id) !== null
}
