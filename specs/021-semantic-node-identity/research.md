# 研究筆記：Semantic Node Identity

**功能**: 021-semantic-node-identity | **日期**: 2026-03-10

## 概述

本功能無 NEEDS CLARIFICATION 項目。以下記錄關鍵技術決策與替代方案評估。

---

## 決策 1：CodeMapping 主鍵選擇

**決策**: 使用 `node.id`（語義層 ID）取代 `metadata.blockId`（投影層 ID）

**理由**:
- `node.id` 由 `createNode()` 自動分配，在語義樹建立時即存在
- `metadata.blockId` 僅在 Blockly 渲染後才可用，造成時序依賴
- 第一性原理要求：語義結構是唯一真相來源，投影間不應直接引用彼此的 ID

**評估的替代方案**:
1. **保留 blockId 但增加 fallback** — 仍有耦合，且需處理 blockId 不存在的邊界情況
2. **使用 AST 位置作為 key** — 不穩定，tree-sitter 重新解析後位置改變
3. **生成獨立的 mapping ID** — 增加不必要的間接層

---

## 決策 2：BlockMapping 存放位置

**決策**: `BlockMapping` 型別定義在 `code-generator.ts`（與 `CodeMapping` 同檔），由 `block-renderer.ts` 產出

**理由**:
- 維持映射型別集中定義，方便消費端 import
- `block-renderer.ts` 已有 `nextBlockId()` 邏輯，可在此記錄 nodeId→blockId 對應
- `sync-controller.ts` 作為消費端，同時持有 codeMappings 和 blockMappings

**評估的替代方案**:
1. **新增 `mapping-types.ts` 檔案** — 過度抽象，僅兩個型別不值得獨立檔案
2. **定義在 `types.ts`** — `types.ts` 是語義樹型別，mapping 屬投影層概念
3. **定義在 `sync-controller.ts`** — 產出方（renderer/generator）也需引用型別

---

## 決策 3：跨投影查詢策略

**決策**: 線性掃描 + `nodeId` join（不建索引）

**理由**:
- 資料量極小（< 100 筆），線性掃描 < 1ms
- 避免維護索引結構的複雜度
- YAGNI 原則：未來若有效能需求再加 Map 索引

**評估的替代方案**:
1. **`Map<nodeId, CodeMapping>` + `Map<blockId, BlockMapping>`** — 可行但目前不必要
2. **合併為單一映射表** — 違反投影解耦原則，程式碼映射不應包含 blockId

---

## 決策 4：`extractSemanticTree()` 中的 node.id 處理

**決策**: 驗證 `extractSemanticTree()` 保留 `node.id`，不修改 `createNode()` 邏輯

**理由**:
- `extractSemanticTree()` 從 Blockly 提取時呼叫 `createNode()`，會分配新 ID
- 這些 ID 與原始語義樹的 ID 不同，但這是可接受的（因 block→code 方向使用 Blockly 樹重建映射）
- Round-trip 穩定性（US3）為 best-effort，完整解決延遲至 SemanticDiff

**評估的替代方案**:
1. **在 Blockly block 上存儲原始 node.id** — 需修改 Blockly serialization，侵入性過大
2. **維護 blockId→nodeId 反查表** — 這正是 BlockMapping 的用途

---

## 決策 5：`rebuildSourceMappings` workaround 移除策略

**決策**: 在 CodeMapping 改用 `node.id` 後，`rebuildSourceMappings` 不再需要

**理由**:
- 目前 `rebuildSourceMappings` 存在的原因：lifted tree 沒有 blockId，需用 Blockly tree 重建
- 改用 `node.id` 後，lifted tree 的 `node.id` 由 `createNode()` 分配，天然存在
- `generateCodeWithMapping()` 可直接從 lifted tree 產出 CodeMapping（無需等 Blockly 渲染）

**風險**:
- 需確認 block→code 高亮路徑改用 `blockId→BlockMapping→nodeId→CodeMapping` 後仍正確
- 需確認 L0 scaffold stripping 不影響 nodeId 對應
