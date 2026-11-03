# Tasks: 產品端只走 Cella（6c-3）

- [X] T001 量工作階段：長輸出（6000 正常、8000 起在 6666 字停住）與執行到一半出錯（出錯前的輸出還在）——記進 6c 測試盤點 draft
- [X] T002 [US1] 盤點錯誤訊息：Cella 的每一種 problem kind 對到 `RUNTIME_ERR_*` 是否有中文；補齊；退路訊息中文化（含「Maximum call stack」那一種）
- [X] T003 [US1→US4] 「準備中」（🟢 2026-11-03，與 T008 同一刀：提供者回 `pending`、執行控制器說一次「準備中」、好了自動開跑、按停止不等、120 秒照實報錯）：第一次按執行時除錯模組還沒好 → 顯示準備中、就緒後自動開跑（設計 draft 五之十 ③）。
  延到與 T008 一起做：JS 還在的時候改成等 Cella，只會讓第一次執行多等約 20 秒、讓 e2e 裡快速按執行的那些逾時——付代價而沒有換到東西
- [X] T004 [US2] 盤點 C 類 6 支 ＋ 移過來的 4 支：逐支改由 Cella 背書（session-contract 拿掉 JS 那一格等）
- [X] T005 🪦 [US3] 查證：`useRealTime(true)` 在產品裡沒有呼叫者——真實時間那條路從來沒開過，沒有東西要搬（隨 6c-4 刪 runtime 退場）
- [X] T006 診斷層：analogReadResolution 超出範圍的 warning
- [ ] T007 e2e：三種接不了的情況各一支；瀏覽器驗收四件事
- [X] T008 [US4] 等 Cella 修好堆疊溢位：升級、驗證長輸出、拿掉 jsInterpreterProvider 的登記、加護欄。🟢 2026-11-03：Cella 0.1.202611030133（四族到齊）；`app.ts` 不再登記任何提供者；護欄 `audit-cella-only`；翻不出時照實說並指回那一行。⚠️ Safari／Firefox 的長輸出待使用者決定要不要量（6c 盤點 draft）
  ⚠️ 上限跟機器有關（CI 的 Linux 8000 字跑得完、本機 macOS 6666 字爆）——**先在 Chromium／Safari／Firefox 的瀏覽器裡量**學生會遇到哪一種

## T004 翻出的產品端缺陷（2026-11-02，子代理回報；我們這側的照規矩要修，也是 US4 的前提）

- [X] T009 D1 迴圈圈數：`src/core/iterations.ts` 的 `loopRatio`／`iterationCounts` 照 JS 的定義（迴圈節點的次數＝進入次數）寫；Cella 數的是條件檢查次數 ⟹ 徽章顯示 0、「預測揭曉」說 0 圈——**現在就影響學生**（Cella 已排在前面）
- [X] T010 D2 步數上限：Cella 工作階段不讀 `SessionOptions.maxSteps`（`cella-lang/dap` 的 fuel 是每一段的）⟹ 無窮迴圈要學生按停止才停——worker 端累計步數、超過就停並給中文訊息
- [X] T011 D4（友善建議仍開著：診斷層） 運算式當敘述：formalize 不收 `cpp:compare`／`cpp:arithmetic` 當敘述 ⟹ `cout < "x"`、`Cout << …` 被說成「Cella 還不支援」（把學生的錯說成系統的錯）——補 stmt；友善提示是診斷層的事（US4 前要有）
- [X] T012 D7 例外訊息的 `{text}` 是整包 JSON ⟹ 取出 type 與 message 組成一句話
- [X] T013 D8 declined 的原因不帶節點 id ⟹ 帶 `nodeId`，US1「指出哪一行還不支援」要它
- [ ] T014 回報 cella：D3（Python `input(prompt)` 先讀才寫提示）、D5（getline 在乾淨的流上遇 EOF 沒清空字串，[string.io]）、D6（`trace()` 不記 setVariable 的位置）
- D9（`#include "foo.h"` 該不該照跑）：未決，不阻塞
