# 功能規格：Semantic Node Identity（語義節點身份）

**功能分支**: `021-semantic-node-identity`
**建立日期**: 2026-03-10
**狀態**: 草稿
**輸入**: 「將跨投影對應（source mapping）從 Blockly 投影層 ID（blockId）遷移到語義層 ID（node.id），消除投影間的直接耦合。」

## 使用者情境與測試 *(必填)*

### 使用者故事 1 — 無渲染依賴的跨投影高亮 (優先級: P1)

使用者編輯程式碼後點擊積木（或反之），系統在另一個視圖中高亮對應元素。目前此功能僅在 Blockly 完成渲染（分配 blockId）後才能運作。引入語義節點身份後，程式碼側的映射在程式碼生成時即可建立，無需等待積木視圖渲染。

**為何此優先級**: 這是核心價值。目前架構存在時序依賴：code→blocks 方向的 mapping 必須等 Blockly 渲染完成，導致空映射和高亮失敗。修正此問題即消除根因。

**獨立測試**: 從語義樹生成程式碼，驗證 source mapping 使用語義節點 ID 產出，無需任何積木渲染步驟。

**驗收情境**:

1. **Given** lifter 產出的語義樹（尚未進行積木渲染），**When** 從該樹生成程式碼，**Then** source mapping 包含有效的 nodeId→行號範圍（非空）。
2. **Given** 使用者在積木視圖中點擊一個積木，**When** 系統查詢對應的程式碼行，**Then** 查詢路徑為 blockId→nodeId→程式碼行號範圍，且高亮正確。
3. **Given** L0 認知等級（scaffold 被剝離），**When** 使用者選取一個輸出積木，**Then** 高亮的是 `int main()` 內的正確程式碼行，而非 scaffold 行。

---

### 使用者故事 2 — 解耦的投影映射 (優先級: P2)

每個投影（程式碼、積木、未來的流程圖等）各自維護以語義節點 ID 為鍵的映射表。投影之間不引用彼此的內部 ID。新增投影類型只需建立自己的 nodeId→元素映射，不需修改現有投影。

**為何此優先級**: 這建立了「投影獨立」的架構不變量。沒有它，每新增一個投影就需要 N-1 個與其他投影的適配映射。

**獨立測試**: 驗證程式碼映射表不包含 blockId，積木映射表不包含行號。

**驗收情境**:

1. **Given** 從語義樹生成程式碼，**When** 檢查產出的 source mapping，**Then** 每筆記錄包含 `nodeId` 和行號範圍，不存在 `blockId` 欄位。
2. **Given** 從語義樹渲染積木，**When** 檢查積木映射，**Then** 每筆記錄包含 `nodeId` 和 `blockId`，不存在行號欄位。
3. **Given** 概念上新增一種投影類型，**When** 該投影建立自己的 `{ nodeId, elementId }` 映射，**Then** 跨投影查詢透過 nodeId join 運作，不需修改程式碼或積木映射邏輯。

---

### 使用者故事 3 — Round-Trip 中的穩定節點身份 (優先級: P3)

使用者編輯積木後系統生成程式碼，接著使用者編輯程式碼後系統更新積木——在此過程中，代表相同邏輯結構的語義節點應保持相同的 ID。此穩定性是未來語義 Diff（偵測兩版樹之間的差異）的基礎。

**為何此優先級**: 這是為 SemanticDiff 鋪路的前瞻性基礎設施。沒有穩定 ID，diff 只能靠結構位置猜測（脆弱）。本故事驗證穩定性特性，不需建構完整 diff 引擎。

**獨立測試**: 執行 blocks→code→blocks 的 round-trip，驗證未變更節點的語義節點 ID 保持一致。

**驗收情境**:

1. **Given** 一棵具有已知節點 ID 的語義樹，**When** 生成程式碼再重新 lift 回語義樹，**Then** 代表相同邏輯結構的節點保持相同 ID（或存在確定性映射）。
2. **Given** 使用者在既有程式中新增一個積木，**When** 樹被重新生成，**Then** 既有節點保留原 ID，僅新節點擁有新 ID。

---

### 邊界情況

- `extractSemanticTree()` 從 Blockly 產出的節點若缺少 `node.id`，系統必須分配一個或使用 fallback。
- 同一語義節點因重新建立而在 code mapping 和 block mapping 中擁有不同 ID 時，系統應接受最新的 ID。
- L0 scaffold stripping 建立的包裝節點應有 ID，但不應出現在使用者面向的映射中。
- 積木被刪除後重新加入時，新積木獲得新節點 ID，舊映射應被清理。

## 需求 *(必填)*

### 功能需求

- **FR-001**: Source mapping 條目必須使用語義節點 ID（`node.id`）作為主鍵，不得使用任何投影層特定的 ID。
- **FR-002**: 程式碼生成過程中必須為每個具有 ID 的語義節點記錄 `{ nodeId, startLine, endLine }`。
- **FR-003**: 積木渲染過程中必須為每個對應到 Blockly 積木的語義節點記錄 `{ nodeId, blockId }`。
- **FR-004**: 跨投影查詢（block→code、code→block）必須以 nodeId 作為 join key 進行。
- **FR-005**: 程式碼映射表必須在無積木渲染步驟的情況下可產出（不依賴 Blockly）。
- **FR-006**: 積木映射表必須在無程式碼生成步驟的情況下可產出（不依賴程式碼視圖）。
- **FR-007**: 所有現有的跨投影高亮行為（點擊積木→高亮程式碼、點擊程式碼→高亮積木）在 L0、L1、L2 認知等級下必須持續正確運作。
- **FR-008**: 目前的 `rebuildSourceMappings` workaround（因 code→blocks 在 Blockly 渲染前無映射而需要）在本功能完成後必須可移除。

### 關鍵實體

- **CodeMapping**: 將語義節點與生成程式碼中的行號範圍關聯。關鍵屬性：nodeId、startLine、endLine。
- **BlockMapping**: 將語義節點與對應的 Blockly 積木關聯。關鍵屬性：nodeId、blockId。
- **SemanticNode.id**: 每個語義節點上的既有唯一識別碼，由 `createNode()` 自動分配。作為所有投影映射的 join key。

## 成功標準 *(必填)*

### 可衡量成果

- **SC-001**: 100% 的 source mapping 條目使用 `nodeId` 而非 `blockId`——映射介面中不存在投影層特定的 ID。
- **SC-002**: code→blocks 方向在程式碼生成後即產出有效的 code mapping，不需在積木渲染後進行額外的 rebuild 步驟。
- **SC-003**: 所有現有 1601+ 測試通過，無回歸。
- **SC-004**: 跨投影高亮在 L0、L1、L2 認知等級下 100% 正確（點擊積木高亮準確的程式碼行，反之亦然）。
- **SC-005**: 新增假設的投影類型僅需建立自己的 `{ nodeId, elementId }` 映射——現有程式碼與積木映射邏輯零修改。

## 假設

- `SemanticNode.id` 欄位與 `createNode()` 自動分配機制已存在且正確運作。
- Blockly 的 `extractSemanticTree()` 保留了用於渲染積木的語義樹上的 `node.id`。
- 目前 app.ts 中的 `rebuildSourceMappings` 模式是一個 workaround，在程式碼映射直接從 `node.id` 產生後即可移除。
- Round-trip 中的節點 ID 穩定性（US3）在此階段為盡力保證（best-effort）；完全確定性的穩定性延遲至 SemanticDiff 階段。

## 範圍界定

### 範圍內

- 將 SourceMapping 從 blockId 遷移至 nodeId
- 建立 BlockMapping 作為獨立的映射表
- 重構跨投影查詢以 nodeId 為 join key
- 移除 `rebuildSourceMappings` workaround
- 驗證 extractSemanticTree 中的 node ID 保留

### 範圍外

- 完整的 SemanticDiff 引擎（延遲至 Phase 8.2）
- 新投影類型（流程圖、資料流——本功能僅建立模式）
- 變更 `createNode()` 的 ID 生成方式（現有實作已足夠）
- 協作編輯或 CRDT 式 ID 方案
