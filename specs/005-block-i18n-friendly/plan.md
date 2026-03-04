# Implementation Plan: 積木文字全面中文化與初學者友善改善

**Branch**: `005-block-i18n-friendly` | **Date**: 2026-03-04 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/005-block-i18n-friendly/spec.md`

## Summary

將所有 67 個積木的 message、tooltip、下拉選單顯示文字改為中文友善版本。只改動顯示文字（label），不改動 field value，確保程式碼生成和 workspace 序列化不受影響。涉及 4 個 JSON 積木定義檔和 1 個動態積木註冊檔。

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Blockly 12.4.1, web-tree-sitter 0.26.6, CodeMirror 6.0.2
**Storage**: localStorage（瀏覽器本地）
**Testing**: Vitest（vitest）
**Target Platform**: 瀏覽器（Chrome/Firefox/Edge）
**Project Type**: Web 應用程式（Blockly 積木程式編輯器）
**Performance Goals**: N/A（純文字改動，無效能影響）
**Constraints**: 只改 label/message/tooltip，不改 field value；向後相容 localStorage 已存 workspace
**Scale/Scope**: 4 個 JSON 檔 + 1 個 TypeScript 檔中的動態積木 + 相關測試更新

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 狀態 | 說明 |
|------|------|------|
| I. 簡約優先 | ✅ PASS | 只改文字，不新增抽象或架構，無過度設計 |
| II. 測試驅動開發 | ✅ PASS | 會先更新測試中引用的 message 字串，再改實際文字 |
| III. Git 紀律 | ✅ PASS | 按 JSON 檔案分批 commit（universal → basic → advanced → special → dynamic → tests） |
| IV. 規格文件保護 | ✅ PASS | 不涉及 spec/plan/tasks 檔案修改 |
| V. 繁體中文優先 | ✅ PASS | 積木文字全面使用繁體中文 |

## Project Structure

### Documentation (this feature)

```text
specs/005-block-i18n-friendly/
├── plan.md              # 本檔案
├── research.md          # Phase 0 輸出（本次無需研究，記錄設計決策）
├── data-model.md        # Phase 1 輸出（積木文字改動清單）
└── tasks.md             # Phase 2 輸出（/speckit.tasks 產生）
```

### Source Code (repository root)

```text
src/
├── blocks/
│   └── universal.json          # 22 個 universal 積木定義 ← 修改 message/tooltip/dropdown label
├── languages/cpp/blocks/
│   ├── basic.json              # 10 個 basic 積木定義 ← 修改 message/tooltip/dropdown label
│   ├── advanced.json           # 27 個 advanced 積木定義 ← 修改 message/tooltip/dropdown label
│   └── special.json            # 8 個 special 積木定義 ← 修改 message/tooltip/dropdown label
└── ui/
    └── blockly-editor.ts       # 5 個動態積木註冊 ← 修改 message/tooltip/dropdown label

tests/
├── integration/
│   └── ux-features.test.ts     # UX 測試 ← 若引用 message 字串需同步更新
└── ...                         # 其餘測試不應受影響（只依賴 field value）
```

**Structure Decision**: 使用現有專案結構，不新增檔案或目錄。所有改動都在既有檔案中修改文字內容。

## 實作策略

### 改動原則

1. **message 格式**：中文口語描述 + 保留必要術語加括號說明
   - 範例：`int（整數）`、`把變數 %1 設成 %2`
2. **tooltip 格式**：白話說明效果和用法，不含未解釋術語
   - 範例：「輸入一個數字，可以用在計算或比較中」
3. **dropdown label 格式**：術語（中文說明），value 不動
   - 範例：`["int（整數）", "int"]`
4. **身份標示**：在 message 中明確標出變數、函式、陣列、列表等身份
   - 範例：「把**變數** x 設成」、「呼叫**函式** func（）」

### 型別下拉標準對照

所有出現型別下拉的積木統一使用以下 label：

| Value | Label |
|-------|-------|
| int | int（整數） |
| float | float（小數） |
| double | double（精確小數） |
| char | char（字元） |
| long long | long long（大整數） |
| string | string（文字） |
| bool | bool（是/否） |
| void | void（無回傳） |

### 風險評估

- **低風險**：只改 JSON 的 message/tooltip/args[].options label，不改 value
- **程式碼生成**：generator 只讀 field value，不受 label 改動影響
- **code→blocks 轉換**：parser/converter 不依賴 message 文字
- **localStorage 相容**：serialization 使用 field value，label 改動不影響舊 workspace 載入
- **唯一風險**：測試中硬編碼 message 字串比對需同步更新

## Complexity Tracking

> 無違反項目，不需要 justification。
