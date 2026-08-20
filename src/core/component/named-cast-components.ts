/**
 * **命名轉型的登錄表** —— `static_cast<T>(x)` 這個關鍵字屬於哪一顆元件
 *
 * `io.ts` 原本內嵌一張 `{ 'static_cast': 'cpp:cast_static', … }`。
 * 判別「這是不是 `template_function` 形狀的呼叫」是 **C++ 語法的知識**，留在共用檔；
 * **「`static_cast` 這個名字屬於我」是元件自己的宣告**。
 *
 * > 判準（`component-encapsulate` 步驟 4）：**這個東西有沒有人要「查」它？**
 * > 有 → 登錄表。沒有（一整筆資料）→ glob 直讀。
 * > 這裡是查——共用檔拿到一個關鍵字要問「誰認領」。
 */
const table = new Map<string, { componentId: string; source: string }>()

/**
 * @throws 同一個關鍵字被兩顆元件認領——**靜默覆蓋的症狀是「有一顆元件的
 *   lift 永遠不會被呼叫」**，而那不會有任何錯誤訊息。
 */
export function registerNamedCast(keyword: string, componentId: string, source: string): void {
  const existing = table.get(keyword)
  if (existing && existing.componentId !== componentId) {
    throw new Error(
      `命名轉型「${keyword}」被兩顆元件認領：${existing.componentId}（${existing.source}）與 ${componentId}（${source}）。`,
    )
  }
  table.set(keyword, { componentId, source })
}

/** 這個關鍵字屬於誰。不認得回 `undefined`——**不猜**。 */
export function namedCastConcept(keyword: string): string | undefined {
  return table.get(keyword)?.componentId
}
