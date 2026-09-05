/**
 * 參數規格的**唯一讀取入口**——`string[]` 與 `ParamSpec[]` 兩種形態的正規化
 *
 * ## 為什麼需要它
 *
 * 124 顆元件的參數宣告曾經是純名字清單（`['type','name']`），
 * 規格化之後變成 `ParamSpec[]`。遷移期間兩種形態並存，而**下游不該關心是哪一種**。
 *
 * 🟢 **2026-09-06：遷移完成了**——185 顆全部是 `ParamSpec`，純名字 **0** 顆，
 * 而 `ComponentDefJSON.properties` 的型別跟著收斂。
 * ⚠️ **這一支的兩種形態照樣留著**：見底下 `ParamsField` 的說明。
 *
 * ⚠️ **一個來源，兩種視圖**——不是兩份資料：
 *
 * - `paramSpecs(c)` → 規格（種類、必填、預設值）
 * - `paramNames(c)` → 只要名字（既有的 `string[]` 消費者）
 *
 * 讓每個消費者各自寫 `Array.isArray(p) && typeof p[0] === 'string' ? … : …`
 * 就是在製造 N 份會漂移的判斷。
 */
import type { ComponentDefJSON, ParamSpec } from './types'

/**
 * 🔴 **這一支收的比 `ComponentDefJSON` 宣告的寬，而那是刻意的。**
 *
 * 2026-09-06 型別收斂成 `ParamSpec[]`（純名字清單實測 0 顆），
 * 而**這一支不跟著收**——它是**讀取入口**，而入口的職責是擋住髒資料，
 * 不是假設資料乾淨。JSON 是外部輸入：型別註解攔不住一個手寫錯的檔案。
 *
 * > **一個型別宣稱「只有一種形態」，與一個讀取入口【假設】只有一種形態，
 * > 是兩件事——前者是我們的意圖，後者是一個沒有防護的斷言。**
 */
type ParamsField = readonly (string | ParamSpec)[] | ComponentDefJSON['properties']

/** 正規化成規格。純名字的一律當 `literal`——**未規格化 ≠ 沒有規格** */
export function paramSpecs(params: ParamsField | undefined): ParamSpec[] {
  if (!params || params.length === 0) return []
  if (typeof params[0] === 'string') {
    // ⚠️ 尚未規格化。判定保守：當成 `literal`（只驗存在），
    // 而**不是**猜一個種類——猜錯會讓檢查對著錯的東西叫。
    return (params as string[]).map((name) => ({ name, kind: 'literal' as const }))
  }
  return params as ParamSpec[]
}

/** 只要參數名——給既有的 `string[]` 消費者 */
export function paramNames(params: ParamsField | undefined): string[] {
  if (!params || params.length === 0) return []
  if (typeof params[0] === 'string') return params as string[]
  return (params as ParamSpec[]).map((p) => p.name)
}

/** 這顆元件的參數已經規格化了嗎（不是純名字清單） */
export function isSpecified(params: ParamsField | undefined): boolean {
  return Boolean(params && params.length > 0 && typeof params[0] !== 'string')
}
