/**
 * 把 `src/panels/` 底下的每一份面板宣告載進來（spec 170）。
 *
 * 🔴 用 `import.meta.glob(..., { eager: true })`，與課程、範例、語言套件同一招
 * ——**手寫一份清單的話，加一種投影就要記得改兩個地方**，而忘記的那一次
 * 沒有任何東西會出聲。
 *
 * ⚠️ 而**順序不靠這裡**：`import.meta.glob` 的鍵順序不保證，
 * 而版面裡由左到右的順序是**設計出來的**（`language-packs.ts:186` 記過這個病）。
 * 排序住在 `panel-registry.ts` 的 `allPanels()`，由 `LAYER_ORDER` ＋ `order` 決定。
 *
 * ## 🔴 為什麼收集與登錄表是兩個檔
 *
 * 登錄表要**測得到**，而 `import.meta.glob` 在 Vitest 的 node 環境下行為不同。
 * 拆開之後測試推自己的宣告進去，而產品路徑走這一支。
 *
 * > **一個只有在真實環境才長得出來的東西，不該與它的邏輯住在同一個檔。**
 */
import { registerPanel } from './panel-registry'
import type { PanelSpec } from './panel-spec'

const FILES = import.meta.glob('/src/panels/*/panel.ts', { eager: true }) as Record<
  string,
  { default?: PanelSpec }
>

let loaded = false

/**
 * 把宣告推進登錄表。⚠️ **可以重複呼叫**——只有第一次真的做事。
 *
 * 🔴 少了 `default` 的檔要**出聲**：一個放在 `panels/` 底下而沒有 export 的檔，
 * 作者以為它生效了，而它靜靜地不存在。
 */
export function loadPanels(): readonly string[] {
  if (loaded) return []
  loaded = true
  const problems: string[] = []
  for (const [path, mod] of Object.entries(FILES)) {
    const spec = mod.default
    if (!spec) {
      problems.push(`🔴 ${path} 沒有 \`export default\` 一份面板宣告——它不會生效，而它不報錯。`)
      continue
    }
    registerPanel(spec)
  }
  return problems
}

/** ⚠️ 只給測試用。 */
export function resetLoadedForTest(): void {
  loaded = false
}
