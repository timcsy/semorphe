# Research: C++ 指標與參照積木 UX 重設計

## 研究項目

### R1: 現有實作是否已支援指標宣告初始化？

**Decision**: Generator、lifter、executor 都**已經支援** `initializer` children — 只有 BlockSpec JSON 缺少 INIT 輸入槽位。

**Rationale**:
- `declarations.ts:184-199`：generator 已檢查 `node.children.initializer`，有值時產生 `= ${val}`
- `strategies.ts:46-58`：lifter 已從 `pointer_declarator` 的 `value` 欄位提取初始值
- `pointers.ts:28-37`：executor 已處理 `children.initializer` 進行 `scope.declare`

**Alternatives considered**: 無 — 純粹是 BlockSpec 缺漏。

### R2: 向後相容方案

**Decision**: 不需要額外遷移邏輯。Blockly 的 `input_value` 在反序列化時如果找不到對應資料，會建立空輸入。

**Rationale**: 測試現有 Blockly 行為：新增的 `input_value` 不在舊版 JSON 中時，積木仍正常載入，INIT 輸入為空。

**Alternatives considered**:
- `loadExtraState` 遷移 hook — 不需要，因為沒有資料要遷移
- `mutationToDom` / `domToMutation` — 過時的 API，已不使用

### R3: 參照積木的分類位置

**Decision**: 保持現有分類結構（參照在 `data` category，指標在 `pointers` category）。

**Rationale**: 兩者已在不同的 toolbox 分類中，天然形成視覺區分。強行合併反而增加混淆。

**Alternatives considered**:
- 合併到同一 `pointers_and_refs` category — 反而降低區分度
- 參照移到 `pointers` 但用子標籤 — 不必要的複雜度

### R4: 標籤內符號的展示格式

**Decision**: 描述性標籤 + 括號內附原始符號（如 `取得 %1 指向的值 (*)`）。

**Rationale**: 由使用者在 clarification 中確認。平衡可讀性與語法學習。

**Alternatives considered**:
- 純描述式（無符號）— 與真實程式碼斷裂
- 符號放在圖示/徽章中 — 需要額外 Blockly 客製化

### R5: concepts.json 是否需要更新？

**Decision**: 需要。`cpp_pointer_declare` 的 `children` 欄位目前為空物件 `{}`，應改為 `{ "initializer": "expression" }`。

**Rationale**: 雖然 generator/lifter 已經在程式碼中使用 `children.initializer`，但 concepts.json 作為概念的正式定義應反映實際結構。
