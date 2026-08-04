# 009：從「手寫 lifter 為主」到「宣告式 JSON pattern 為主」

> 日期：2026-03-11

## 轉移

- **舊**：C++ 的 lifting 大量依賴 hand-written lifter 函式（19 個），JSON pattern 只處理最單純的情況。同期還存在硬編碼的 P3 pattern。
- **新**：19 個手寫 lifter 遷移為宣告式 JSON pattern；硬編碼 pattern 改為 registry-based 架構。**Layer 3 手寫成為逃生口，不是預設選項。**

## 為什麼變

手寫 lifter 是「能動就好」的自然產物，但它把 P3 的承諾架空了：如果加一個新概念總是要寫一個新的 TypeScript 函式，那「不修改既有程式碼就能擴充」只在字面上成立——實際上每個語言模組都在長出自己的一套私有邏輯，核心無從驗證、無從仲裁。

三層表達力的覆蓋率預期（Layer 1 純 JSON ~80%、Layer 2 transform ~15%、Layer 3 strategy ~5%）當時嚴重失衡。遷移的目的是讓實際分佈回到預期——**能宣告的就不要用程式碼寫**，因為宣告式 pattern 可以被歧義偵測器分析，手寫函式不行。

這也是 [005 偏序仲裁](005-pattern-歧義從禁止到偏序仲裁.md) 能發揮作用的前提：仲裁規則作用在 constraints 集合上，而手寫 strategy 沒有可分析的 constraints。愈多邏輯留在手寫函式裡，歧義偵測能看見的範圍就愈小。

## 狀態

✅ 已採用（commit `0a0c592` 遷移 19 個 lifter，`8f18a91` 以 registry-based 架構消除 P3 硬編碼 pattern，TDD）。

**判準留下來了**：只有當同一 nodeType 需要根據內容映射到不同概念、且 constraints 之間交叉不可比較時，才用 Layer 3。
