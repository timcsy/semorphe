# Research: C++ Std Modules Reorganization

## R1: 如何拆分交織的 generators/lifters

### 問題

現有的 `generators/io.ts` 同時包含 cout/cin（iostream）和 printf/scanf（cstdio）的程式碼生成邏輯。`lifters/io.ts` 和 `lifters/expressions.ts` 同樣交織兩種 IO 模式的偵測。如何乾淨地拆分？

### 決策

按 header 拆分為獨立檔案，共用的 helper 函式提取到 core 或 std 層級的 utils。

### 理由

- `generators/io.ts` 中的 `registerIOGenerators` 接收 `style` 參數，內部根據 `io_style` 分支
- 拆分後 iostream/generators.ts 只包含 cout/cin 邏輯，cstdio/generators.ts 只包含 printf/scanf 邏輯
- 兩者的 register 函式都由上層聚合器呼叫，style 參數決定哪個生效
- lifters 同理：iostream/lifters.ts 處理 `<<`/`>>` 鏈，cstdio/lifters.ts 處理 `printf`/`scanf` call

### 替代方案

- **保持 io.ts 整體不拆**：違背按 header 組織的目標
- **用 adapter pattern 包裝**：過度設計，直接拆分更簡單

---

## R2: 模組聚合模式

### 問題

瀏覽器版和 VSCode 版都需要載入所有 std 模組。如何設計聚合入口？

### 決策

`std/index.ts` 匯出 `allStdModules: StdModule[]` 陣列，各入口點 import 後 flatMap 取得概念/積木，迴圈註冊 generators/lifters。

### 理由

- 新增模組只需在 `std/index.ts` 加一行 import + 推入陣列
- 不需要 manifest.json 或動態載入機制
- 靜態 import 確保 tree-shaking 和型別安全
- 符合 spec FR-004「不需要外部套件機制」

### 替代方案

- **動態 require/import**：增加複雜度，不適合 Vite bundler
- **Manifest-driven loading**：spec 明確排除

---

## R3: Auto-include 與現有 generator pipeline 整合

### 問題

目前程式碼生成流程是 semantic tree → 逐節點呼叫 generator → 拼接。`#include` 目前由手動 `c_include` 積木的 generator 產生。Auto-include 如何介入？

### 決策

在 top-level generator（處理 `program` 節點）中，掃描整棵 semantic tree 收集所有概念 ID，透過 Module Registry 查詢所需 headers，在最終輸出的頂部插入 `#include` 行。與手動 `c_include` 積木產生的 include 合併去重。

### 理由

- 不改變單一節點的 generator 邏輯
- 只在最外層（program node）新增一個 post-processing 步驟
- 去重邏輯簡單：收集所有 header strings → Set → 排序 → 輸出

### 替代方案

- **每個 generator 自行註冊 include**：散落各處，難以去重
- **Lifter 階段插入 include 節點**：改變 semantic tree 語意，不合適

---

## R4: Universal 概念的模組歸屬

### 問題

`print` 和 `input` 是 universal 概念（定義在 `src/blocks/semantics/universal-concepts.json`），但在 C++ 中它們對應 iostream。如何處理歸屬？

### 決策

Std 模組可以「認領」universal 概念。iostream 模組的 generators.ts 註冊 `print` 和 `input` 的 C++ generator。Module Registry 記錄 `print → iostream` 的映射，用於 auto-include。

### 理由

- Universal 概念的語意定義不變（仍在 universal-concepts.json）
- 只是 generator 和 lifter 的實作歸屬到對應的 std 模組
- 這是自然的分層：語意層不變，實作層按 header 組織

### 替代方案

- **在 universal 層標記 header**：違反「universal 是語言無關的」原則
- **建立額外的 mapping 檔案**：增加維護成本，不如直接在模組中註冊

---

## R5: 遷移期間的向後相容

### 問題

遷移是 big-bang 還是漸進式？如何確保每步都能通過測試？

### 決策

漸進式遷移，每個 header 獨立搬遷。舊檔案在所有內容搬完後才刪除。

### 理由

- 每步遷移後可執行 `npm test` 驗證
- 若某個 header 的遷移出問題，只需回退該 header
- 搬遷順序：core（最大但最穩定）→ iostream → cstdio → vector → algorithm → string → cmath
- 舊檔案暫時保留為空殼（import 重導向），直到所有 import 更新完成

### 替代方案

- **Big-bang**：風險太高，一次改動太多檔案
- **Feature flag 切換**：過度設計，這是純粹的檔案組織重構
