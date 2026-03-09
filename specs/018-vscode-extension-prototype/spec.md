# 功能規格：VSCode Extension 原型

**功能分支**: `018-vscode-extension-prototype`
**建立日期**: 2026-03-10
**狀態**: 草稿
**來源**: architecture-evolution.md Phase 4 — 在 VSCode 中跑起最小可用版本，blocks WebView + 原生程式碼編輯器，透過 SemanticBus postMessage 橋接

## 使用者情境與測試 *(必要)*

### 使用者故事 1 - 在 VSCode 中完成程式碼與積木的雙向轉換 (優先級: P1)

學習者在 VSCode 中打開一個 C++ 檔案。Extension 啟動後在側邊顯示「積木面板」。學習者在程式碼編輯器中寫下 `for (int i = 0; i < 10; i++) { cout << i << endl; }`，2 秒內積木面板顯示對應的視覺積木（一個計數迴圈包含一個列印積木）。學習者在積木面板中拖入一個新的「if」積木到迴圈體內，程式碼編輯器立即更新，顯示在 for 迴圈內插入了對應的 `if` 敘述。

**優先級理由**: 這是核心價值 — 與瀏覽器版相同的雙向程式碼/積木同步，現在能在開發者的主要工具（VSCode）中使用。沒有這個功能，extension 就沒有存在的理由。

**獨立測試**: 打開任意 C++ 檔案，確認積木出現，編輯任一側並確認另一側更新。交付「以積木看程式碼」的基本體驗。

**驗收情境**:

1. **Given** 在 VSCode 中打開了一個 C++ 檔案，**When** extension 啟動且使用者開啟積木面板，**Then** 積木面板顯示與程式碼內容對應的視覺積木。
2. **Given** 積木面板正在顯示某 C++ 檔案的積木，**When** 使用者在文字編輯器中修改程式碼，**Then** 積木面板在 2 秒內更新以反映變更。
3. **Given** 積木面板正在顯示某 C++ 檔案的積木，**When** 使用者修改積木（新增/移除/重排），**Then** 程式碼編輯器在 2 秒內更新以反映積木變更。
4. **Given** 使用者寫了 `for (int i = 0; i < 10; i++) { cout << i << endl; }`，**When** 查看積木面板，**Then** 顯示一個計數迴圈積木內含一個列印積木，且轉回程式碼後產生功能等效的 C++ 程式碼。

---

### 使用者故事 2 - Extension 生命週期管理 (優先級: P2)

使用者透過 VSIX 安裝 extension。打開 `.cpp` 檔案時 extension 自動啟動。命令面板中出現「Toggle Blocks Panel」命令。使用者可隨時開關積木面板。切換到非 C++ 檔案時，積木面板顯示空狀態。關閉 VSCode 後重新開啟，extension 記得積木面板的可見性狀態。

**優先級理由**: 沒有妥善的生命週期管理，extension 會崩潰、洩漏資源或讓使用者困惑。這是讓 US1 在實務中可用的基礎。

**獨立測試**: 安裝 VSIX 後，開關不同類型的檔案、切換面板、重啟 VSCode 來測試。交付穩定、不干擾的 extension 體驗。

**驗收情境**:

1. **Given** extension 已安裝，**When** 使用者打開 `.cpp` 或 `.c` 檔案，**Then** extension 啟動且「Toggle Blocks Panel」命令可用。
2. **Given** 積木面板已開啟，**When** 使用者切換到非 C++ 檔案，**Then** 積木面板顯示說明性空狀態（非錯誤訊息）。
3. **Given** 積木面板已開啟，**When** 使用者透過命令或 UI 關閉面板，**Then** 該面板的所有 extension 資源被乾淨地釋放。
4. **Given** 使用者先前有開啟積木面板，**When** 在同一工作區重啟 VSCode，**Then** 積木面板恢復到先前的可見性狀態。

---

### 使用者故事 3 - VSCode 中的認知層級篩選 (優先級: P3)

教師將 extension 設定為只顯示 Level 1（初學者）積木。學生打開 C++ 檔案時看到簡化的工具箱，只有基本構造（變數、迴圈、if/else、列印、輸入）。進階構造（指標、模板、類別）被隱藏。教師可透過 extension 設定調整層級。

**優先級理由**: 認知層級篩選是瀏覽器版的現有功能。移植到 VSCode 確保教育價值被保留。但它依賴 US1 和 US2 先完成。

**獨立測試**: 變更認知層級設定，重新開啟積木面板，確認只出現適當的積木。交付「漸進式揭露」的教育效益。

**驗收情境**:

1. **Given** extension 的認知層級設定為 Level 1，**When** 積木面板開啟，**Then** 工具箱只顯示初學者適用的積木。
2. **Given** extension 的認知層級設定從 Level 1 改為 Level 2，**When** 積木面板重新整理或重新開啟，**Then** 中級積木在初學者積木之外額外出現。

---

### 邊界案例

- 使用者編輯含有語法錯誤的 C++ 檔案時會怎樣？Extension 應顯示能解析的積木，並對無法解析的區域顯示診斷指示，不得崩潰。
- 使用者開啟超大 C++ 檔案（>5000 行）時會怎樣？Extension 應在可接受的延遲（<5 秒）內處理，或顯示大檔案限制的警告。
- WebView 載入失敗時（如 Content Security Policy 阻擋腳本）會怎樣？Extension 應顯示清楚的錯誤訊息並提供疑難排解指引。
- 使用者在短時間內同時編輯積木和程式碼會怎樣？以最後一次編輯為準，不得有資料損毀或無限同步迴圈。
- 使用者同時開啟多個 C++ 檔案時會怎樣？積木面板跟隨作用中的編輯器 — 切換分頁即切換顯示的積木。

## 需求 *(必要)*

### 功能需求

- **FR-001**: Extension MUST 在 C++ 原始檔（`.cpp`、`.cc`、`.cxx`、`.c`、`.h`、`.hpp`）被開啟時啟動。
- **FR-002**: Extension MUST 提供命令（「Toggle Blocks Panel」）來開關積木視覺化面板。
- **FR-003**: 積木面板 MUST 顯示代表作用中 C++ 檔案語義結構的視覺積木。
- **FR-004**: 使用者在文字編輯器中編輯程式碼時，積木面板 MUST 在 2 秒內更新以反映變更。
- **FR-005**: 使用者在積木面板中修改積木時，程式碼編輯器 MUST 在 2 秒內更新以反映變更。
- **FR-006**: Extension MUST 重用現有的語義核心（概念註冊、pattern lifter、code generator、block renderer、pattern renderer、pattern extractor、template generator），不得重新實作任何核心邏輯。
- **FR-007**: 積木面板 MUST 支援完整的現有積木工具箱，包含所有認知層級。
- **FR-008**: Extension MUST 允許使用者透過 extension 設定配置認知層級。
- **FR-009**: 積木面板 MUST 跟隨作用中的編輯器 — 使用者在 C++ 檔案間切換時，積木更新以匹配新啟動的檔案。
- **FR-010**: Extension MUST 優雅地處理含語法錯誤的 C++ 檔案，顯示可解析的積木和診斷指示，不得崩潰。
- **FR-011**: 積木面板和程式碼編輯器 MUST NOT 在雙方同時更新時進入無限同步迴圈。
- **FR-012**: Extension MUST NOT 破壞現有的瀏覽器版應用 — 兩者必須在同一程式碼庫中共存。

### 關鍵實體

- **Extension Host**: 運行語義核心、執行 lifting/generation、協調程式碼編輯器與積木面板之間通訊的背景程序。
- **Blocks WebView**: 運行視覺積木編輯器的隔離面板，透過訊息傳遞與 Extension Host 通訊。
- **SemanticBus 橋接器**: 在 Extension Host 的程序內事件與 WebView 的訊息傳遞協議之間進行轉譯的通訊層。
- **作用中文件**: 當前聚焦的 C++ 檔案，其語義表示顯示在積木面板中。

## 成功指標 *(必要)*

### 可量測成果

- **SC-001**: 使用者可以寫 C++ 程式碼、以積木查看、修改積木並確認程式碼正確更新 — 對 50 行程式完成一次完整來回在 10 秒內。
- **SC-002**: Extension 在打開 C++ 檔案後 3 秒內啟動，積木面板在開啟後 5 秒內完成渲染。
- **SC-003**: 新增 extension 到程式碼庫後，100% 的現有瀏覽器版測試套件持續通過。
- **SC-004**: 積木面板正確顯示所有初學者構造的積木：變數、迴圈（for/while）、條件（if/else）、列印、輸入。
- **SC-005**: 連續編輯程式碼或積木 20 次，產生一致且正確的結果，無同步失敗或資料遺失。

## 範圍

### 範圍內

- Extension 專案結構和建置配置
- Extension 啟動和生命週期管理
- 積木面板作為隔離的 WebView，運行視覺積木編輯器
- 雙向同步：程式碼編輯器 ↔ 語義樹 ↔ 積木面板
- 認知層級設定以篩選工具箱
- 僅支援 C++ 語言（使用現有語言模組）

### 範圍外

- VSCode 中的主控台/執行面板（未來階段）
- VSCode 中的變數監看面板（未來階段）
- VSCode 中的除錯工具列（未來階段）
- Marketplace 上架（本階段僅手動安裝 VSIX）
- 多語言支援（Python 等）— 僅 C++
- 協作編輯或多使用者功能
- 語義增量差異更新（本階段僅全量同步）

## 假設

- 現有語義核心模組可同時打包為 Extension Host 和 WebView 瀏覽器環境使用，無需修改
- 視覺積木編輯器函式庫可在 WebView 面板中以適當的 Content Security Policy 配置運行
- tree-sitter WASM 解析器模組可在 Extension Host 程序中載入
- 使用者透過 VSIX 手動安裝；本階段不需 marketplace 發行
- Extension 目標與現有瀏覽器應用相同的 C++ 子集
- 瀏覽器應用的原始碼不被修改 — extension 為附加的獨立專案

## 依賴

- Phase 0（ViewHost + SemanticBus）：已完成
- Phase 1（SyncController 解耦）：已完成
- Phase 2（app.ts 拆分）：已完成
- Phase 3（concept/blockDef 分離）：已完成
- 現有語義核心 `src/core/`
- 現有 C++ 語言模組 `src/languages/cpp/`
- 現有積木註冊器 `src/ui/block-registrar.ts`
- 現有工具箱建構器 `src/ui/toolbox-builder.ts`
