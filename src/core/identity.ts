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
export const SCOPES = ['lang', 'cpp'] as const
export type Scope = (typeof SCOPES)[number]

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
  return (SCOPES as readonly string[]).includes(p.scope)
}

/** 有命名空間嗎（不檢查 scope 是否在白名單內）——遷移期間用來分辨新舊格式 */
export function isNamespaced(id: string): boolean {
  return parseComponentId(id) !== null
}
