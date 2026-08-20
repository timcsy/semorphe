# 001：從「兩套 SemanticNode 定義並存」到「單一陣列版定義」

> 日期：2026-03-08

## 轉移

- **舊**：`src/core/types.ts`（有 `id`，`children: Record<string, SemanticNode[]>`）與 `src/core/semantic-model.ts`（無 `id`，`children: Record<string, SemanticNode | SemanticNode[]>`）並存。前者給 interpreter 和 blockly-panel 用，後者給模型工具函式用。
- **新**：統一為 `types.ts` 的定義（一律陣列），刪除 `semantic-model.ts`，工具函式（`nodeEquals`、`semanticEquals`、`walkNodes`、`serializeModel`、`deserializeModel`）遷入 `semantic-tree.ts`。

## 為什麼變

兩套型別在 TypeScript 的 structural typing 下**不報錯**——聯合型別 `A | A[]` 相容於 `A[]` 的某些用法——所以問題在靜態檢查中隱藏，直到 runtime 才爆炸。代價是：

- interpreter 中大量 `as SemanticNode` 斷言和 `Array.isArray()` 判斷
- `nodeEquals()` / `walkNodes()` 用的是無 `id` 版本，**無法與 interpreter 的節點互操作**
- 測試檔案混用兩套型別，同一概念出現兩種寫法

決定統一而非「讓兩者相容」，是因為相容層會讓分裂永久化。統一的代價是一次性的（約 15 個檔案的 import 更新 + 所有測試重寫），分裂的代價是持續的。

這也是「不做向後相容」原則在型別層的第一次應用。

## 狀態

✅ 已採用（commit `66885b7`）。`children` 一律陣列成為 [元件代數](../concepts/元件代數.md) 中 SemanticNode 標準形式的硬約束。

蒸餾出的教訓見 [experience.md](../experience.md)「型別分裂在『兩邊都能跑』時最危險」；完整現場見 [episodes/2026-03-08-兩套型別的統一.md](../episodes/2026-03-08-兩套型別的統一.md)。
