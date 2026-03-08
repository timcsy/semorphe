# Data Model: 前端 UI/UX 第一性原理合規

## Entities

### DegradationVisual

降級原因到視覺樣式的映射。

| Field | Type | Description |
|-------|------|-------------|
| cause | `'syntax_error' \| 'unsupported' \| 'nonstandard_but_valid'` | 降級原因 |
| colour | `string` | 積木背景色（hex） |
| borderColour | `string \| null` | 邊框色（null 表示不覆蓋） |
| tooltipKey | `string` | i18n tooltip key |
| cssClass | `string` | 附加在積木 SVG 上的 CSS class |

**Preset values**:
- `syntax_error`: colour=#FF6B6B, tooltipKey=DEGRADATION_SYNTAX_ERROR
- `unsupported`: colour=#9E9E9E, tooltipKey=DEGRADATION_UNSUPPORTED
- `nonstandard_but_valid`: colour=原色不變, borderColour=#4CAF50, tooltipKey=DEGRADATION_ADVANCED

### ConfidenceVisual

Confidence 等級到視覺樣式的映射。

| Field | Type | Description |
|-------|------|-------------|
| level | `ConfidenceLevel` | confidence 等級 |
| borderStyle | `'solid' \| 'dashed' \| 'none'` | 邊框樣式 |
| borderColour | `string \| null` | 邊框色 |
| opacity | `number` | 積木透明度（0-1） |
| tooltipKey | `string \| null` | i18n tooltip key |

**Preset values**:
- `high`: 無額外裝飾
- `warning`: borderColour=#FFC107, tooltipKey=CONFIDENCE_WARNING
- `inferred`: borderStyle=dashed, opacity=0.85, tooltipKey=CONFIDENCE_INFERRED

### CategoryColors

類別名稱到顏色的集中映射。

| Field | Type | Description |
|-------|------|-------------|
| categoryId | `string` | 類別識別（如 'data', 'operators', 'control'） |
| colour | `string` | 主要顏色（hex） |
| toolboxColour | `string` | toolbox 分類標籤顏色 |

### BlockStylePreset

Block Style 的參數組合。

| Field | Type | Description |
|-------|------|-------------|
| id | `string` | preset 識別符 |
| nameKey | `string` | i18n 顯示名稱 key |
| renderer | `'zelos' \| 'geras'` | Blockly 渲染器 |
| density | `'compact' \| 'normal' \| 'spacious'` | 間距密度 |
| colourScheme | `'scratch' \| 'classic' \| 'high_contrast'` | 配色方案 |
| inputsInline | `boolean` | 預設 inline 輸入 |

**Preset instances**:
- `scratch`: zelos + compact + scratch + true
- `classic`: geras + normal + classic + false
- `teaching`: zelos + spacious + high_contrast + true

### ToolboxStyleConfig

Style-aware 的 toolbox 配置參數。

| Field | Type | Description |
|-------|------|-------------|
| codeStyleId | `StylePresetId` | 目前的 Code Style（影響 I/O 排序） |
| level | `number` | 認知層級（影響可見積木） |
| languageId | `string` | 語言（影響可用積木） |

## Relationships

```
CategoryColors ←── BlockSpec.category (查表取色)
DegradationVisual ←── SemanticNode.metadata.degradationCause (lift 後設定)
ConfidenceVisual ←── SemanticNode.metadata.confidence (lift 後設定)
BlockStylePreset ←── UI 設定 (使用者選擇)
ToolboxStyleConfig ←── StyleManager + CognitiveLevel (組合決定 toolbox)
```

## State Transitions

### Block 視覺樣式生命週期

```
SemanticNode (with metadata)
  → block-renderer.ts: 讀取 metadata.degradationCause + confidence
  → BlockState.extraState: 攜帶 { degradationCause, confidence, annotations }
  → blockly-editor.ts: 積木載入後，讀取 extraState
  → Blockly API: setColour() + setTooltip() + setCommentText()
  → 使用者看到有視覺區分的積木
```

### Toolbox 更新觸發

```
Code Style 切換 → StyleManager.setActiveById() → triggerToolboxUpdate()
認知層級切換 → updateToolbox(registry, lang, level)
Block Style 切換 → 重建 workspace（renderer 變更時）或更新 theme
```
