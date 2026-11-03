# Research: 刪掉 JS 直譯器

## 決定 1：非執行模組搬到哪裡
- **Decision**：放回它們的使用者那一側（`languages/cpp/` 的 lift 輔助、元件自己的資料夾）。
- **Rationale**：它們本來就不是執行的一部分，只是當初寫在 runtime 旁邊；放到使用者旁邊，下一次刪東西時不會再被拉斷。
- **Alternatives**：留在原地只刪其他檔——目錄名叫 runtime 卻只剩 lift 用的東西，會再誤導一次。

## 決定 2：`execute` 這一格直接拿掉，不留 `null`
- **Decision**：component.json 不再出現 `execute`，出現就報錯。
- **Rationale**：留著 `null ＋ _execute_why` 等於 351 份文件都在說「這裡本來該有一個東西」；P8 不做向後相容。
- **Alternatives**：保留欄位但不檢查——殘留的欄位會讓之後的人以為還要寫。

## 決定 3：參照編譯器族（E 類）在這一刀刪
- **Decision**：拿直譯器當一側的對照測試，直譯器刪掉後無法成立，這一刀一起刪；參照編譯器本身（refcc 工具、shim、CLAUDE.md 的段落）留給 6c-5。
- **Rationale**：留著它們只能改成「跳過」，那是 skip 而且會被 `audit-defect-ledger` 的棘輪擋。
- **Alternatives**：先改成對照 Cella——那是 6c-5 要決定的事（要不要留一個「Cella 對外部編譯器」的對照，見 6c 盤點風險 10）。

## 測試檔分類
（由逐支閱讀填入，見下方表格）
