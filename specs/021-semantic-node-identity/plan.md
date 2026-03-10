# 實作計畫：Semantic Node Identity（語義節點身份）

**分支**: `021-semantic-node-identity` | **日期**: 2026-03-10 | **規格**: [spec.md](spec.md)
**輸入**: 將跨投影對應從 blockId 遷移到 node.id，消除投影間的直接耦合

## 摘要

將 SourceMapping 的主鍵從 Blockly 投影層 ID（`metadata.blockId`）遷移到語義層 ID（`node.id`）。新增 BlockMapping 對應表將 `nodeId` 與 `blockId` 關聯。跨投影查詢改為經由 `nodeId` join。程式碼生成可直接從語義樹產出 CodeMapping，不再依賴 Blockly 渲染。

## 技術上下文

**語言/版本**: TypeScript 5.x
**主要依賴**: Blockly 12.4.1, Monaco Editor, web-tree-sitter 0.26.6, Vite
**儲存**: N/A（記憶體中的映射表）
**測試**: Vitest
**目標平台**: 瀏覽器（Vite dev server）
**專案類型**: 教育工具（積木+程式碼雙向投影平台）
**效能目標**: 映射查詢 < 1ms（線性掃描，數據量小）
**約束**: 不改變 `SemanticNode` 型別（`id` 欄位已存在）；不改變 `createNode()` 的 ID 生成邏輯
**規模**: 單檔案程式（< 100 個語義節點），映射表 < 100 筆

## 憲法檢查

| 原則 | 狀態 | 說明 |
|------|------|------|
| I. 簡約優先 | ✅ 通過 | 僅遷移現有 mapping 系統，不新增抽象層；BlockMapping 是最小必要結構 |
| II. TDD | ✅ 將遵守 | 先寫測試再實作 |
| III. Git 紀律 | ✅ 將遵守 | 每個邏輯步驟 commit |
| IV. 規格保護 | ✅ 通過 | 不動 specs/ 內既有文件 |
| V. 繁體中文 | ✅ 通過 | 規格與計畫文件已用繁體中文 |

## 專案結構

### 文件（本功能）

```text
specs/021-semantic-node-identity/
├── spec.md
├── plan.md              # 本文件
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── mapping-interfaces.md
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit.tasks 產出
```

### 原始碼（需修改的檔案）

```text
src/
├── core/
│   └── projection/
│       ├── code-generator.ts    # SourceMapping → CodeMapping, generateNode 改用 node.id
│       └── block-renderer.ts    # renderToBlocklyState 記錄 nodeId→blockId 映射
├── ui/
│   ├── sync-controller.ts       # 維護 codeMappings + blockMappings, 跨投影查詢重構
│   ├── app.ts                   # 移除 rebuildSourceMappings workaround, 更新高亮處理
│   └── panels/
│       └── blockly-panel.ts     # extractSemanticTree 保留 node.id（驗證）
tests/
├── unit/
│   ├── core/
│   │   └── code-generator-mapping.test.ts  # CodeMapping 用 nodeId 的測試
│   └── ui/
│       └── sync-controller.test.ts         # 跨投影查詢測試更新
└── integration/
    └── source-mapping.test.ts              # 端對端映射測試更新
```

**結構決策**: 不新增檔案，僅修改現有檔案中的介面與邏輯。BlockMapping 定義在 `code-generator.ts`（與 CodeMapping 同處），由 `block-renderer.ts` 產出，由 `sync-controller.ts` 消費。

## 複雜度追蹤

無憲法違反，不需記錄。
