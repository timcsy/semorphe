# Research: 009-restore-legacy-features

## Decision 1: 執行引擎架構 — 主執行緒 vs Web Worker

**Decision**: 主執行緒執行，搭配步數上限（100,000 步）防護

**Rationale**:
- 教學場景程式碼規模小（<500 行），主執行緒足以應付
- SemanticInterpreter 已實作 step counting 和 maxSteps 保護
- Web Worker 需要序列化 SemanticNode（不可 transferable），overhead 高
- Web Worker 中無法直接操作 DOM，stdin 互動需複雜的 message passing
- 舊版在主執行緒運行良好，已驗證可行

**Alternatives considered**:
- Web Worker：隔離性好但序列化成本高，stdin 互動複雜度大幅增加
- SharedArrayBuffer：需要 COOP/COEP headers，部署限制多

## Decision 2: Console/變數面板整合策略 — 升級 vs 重寫

**Decision**: 升級新版 placeholder panels（src/ui/panels/），不使用舊版 panels

**Rationale**:
- 新版 panels 已有正確的目錄結構和基本骨架（constructor、container 注入）
- 舊版 panels 使用不同的 DOM 建構模式（直接建立 HTML），與新版 app.new.ts 的模式不一致
- 升級比重寫工作量小，且保持程式碼一致性
- 新版 VariablePanel 已有 VariableEntry interface 和 table 結構
- 需新增的功能：input prompt、status display、collapse toggle、scope grouping、change highlighting

**Alternatives considered**:
- 直接複製舊版 panels：API 不一致，需大量適配
- 完全重寫：浪費新版已有的骨架程式碼

## Decision 3: Source Mapping 實作位置

**Decision**: 在 code-generator 中同步產生 source mapping

**Rationale**:
- code-generator 逐節點遍歷語義樹產生程式碼，天然知道每個節點對應的行號範圍
- 避免二次遍歷語義樹
- 語義節點的 metadata 中已有 blockId（由 Blockly serialization 帶入）
- 產出格式：`{ blockId: string, startLine: number, endLine: number }[]`

**Alternatives considered**:
- 在 sync-controller 中後處理：需要再解析程式碼和積木的對應，複雜且脆弱
- 在 blockly-panel 的 extractBlock 中追蹤：只知道積木側，不知道程式碼行號

## Decision 4: 動態積木 mutator 策略

**Decision**: u_if_else 使用 Blockly 內建 mutator 齒輪（MutatorIcon），搭配 mini-workspace 讓學習者自由組合 else-if/else 結構

**Rationale**:
- mutator 齒輪提供更豐富的視覺化操作，學習者可以在 mini-workspace 中直觀地拖曳組合 else-if 和 else 區塊
- u_var_declare 已成功採用齒輪模式（見 plan 中的 u_var_declare 設計），u_if_else 應保持一致
- 齒輪模式允許更精細的結構控制（例如在中間插入/移除 else-if），+/- 按鈕只能在末尾操作
- 搭配 +/- 按鈕作為快捷操作（快速新增/移除末尾分支），兩者互補

**Alternatives considered**:
- 純 +/- 按鈕模式：操作簡單但缺乏中間插入能力，結構調整不夠靈活
- 純齒輪無 +/- 按鈕：常見的新增操作需要多一步（開啟齒輪），日常使用不夠高效

## Decision 5: 底部面板分頁切換元件

**Decision**: 建立新的 BottomPanel 元件（src/ui/layout/bottom-panel.ts），管理分頁標籤和面板切換

**Rationale**:
- 底部面板是新的佈局概念（右側分為上下兩半：程式碼 + Console/變數）
- 需要管理：分頁標籤、active 狀態、收合/展開、高度調整
- 與現有 SplitPane（左右分割）平行的佈局元件
- Console 和 VariablePanel 作為子元件注入

**Alternatives considered**:
- 在 app.new.ts 中直接操作 DOM：違反元件化原則，app.new.ts 已過長
- 使用第三方 tab 元件庫：增加依賴，overkill
