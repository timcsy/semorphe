# Feature Specification: 刪掉 JS 直譯器（重構 6c-4）

**Feature Branch**: `246-delete-interpreter`
**Created**: 2026-11-03
**Status**: Draft
**Input**: 6c-3 完成（spec 205，history/333）之後，產品的「執行」只走 Cella，JS 直譯器沒有任何產品路徑會走到；6c 測試盤點 draft 的「6c-4 的盤點」與 §3 風險 3／4／5。

## 背景

直譯器今天是一份**沒有人用、卻每天都要維護**的第二套語義：每加一顆元件要寫它的 `execute`、護欄要求「五路完備」、全套測試每個檔都載入它。
6c-3 拿掉了它的登記；6c-4 把它整個刪掉，讓「這段程式會怎麼跑」只剩 Cella 一個答案（P6、一份真相）。

**開工前重量（2026-11-03，main 3c2e63ec）**：元件的 `execute.ts` 327 個、`paths.execute` 351 份、`src/interpreter/` 20 檔、`lang/executors` 5、`lang/runtime` 20、
import 直譯器那一側的測試檔 54 個、非執行的產品檔 42 個。
🔴 **盤點漏掉的**：`lang/runtime/` 裡住著三支**非執行**的模組——`range-lift`（約 20 個 range_* 元件的 lift／generate）、`device-names`（pin_attach 的 lift）、`printf` 的 `extractPrintf`／`extractScanf`（io 的 lift）——直接刪會拉斷 lift 與產碼。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 學生與老師看不到任何差別（Priority: P1）

刪掉直譯器之後，寫程式、轉積木、轉回程式碼、按執行、除錯、上課，全部照舊。

**Independent Test**：全套測試、整輪 e2e、課文判決綁定語料、StudyCpp 判決探針，刪之前與刪之後結果相同（除了只驗直譯器自己的測試被刪掉）。

**Acceptance Scenarios**：
1. **Given** 一段用到 range_*（`sort(v.begin(), v.end())`）、`printf`／`scanf`、Arduino 裝置名稱的程式，**When** 轉積木再轉回來，**Then** 產出的程式碼與刪之前一字不差。
2. **Given** 任何一堂課，**When** 學生按執行，**Then** 輸出與刪之前相同。

### User Story 2 - 加一顆元件不再要寫 execute（Priority: P1）

元件的必要路徑從「五路」變成 lift／render／extract／generate ＋ formalize；護欄、元件 skill、範本跟著改。

**Independent Test**：所有護欄綠；沒有任何一份 component.json 宣告 `paths.execute`；「五路完備」那條護欄改量新的定義，且有一條注入測試證明它仍抓得到缺一路的元件。

### User Story 3 - 原本由直譯器守的語義，改由 Cella 守（Priority: P1）

刪掉只驗直譯器自己的測試之前，先確認它守的語義有沒有別的接手者；沒有的，改寫成程式碼字串、由 Cella 背書（6c 盤點風險 3：解構的順序、lambda 的捕捉、方法呼叫方法、虛擬分派）。

**Independent Test**：每一支被刪的測試檔，在刪除紀錄裡說得出「接手的是哪一支」或「它只驗直譯器自己」；那幾種 OOP／閉包語義各至少一條由 Cella 背書的測試。

### User Story 4 - 錯誤訊息的護欄不空轉（Priority: P2）

第四十四條護欄（學生看得到的執行錯誤都有人話）原本掃直譯器的錯誤表；改成掃 Cella 那條鏈（problem kind → 文案），掃到的條目數不得為零。

**Independent Test**：護欄的入口條件斷言「掃到的條目數 > 0」；一條注入測試證明少一則文案會紅。

### Edge Cases

- **型別或常數表被測試 import**（例如 `PIN_CONSTANTS` 住在 `pin_constant/execute.ts`）：搬到不隨執行刪的地方，或證明唯一的使用者也一起刪。
- **名字像執行、其實不是**（6c-1 的教訓：`args` 與 `call-args` 撞名）：搬或刪之前，以 import 圖為準，不以檔名判斷。
- **基線整批動**：每一份基線的調整都要在 note 寫「為什麼變」，不得只改數字。
- **CI 與本機差異**：刪之後全套在 CI 跑一次，並看 `gh run list`。

## Requirements *(mandatory)*

- **FR-001**: 非執行的模組（range-lift、device-names、printf 的擷取函式、`PIN_CONSTANTS`）MUST 先搬到不隨直譯器刪除的位置，行為不變，並與刪除分開提交。
- **FR-002**: 所有 component.json MUST NOT 再宣告 `paths.execute`；「五路」的定義 MUST 改成 lift／render／extract／generate ＋ formalize，護欄與元件 skill 的用語一致。
- **FR-003**: `src/interpreter/`、元件的 `execute.ts`、`lang/executors`、`lang/runtime`、`providers/js-interpreter`，以及只給執行用的輔助檔 MUST 刪除；刪除後 `src` 裡 MUST 沒有任何檔 import 這些路徑（由護欄守）。
- **FR-004**: 54 個 import 直譯器那一側的測試檔 MUST 逐支判定：刪（只驗直譯器自己，寫明）／改成 Cella 背書／改 import 到搬出去的模組。`audit-tests-import-reachable` 的兩筆 ALLOWED MUST 拿掉。
- **FR-005**: 6c 盤點風險 3 列的 OOP／閉包語義 MUST 各有至少一條由 Cella 背書的測試，才能刪掉原本手搭樹的那幾支。
- **FR-006**: 第四十四條護欄 MUST 改掃 Cella 的錯誤鏈，入口條件斷言掃到的數量大於零。
- **FR-007**: 合併前 MUST 跑全套、整輪 e2e、vsix 建置，並在合併後看 CI。

## Success Criteria *(mandatory)*

- **SC-001**: `src` 裡與直譯器相關的檔案數從約 370 個降到 0；import 已刪路徑的檔案數為 0。
- **SC-002**: 全套測試全綠、整輪 e2e 全綠；課文判決綁定語料與 StudyCpp 判決逐支與刪之前相同。
- **SC-003**: 全套測試的時間量一次並與刪之前比較（預期變快：每個測試檔少載入一套語義）。
- **SC-004**: vsix 建得起來，大小與刪之前比較（預期變小）。
- **SC-005**: 每一支被刪的測試檔都有一行接手紀錄。

## Assumptions

- 產品裡已經沒有任何執行路徑走到直譯器（spec 205 的 `audit-cella-only` 護欄在守）。
- 參照編譯器族（`interpreter-matches-compiler` 等）與 CLAUDE.md 🪦 段落的改寫屬於 6c-5，不在這一刀；它們若 import 直譯器，這一刀只做最小的改動讓它們繼續跑或標記為 6c-5 處理。
- 估時 1.5～2 天（6c 盤點的改估）；照 11-01 起的實際對照（估 1～2 天、實際約 4 天）可能翻倍。
