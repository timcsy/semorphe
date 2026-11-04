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
