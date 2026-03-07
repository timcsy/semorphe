# Implementation Plan: First Principles Compliance

**Branch**: `012-first-principles-compliance` | **Date**: 2026-03-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/012-first-principles-compliance/spec.md`

## Summary

實作四項第一性原理合規功能：(1) ConceptRegistry 完備性驗證腳本——掃描所有概念來源並檢查 lift/render/extract/generate 四條路徑完整性；(2) 擴展 confidence 系統至六級（high/warning/inferred/user_confirmed/llm_suggested/raw_code）並新增 degradationCause 欄位，在積木視圖中以顏色區分降級原因；(3) 註解 roundtrip——在 lift 階段解析三種 C++ 註解類型並附著為 annotation，在 generate 階段還原；(4) Code Style preset——讓 generate() 根據 CodingStyle 設定產出不同格式的程式碼，風格切換不影響語義樹。

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Blockly 12.4.1, web-tree-sitter 0.26.6, Monaco Editor 0.52.2, Vite 7.3.1
**Storage**: localStorage（瀏覽器自動儲存）
**Testing**: Vitest
**Target Platform**: Web（現代瀏覽器）
**Project Type**: Web application（雙面板積木+程式碼編輯器）
**Performance Goals**: 驗證腳本 < 5 秒；lift/generate roundtrip 無感知延遲
**Constraints**: 無後端依賴；所有邏輯在瀏覽器或 Node.js 測試環境中執行
**Scale/Scope**: ~40 個已註冊概念；C++ 單一語言

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 狀態 | 說明 |
|------|------|------|
| I. 簡約優先 | ✅ PASS | 四項功能各自對應明確的第一性原理缺口，無假設性擴充 |
| II. 測試驅動開發 | ✅ PASS | 每個 US 有獨立測試場景；驗證腳本本身即是測試工具 |
| III. Git 紀律 | ✅ PASS | 四個 US 可獨立 commit |
| IV. 規格文件保護 | ✅ PASS | 不修改 specs/ 下的文件；新增程式碼檔案 |
| V. 繁體中文優先 | ✅ PASS | 規格文件以繁體中文撰寫 |

## Project Structure

### Documentation (this feature)

```text
specs/012-first-principles-compliance/
├── spec.md              # 功能規格
├── plan.md              # 本檔案
├── research.md          # Phase 0 研究
├── data-model.md        # Phase 1 資料模型
└── checklists/
    └── requirements.md  # 需求品質檢查表
```

### Source Code (修改/新增)

```text
src/
├── core/
│   ├── types.ts                          # 擴展 NodeMetadata（confidence 6 級 + degradationCause）
│   ├── concept-registry.ts               # 不需修改（已有 listAll）
│   ├── lift/
│   │   └── lifter.ts                     # 設定 confidence + degradationCause
│   └── projection/
│       ├── template-generator.ts         # 還原 annotation → 註解
│       ├── code-generator.ts             # 支援 annotation 輸出
│       └── block-renderer.ts             # 依 degradationCause 設定積木視覺
│
├── languages/
│   └── cpp/
│       ├── lifters/
│       │   ├── comments.ts               # [新增] 註解 lift（三種類型）
│       │   └── index.ts                  # 註冊 comment lifter
│       ├── generators/
│       │   └── comments.ts               # [新增] annotation → 程式碼註解
│       └── styles/                       # 已存在，確認 preset 完整性
│
├── scripts/
│   └── verify-concept-paths.ts           # [新增] US1 驗證腳本
│
tests/
├── unit/
│   ├── core/
│   │   ├── confidence.test.ts            # [新增] confidence + degradationCause 測試
│   │   └── annotation-roundtrip.test.ts  # [新增] 註解 roundtrip 測試
│   └── scripts/
│       └── verify-concept-paths.test.ts  # [新增] 驗證腳本測試
└── integration/
    └── style-preset.test.ts              # [新增] 風格切換測試
```

**Structure Decision**: 沿用既有 `src/core/` + `src/languages/cpp/` 結構。驗證腳本放在 `src/scripts/` 下，可由 `npx tsx` 或 npm script 執行。

## Complexity Tracking

> 無 Constitution 違規，不需要此區段。

---

## 技術設計

### US1: ConceptRegistry 完備性驗證

**策略**: 建立獨立腳本 `src/scripts/verify-concept-paths.ts`，不依賴瀏覽器環境。

**概念來源收集**:
1. `src/blocks/universal.json` → 解析 `concept.conceptId`
2. `src/languages/cpp/blocks/*.json` → 解析 `concept.conceptId`
3. `src/languages/cpp/lift-patterns.json` → 解析 `concept.conceptId`
4. `src/languages/cpp/templates/universal-templates.json` → 解析 `conceptId`

**四條路徑檢查**:
- **lift path**: concept 出現在 BlockSpec.astPattern 或 LiftPattern 或手寫 lifter
- **render path**: concept 有 BlockSpec.renderMapping 或在 PatternRenderer 中有處理
- **extract path**: concept 有 BlockSpec.renderMapping（PatternExtractor 依此反向）
- **generate path**: concept 有 BlockSpec.codeTemplate 或 UniversalTemplate

**輸出格式**:
```
✓ var_declare: lift ✓ render ✓ extract ✓ generate ✓
✗ some_concept: lift ✓ render ✗ extract ✗ generate ✓
  Missing: render (no renderMapping), extract (no renderMapping)
```

**退出碼**: 0（全通過）/ 1（有缺失）

### US2: Confidence 與 DegradationCause

**types.ts 擴展**:
```typescript
// NodeMetadata.confidence 擴展為：
type ConfidenceLevel = 'high' | 'warning' | 'inferred' | 'user_confirmed' | 'llm_suggested' | 'raw_code'

// 新增：
interface NodeMetadata {
  confidence?: ConfidenceLevel  // 取代原本的 'high' | 'inferred'
  degradationCause?: 'syntax_error' | 'unsupported' | 'nonstandard_but_valid'
  // ... 其餘不變
}
```

**判定規則**（依 clarification 結果）:
- tree-sitter ERROR 節點 → `syntax_error`
- AST 節點類型對應 ConceptRegistry 已知概念但寫法不匹配 → `unsupported`
- AST 節點類型完全不在 ConceptRegistry 中 → `nonstandard_but_valid`

**lifter.ts 修改**:
- Level 1-2（pattern match 成功）→ `confidence: 'high'`
- composite pattern 結構匹配但語義驗證失敗 → `confidence: 'warning'`
- Level 3（部分子節點可 lift）→ `confidence: 'inferred'`
- Level 4（raw_code）→ `confidence: 'raw_code'` + 設定 `degradationCause`

**外層 confidence 獨立**（依 clarification）: 不受內層子節點影響。

**積木視覺**:
- `syntax_error` → 紅色背景 + 警告 icon
- `unsupported` → 灰色背景（中性）
- `nonstandard_but_valid` → 綠色邊框

### US3: 註解 Roundtrip

**Lift 階段** (`comments.ts`):

tree-sitter C++ 將註解解析為 `comment` 節點（`//` 和 `/* */` 都是）。在 liftStatements 中：

1. **獨立註解**: `comment` 節點沒有同行的 sibling → 建立 `createNode('comment', { text })`，加入平級 children
2. **行尾註解**: `comment` 節點的 `startPosition.row` 等於前一個 sibling 的 `endPosition.row` → 附著為前一節點的 `annotation({ position: 'inline' })`
3. **表達式內部註解**: `comment` 節點位於 expression 內部 → 附著為下一個 sibling 的 `annotation({ position: 'before' })`

**Generate 階段** (`comments.ts`):
- `comment` 語義節點 → `// text`
- `annotation(position: inline)` → 在語句後面加 ` // text`
- `annotation(position: before)` → 在子節點前加 `/* text */`

**raw_code 節點上的註解**（依 clarification）: 仍作為獨立 annotation 附著，不合併進 rawCode 文字。

### US4: Code Style Preset

**現有基礎**: `src/languages/style.ts` 已有 `STYLE_PRESETS`（apcs/competitive/google）和 `StyleManagerImpl`。`template-generator.ts` 已支援 `styleVariants`。

**需要補強**:
1. 確認 `generate()` 在所有路徑都尊重 `CodingStyle` 參數（特別是手寫 generator）
2. 手寫 generator（`io.ts`）需根據 `ioPreference` 選擇 cout vs printf
3. `braceStyle` 影響 `{` 的位置（K&R: 同行；Allman: 新行）
4. `indent` 影響縮排大小
5. `namespace_style` 影響 `using namespace std` vs `std::cout`

**風格切換不影響語義樹**（FR-019）: 已滿足——StyleManager 是獨立的 presentation layer。

**自訂覆蓋策略**（依 clarification）: 淺層覆蓋——自訂值直接覆蓋 preset 同名欄位，其餘保留 preset 預設。
