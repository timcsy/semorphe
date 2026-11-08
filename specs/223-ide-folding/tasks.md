# Tasks: IDE 宿主的程式碼也跟著收合

- [x] T001 `tests/unit/core/fold-lines.test.ts`：一行上取最長、單行不算、收合 → 起始行
- [x] T002 `src/core/granularity.ts`：`nodeAtStartLine`、`foldLinesFor`；網頁版 `monaco-panel.ts` 改用它（同一個判準）
- [x] T003 `tests/integration/ide-folding.test.ts`：收合 → 送摺的行；撤掉 → 只展開自己摺過的；對映挪了跟著挪；沒變不重送
- [x] T004 `vscode-code-view.ts` 的 `onGranularity`／`sendFolds`；`messages.ts` 加 `fold`；`panel.ts` 的 `applyFolds`（使用中的編輯器才摺）
- [ ] T005 型別、unit、guard（基線手改附 note）、`build:vscode`、長測試
- [ ] T006 手動驗收清單交使用者（`acceptance.md`）
