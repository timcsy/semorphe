/**
 * 「這個語言的工具箱有哪些分類」的宣告登記處。
 *
 * ## 為什麼需要這個模組
 *
 * `app.ts` 與**可拿性護欄**都直接 import `cppCategoryDefs`
 * ——於是「工具箱長什麼樣」這件事**寫死成 C++ 的那一份**。
 *
 * 症狀是 spec 160 實測出來的：Python 的第一顆積木宣告完之後，
 * 可拿性護欄報 **`(python) python_print` 拿不到**
 * ——積木在登錄表裡、在膠囊裡、產得出程式碼，**而使用者拿不到它**。
 *
 * > **一顆拿不到的積木，對學生而言等於不存在。**
 *
 * ## 分工——與 `degradation-blocks`／`comment-syntax` 同一個形狀
 *
 * | 誰 | 提供什麼 |
 * |---|---|
 * | 核心 | **機制**——按分類把積木排進工具箱 |
 * | 語言套件 | **哪些分類、順序如何**（那是策展，導不出來） |
 *
 * ⚠️ **沒有宣告時回空陣列**，不猜——一個沒有工具箱的語言就是還沒有工具箱，
 * 而那與「工具箱是空的」在報表上必須分得出來（呼叫端自己判）。
 *
 * 見 `specs/160-python-first-block/`
 */
import type { ToolboxCategoryDef } from './types'

const REGISTRY = new Map<string, ToolboxCategoryDef[]>()

/** 語言套件在載入時宣告自己的工具箱分類。 */
export function declareToolboxCategories(language: string, defs: ToolboxCategoryDef[]): void {
  REGISTRY.set(language, defs)
}

/** 這個語言的分類；沒宣告過回空陣列。 */
export function toolboxCategoriesOf(language: string): ToolboxCategoryDef[] {
  return REGISTRY.get(language) ?? []
}

/** 所有已宣告的語言——⚠️ 護欄要掃**全部**，不是只掃 cpp。 */
export function declaredToolboxLanguages(): string[] {
  return [...REGISTRY.keys()]
}
