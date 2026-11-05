/**
 * **面板的公開入口**——`@semorphe/core/panels`（spec 217 第四刀）。
 *
 * 核心那一面（`./index.ts`）讓人**自帶視圖**；這一面讓人**拿我們的視圖**：
 * 不經 `app.ts`，只靠套件組出「積木 ⇄ 程式碼」。證明在 `examples/panels-only/`，
 * 守著它的是 `tests/integration/audit-panels-only.test.ts`。
 *
 * ## 為什麼是另一個入口，不是併進 `index.ts`
 *
 * 面板要 Blockly，核心不要——`examples/bring-your-own-view/` 在 Node 裡跑核心，
 * 一個 import 就把 Blockly ＋ DOM 拉進來的話，那個例子會死。所以分兩支，Blockly 是 peer（不打包）。
 *
 * ## ⚠️ 這裡列出來的就是承諾
 *
 * 與 `index.ts` 同一條規矩：加一個匯出很便宜，移掉一個很貴。這裡只放「組出積木那一格」真的需要的東西
 * ——例子裡每一行組裝用到的名字，少一個例子就建不起來（護欄會紅）。
 */

// ── 面板：宣告與掛載 ──────────────────────────────────────────
export { loadPanels } from '../core/host/load-panels'
export { panelById, allPanels } from '../core/host/panel-registry'
export type { PanelSpec, PanelContext, PanelInstance } from '../core/host/panel-spec'
export type { HostProfile } from '../core/host/host-profile'
export type { CodeView } from '../core/host/code-view'

// ── 積木那一格要的組裝（app.ts 也做同一件事）──────────────────────
// 積木定義要先註冊進 Blockly，面板才畫得出一顆真的積木（`BlockRegistrar`，第四刀從 src/ui 搬進面板）
export { BlockRegistrar } from '../panels/blocks/block-registrar'
// 語義樹 → 積木的渲染器是一個全域的設定點（面板的 onSemanticUpdate 用它）
export { PatternRenderer } from '../core/projection/pattern-renderer'
export { setPatternRenderer } from '../core/projection/block-renderer'
export { RenderStrategyRegistry } from '../core/registry'
export { setDegradationLanguage } from '../core/blocks/degradation-blocks'
// 積木上的字（`%{BKY_…}`）——宿主把它接到 `Blockly.Msg`
export { LocaleLoader } from '../i18n/loader'
export { setMessageSource } from '../core/messages'
export { createNode } from '../core/semantic-tree'
