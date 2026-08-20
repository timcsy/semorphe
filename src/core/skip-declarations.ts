import type { PathName, SkipReason } from './types'

/**
 * 「這個概念刻意不走某條路徑」的宣告登記處。
 *
 * ## 為什麼需要這個模組
 *
 * 在此之前，「哪些概念不執行」寫死在核心直譯器的一份 34 行清單裡。那違反
 * 「核心層不得認識語言專屬概念」，而且同一個事實有兩處記載（概念檔的
 * `skipPaths` 欄位與那份清單），**兩處從未一致過**——宣告那邊是 0 個。
 *
 * 現在只有一處：**概念自己說**。語言套件載入時把宣告推進來，核心層讀它。
 * 這與既有的 `registerLanguage`／`setDependencyResolver` 是同一個形狀。
 *
 * ## 空的登記處代表什麼
 *
 * 代表沒有語言套件載入過。這時每個沒有執行器的概念都會回報未知概念——
 * **與加入本機制之前的行為相同**（那時清單外的概念本來就是未知）。
 *
 * 見 specs/053-declare-noop-execute/、knowledge/concepts/執行機構.md
 */
const declarations = new Map<string, Partial<Record<PathName, SkipReason>>>()

/** 語言套件載入時呼叫，把概念自己的宣告推進來 */
export function declareSkips(
  componentId: string,
  reasons: Partial<Record<PathName, SkipReason>>,
): void {
  declarations.set(componentId, reasons)
}

/** 這個概念是否宣告了刻意不走這條路徑 */
export function isSkipped(componentId: string, path: PathName): boolean {
  return declarations.get(componentId)?.[path] !== undefined
}

/** 宣告的理由——報表要說得出「為什麼」，宣告才是可複查的 */
export function skipReason(componentId: string, path: PathName): SkipReason | undefined {
  return declarations.get(componentId)?.[path]
}

/** 全部宣告（護欄報表用） */
export function allSkipDeclarations(): {
  componentId: string
  path: PathName
  reason: SkipReason
}[] {
  const out: { componentId: string; path: PathName; reason: SkipReason }[] = []
  for (const [componentId, reasons] of declarations) {
    for (const [path, reason] of Object.entries(reasons)) {
      if (reason) out.push({ componentId, path: path as PathName, reason })
    }
  }
  return out.sort((a, b) => a.componentId.localeCompare(b.componentId))
}

/** 測試用：清空（正式流程不呼叫） */
export function resetSkipDeclarations(): void {
  declarations.clear()
}

// ─────────────────────────────────────────────────────────────────────────
// 語義標註的登記處
//
// 同一個形狀的第二個實例：核心層原本用一份 27 個概念名的清單決定「哪些概念
// 算一個除錯步驟」。那是**視圖層的關心**（除錯器要在哪裡停）寫在核心，而且
// 用的是語言專屬的名字。
//
// 標註本來就是專案規劃中「語言套件 ↔ 視圖套件的開放契約」，`ComponentDefJSON`
// 上早就有 `annotations` 欄位。
// ─────────────────────────────────────────────────────────────────────────

const annotations = new Map<string, Record<string, unknown>>()

/** 語言套件載入時呼叫 */
export function declareAnnotations(componentId: string, ann: Record<string, unknown>): void {
  annotations.set(componentId, ann)
}

/** 這個概念有沒有帶某個標註且為真。**缺標註時為 false**——與原本「清單外不停」一致 */
export function hasAnnotation(componentId: string, key: string): boolean {
  return annotations.get(componentId)?.[key] === true
}

/** 測試用 */
export function resetAnnotations(): void {
  annotations.clear()
}
