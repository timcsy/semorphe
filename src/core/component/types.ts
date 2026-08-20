/**
 * 膠囊——一顆元件的家
 *
 * ## 一句話
 *
 * **一顆元件 = 一個資料夾。** 它的宣告、它實際有的那幾路實作、它的標籤、
 * 它的自證測，全部住在裡面；系統對它的要求只有 `contracts/component.md` 的 C1–C8。
 *
 * ## 為什麼要有這一層（而不是繼續用 std 模組）
 *
 * `StdModule` 是**模組**的粒度——`<vector>` 一個模組住 4 顆元件，於是
 * 「改一顆」要打開住著 4 顆的檔。實測：`cpp:vector_declare` 散在 8 個檔，
 * 其中 3 個裡面住著別的元件（最多的一個住 48 顆）。
 *
 * ## ⚠️ 膠囊**不是** StdModule，即使兩者長得像
 *
 * `ModuleRegistry.register()` 用 `header` 當鍵：
 *
 * ```ts
 * this.modules.set(mod.header, mod)      // ← 同一個 header 會靜默覆蓋
 * ```
 *
 * 把 `<vector>` 膠囊當成 StdModule 註冊，會與既有的 `<vector>` 模組**撞鍵並
 * 覆蓋掉其中一個**，而 `conceptToHeader` 仍然正確 → 症狀是
 * 「`getModule('<vector>')` 少了一半內容」而測試全綠。
 *
 * → 膠囊走自己的清單，`#include` 靠 `registerConceptMapping()`
 *   （那個機制已經在用了：`cpp:print` → `<iostream>`）。
 */

/** 膠囊放在哪。**scope 分一層**——第三方 `@someone:` 套件要有地方住。 */
export const COMPONENT_ROOT = 'src/components'

/** 五路。順序即完備性護欄的順序。 */
export type FivePath = 'lift' | 'generate' | 'render' | 'extract' | 'execute'

export const FIVE_PATHS: readonly FivePath[] = ['lift', 'generate', 'render', 'extract', 'execute']

/**
 * `component.json` 的形狀。
 *
 * 欄位幾乎與現行 `concepts.json` 的一筆相同——**因為它就是那一筆**。
 * 搬家不重寫。多的只有兩個槽，各自有當前的消費者：
 *
 * | 槽 | 當前消費者 |
 * |---|---|
 * | `requires` | `#include` 依賴解析、工具箱的 owner 章 |
 * | `paths` | 「宣告了沒實作」要看得出來——沒有它，少一路只會安靜地不做事 |
 */
export interface ComponentManifest {
  /**
   * 身分。**欄位名是 `componentId` 而不是 `componentId`。**
   *
   * `concepts/元件.md` 的詞彙表用 `componentId`，而程式碼裡 `componentId` 有 707 處、
   * `componentId` 只有 21 處。在 `component.json` 裡改用後者，等於為同一件事造
   * **第二個名字**——而那正是這整個階段在清的雙重真相。
   *
   * 詞彙表與程式碼的分歧是真的，但它的處置是**一次全域改名**（`skills/component-rename`），
   * 不是在新檔案裡開一個孤島。⚠️ 那件事還沒做，記在切片紀錄的「後續」。
   */
  componentId: string
  abstractComponent?: string
  /** 依賴。C++ 是標頭檔（`['<vector>']`）。⚠️ **不得從資料夾名推**——`cpp:pair_declare` 的 header 是 `<utility>`。 */
  requires?: string[]
  properties?: unknown[]
  children?: Record<string, unknown>
  role?: string
  /**
   * 五路的宣告。**沒有的那幾路寫 `null`，並在 `_<path>_why` 說明理由。**
   *
   * 選填的話，忘了接上的路會靜靜地不存在——而那正是「殼」。
   * 紀律沿用 `StdModule.registerExecutors` 的註解：
   * 「讓**顯式的空**與**遺漏的空**分得出來」。
   */
  paths: Partial<Record<FivePath, string | null>> & Record<string, unknown>
}

/**
 * 一顆膠囊被登錄時記下的東西。
 *
 * ## 為什麼兩個都要
 *
 * `componentId` 是宣告寫的、`sourceDir` 是從路徑推的，而**兩者要互相核對**：
 *
 * - 只信宣告 → 有人複製膠囊忘了改 id，抓不到
 * - 只信路徑 → 就變成「從檔名推歸屬」，而那是明令禁止的
 *   （`specs/054` 的 `strings.ts` 橫跨兩個標準函式庫模組）
 *
 * 不一致就紅。這同時是「抓錯置」那條防線的地基。
 */
export interface ComponentRegistration {
  /** 宣告裡寫的 */
  componentId: string
  /** 從檔案路徑推導出來的，例如 `cpp/vector_declare` */
  sourceDir: string
  manifest: ComponentManifest
}

/** `<scope>:<name>` → `<scope>/<name>`。路徑與身分的唯一換算處。 */
export function idToDir(componentId: string): string {
  const i = componentId.indexOf(':')
  if (i < 0) throw new Error(`膠囊身分必須是 <scope>:<name> 格式，收到：${componentId}`)
  return `${componentId.slice(0, i)}/${componentId.slice(i + 1)}`
}
