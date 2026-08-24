/**
 * **核心的公開入口**——`@semorphe/core` 對外的那一面。
 *
 * ## 為什麼需要這個檔（而不是讓人直接 import `src/core/...`）
 *
 * 2026-08-24 實測：拿 esbuild 直接建一個 import 我們原始碼的專案，
 * 建得起來，而一跑就是
 *
 * ```
 * TypeError: (intermediate value).glob is not a function
 * ```
 *
 * `import.meta.glob` 是 **Vite 的轉換**，不是語言特性
 * （`core/component/registry.ts:12-28` 記著同一個坑）。
 *
 * 🔴 **而正確的結論不是「核心要戒掉 glob」**——那是把需求推導錯了一格：
 *
 * > 「非 Vite 的專案能用」說的是**消費者**不必用 Vite，
 * > **不是我們不能用**。函式庫本來就出貨打包好的產物。
 *
 * 所以這個檔是**打包的入口**（`npm run build:sdk` → `dist-sdk/semorphe.mjs`），
 * 而膠囊在那一步就被 Vite 靜態展開進產物裡了。消費者拿到的是一份
 * 普通的 ESM，用什麼建置工具都行。
 *
 * ## ⚠️ 這裡列出來的東西，就是我們對外承諾的形狀
 *
 * 加一個匯出很便宜，**移掉一個很貴**——`vision.md` 階段 8 那一項寫著
 * 「`ViewHost` 協定與 `componentId` 詞彙一旦對外就是公開介面」。
 * 所以這份清單刻意窄：**只放「自帶視圖 ＋ 即時互轉」真的需要的東西**。
 */

// ── 協定：自帶視圖的人要實作的那一份 ────────────────────────────
export type {
  ViewHost,
  ViewConfig,
  SemanticUpdateEvent,
  ExecutionStateEvent,
  ExecutionAtNodeEvent,
  ViewCapabilities,
} from '../core/view-host'
export { registerView, registerViewsIn, connectViews, resetViews, registeredViews } from '../core/view-registry'

// ── 真相與匯流排 ──────────────────────────────────────────────
export { SemanticBus } from '../core/semantic-bus'
export type { SemanticNode, StylePreset, LiftPattern } from '../core/types'
export type { CodeMapping, BlockMapping } from '../core/projection/code-generator'

// ── 即時互轉 ──────────────────────────────────────────────────
export { SyncController } from '../core/sync-controller'
export { Lifter } from '../core/lift/lifter'
export { PatternLifter } from '../core/lift/pattern-lifter'
export { TransformRegistry, registerCoreTransforms, LiftStrategyRegistry } from '../core/registry'
export { BlockSpecRegistry } from '../core/block-spec-registry'

// ── 語言套件與膠囊登錄表 ──────────────────────────────────────
export { loadAllLanguagePacks } from '../core/load-language-packs'
export { allLanguagePacks } from '../core/language-packs'
export { componentComponents, componentBlocks } from '../core/component/registry'
// 🔴 **膠囊的具名策略登記**——今天產品是透過 `registerCppLifters` 順手做的
//    （語言中立的登記掛在某個語言的名字底下，`history/121` 的那筆錯位）。
//    ⚠️ **SDK 不得要求消費者為了跑 Python 去呼叫一個叫 `Cpp` 的函式**，
//    所以這裡直接把語言中立的那一支轉出來。
export { componentLiftStrategyRegistrars, componentGenerateRegistrars } from '../core/component/paths'
export { registerLanguage, generateCode } from '../core/projection/code-generator'
export { componentLiftPatterns } from '../core/component/lift-patterns'
export { setCommentLanguage } from '../core/comment-syntax'
