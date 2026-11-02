# Tasks: 產品端只走 Cella（6c-3）

- [X] T001 量工作階段：長輸出（6000 正常、8000 起在 6666 字停住）與執行到一半出錯（出錯前的輸出還在）——記進 6c 測試盤點 draft
- [X] T002 [US1] 盤點錯誤訊息：Cella 的每一種 problem kind 對到 `RUNTIME_ERR_*` 是否有中文；補齊；退路訊息中文化（含「Maximum call stack」那一種）
- [ ] T003 [US1] 「準備中」：第一次按執行時除錯模組還沒好 → 顯示準備中、就緒後自動開跑（設計 draft 五之十 ③）
- [ ] T004 [US2] 盤點 C 類 6 支 ＋ 移過來的 4 支：逐支改由 Cella 背書（session-contract 拿掉 JS 那一格等）
- [X] T005 🪦 [US3] 查證：`useRealTime(true)` 在產品裡沒有呼叫者——真實時間那條路從來沒開過，沒有東西要搬（隨 6c-4 刪 runtime 退場）
- [ ] T006 診斷層：analogReadResolution 超出範圍的 warning
- [ ] T007 e2e：三種接不了的情況各一支；瀏覽器驗收四件事
- [ ] T008 ⏳ [US4] 等 Cella 修好堆疊溢位：升級、驗證長輸出、拿掉 jsInterpreterProvider 的登記、加護欄
