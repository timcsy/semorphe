# Research: 積木文字全面中文化與初學者友善改善

**Date**: 2026-03-04

## 結論

本功能無需技術研究。所有改動為純文字替換，使用現有 Blockly JSON 積木定義格式。以下記錄設計決策。

## 設計決策

### Decision 1: Message 文字策略 — 保留術語 + 括號中文說明

- **Decision**: 保留 C++ 術語（如 int、void、struct），旁加括號中文說明
- **Rationale**: 學生同時學習術語和概念，且右側程式碼編輯器使用原始語法，術語一致性有助理解
- **Alternatives considered**:
  - 純效果描述（如「整數」取代 int）→ 與程式碼編輯器術語脫節，反而造成混淆

### Decision 2: Tooltip 策略 — 白話效果說明

- **Decision**: tooltip 用白話說明效果，不含未解釋術語
- **Rationale**: tooltip 是輔助說明，應該最易懂。學生 hover 時想快速理解「這個積木做什麼」
- **Alternatives considered**:
  - 簡短術語定義 → 不夠直觀，學生仍需二次理解

### Decision 3: 身份標示策略 — message 中明確標出

- **Decision**: 在 message 中加入「變數」「函式」「陣列」「列表」等身份標示
- **Rationale**: 初學者可能不知道 x 是變數還是函式名，明確標示減少認知負擔
- **Alternatives considered**:
  - 只在 tooltip 中標示 → 不夠明顯，學生不一定會 hover

### Decision 4: 下拉選單只改 label 不改 value

- **Decision**: dropdown options 的第一個元素（label）改為中文，第二個元素（value）保持不變
- **Rationale**: 確保程式碼生成和 workspace 序列化完全不受影響，零風險
- **Alternatives considered**: 無（這是唯一安全做法）
