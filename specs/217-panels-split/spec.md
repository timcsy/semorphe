# Feature Specification: 積木與流程圖兩格自己 `mount`（面板拆成可獨立掛載的視圖套件，收尾）

**Feature Branch**: `271-panels-split`（第一刀）｜**Created**: 2026-11-05｜**Status**: 分刀進行
**Input**: vision〈面板拆成可獨立掛載的視圖套件〉——剩積木與流程圖兩格（棘輪 2 → 0）；「面板該不該知道本體插槽」使用者 2026-11-04 定 **A'**（接點與角色讀契約，顏色與形狀留在 `@semorphe/<領域>`）。

## 背景（量到的）

| | 行數 | 依賴核心以外的 |
|---|---|---|
| `src/ui/panels/flow-panel.ts` | 2319 | `ui/layout/cell-head` |
| `src/ui/panels/blockly-panel.ts` | 2049 | 同目錄的 `middle-drag-pan`、`ghost-drag-strategy`；`ui/theme/dark-workspace-theme`；`ui/toolbar/toast`；**`languages/style`**（面板認得語言——違反） |

已自己 `mount` 的三格（變數、主控台、程式碼）都是把畫法搬進 `src/panels/<格>/view.ts`，宿主的東西經 `mount` 的 context 注入。
而 `src/panels/` 這一層在分層護欄裡**沒有任何限制**——搬進來時引用 `ui`／`languages` 也不會紅。

## 分刀

1. **護欄先行**（第 271 刀）：分層規則加 `panels`——只准依賴核心（不准 `ui`／`languages`／`components`／`vscode`／`interpreter`／`providers`）。今天的三格本來就乾淨。
2. **流程圖**：`flow-panel.ts` → `src/panels/flow/view.ts`；`cell-head` 搬到核心的宿主介面或 `src/panels/` 共用處；`mount` 從 context 拿積木登錄表；拿掉 `mountedByShell`（棘輪 2 → 1）。
3. **積木**：`blockly-panel.ts` 與兩個拖曳輔助、深色主題 → `src/panels/blocks/`；toast 與風格（`languages/style`）改由 context 注入；`mount` 從 context 拿登錄表、工具箱、語言的接線、媒體路徑（棘輪 1 → 0）。
4. **驗收②**：一個不經 `app.ts` 的頁面只靠套件組得出積木＋程式碼互轉（vision 原文）。

## 驗收（整項）
- 第一百二十五條護欄（`panel-mount-migration`）的棘輪 2 → 0；
- 分層護欄：`panels` 只依賴核心，硬性零；
- 每一刀：e2e 全綠（介面改動）、開瀏覽器看積木與流程圖兩格（拖曳、深色模式、離線媒體）。

## 風險（experience）
- 〈一次抽象如果同時搬走「容器」與「內容」，它壞掉時你分不出是哪一半〉——所以一刀只搬一格。
- 改了使用者按得到的東西 ⟹ e2e；Blockly 在 `display:none` 量到 0×0（`relayout`）。

## 第四刀的計畫（2026-11-05，第 277 刀之後）

**驗收②**：一個不經 `app.ts` 的頁面只靠套件組得出積木＋程式碼互轉。

量到的現況：
- `examples/bring-your-own-view/` 已經證明**核心**可以單獨出貨（`dist-sdk/semorphe.mjs`，第五十八條護欄 `audit-portable-core` 每次 CI 建它、跑它）——但它不用任何面板（自己寫一個文字視圖）。
- `src/sdk/index.ts` 匯出核心（匯流排、同步、lift、登錄表、產生器），**沒有匯出面板**（`src/panels/*`）。
- 6 份面板今天都自己 `mount`（第 271、272、277 刀），宿主的東西經 `PanelContext` 注入——所以「只靠套件組」已經**可以**做，缺的是出貨與一個真的組起來的頁面。

做法：
1. SDK 多一個面板的入口（`src/sdk/panels.ts`）：匯出 `loadPanels`／`panelById` 與 `PanelContext` 型別；Blockly 是 peer（不打包進去）。
2. `examples/panels-only/`：一個 HTML ＋ 一支 `main.ts`——建匯流排、`SyncController`、載語言套件，`panelById('blocks').mount(...)`、`panelById('code').mount(...)`（程式碼那一格用一個 `<textarea>` 實作 `createCodeView`，不用 Monaco），積木改 → 程式碼變、程式碼改 → 積木變。
3. 護欄（與第五十八條同形）：建它、用 happy-dom 或 Playwright 跑它、斷言兩個方向的互轉——**它壞掉＝「面板是可獨立掛載的套件」這句話壞掉**。

風險：Blockly 在 node 裡跑需要 DOM（happy-dom 夠不夠要試）；面板的 `mount` 今天假設 `ctx.profile` 有 `createCodeView`——例子要提供一個最小的 profile。
