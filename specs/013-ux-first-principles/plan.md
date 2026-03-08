# 實作計畫：前端 UI/UX 第一性原理合規

**分支**：`013-ux-first-principles` | **日期**：2026-03-08 | **規格**：[spec.md](spec.md)
**輸入**：`/specs/013-ux-first-principles/spec.md` 的功能規格

## 摘要

實現前端 UI/UX 第一性原理的完整合規：(1) 降級積木依 degradationCause 顯示不同顏色/tooltip；(2) confidence 等級影響積木邊框；(3) 顏色集中管理取代散落硬編碼；(4) toolbox 完全動態生成 + 認知層級過濾；(5) Code Style 影響 toolbox I/O 排序；(6) annotations 在積木上可見；(7) Block Style preset 切換 UI。

技術方案：透過 BlockState.extraState 攜帶 metadata，積木載入後用 Blockly API (setColour/setTooltip/setCommentText) 動態設定視覺樣式；建立 category-colors.ts 集中顏色定義；toolbox 由 registry 動態生成 + style-aware 排序；toolbar 新增 Block Style dropdown。

## 技術背景

**語言/版本**：TypeScript 5.x
**主要相依套件**：Blockly 12.4.1、web-tree-sitter 0.26.6、Vite
**儲存方式**：localStorage（瀏覽器）
**測試框架**：Vitest
**目標平台**：Web（現代瀏覽器）
**專案類型**：Web 應用程式（教育用積木式程式設計）
**限制條件**：Blockly renderer 切換需重建 workspace；theme 可動態切換

## 規範檢查

*所有門檻已通過，無違規。*

- 單一語言（TypeScript）— 通過
- 無不必要的抽象 — 通過（重用既有 BlockSpecRegistry、StyleManager）
- 透過 Vitest 進行測試覆蓋 — 通過

## 專案結構

### 文件（本功能）

```text
specs/013-ux-first-principles/
├── plan.md              # 本檔案
├── research.md          # 階段 0 輸出
├── data-model.md        # 階段 1 輸出
├── quickstart.md        # 階段 1 輸出
├── checklists/          # 品質檢查清單
└── tasks.md             # 階段 2 輸出（由 /speckit.tasks 建立）
```

### 原始碼（repository 根目錄）

```text
src/
├── core/
│   ├── types.ts                          # DegradationCause、ConfidenceLevel（已定義）
│   ├── block-spec-registry.ts            # BlockSpecRegistry（已存在，新增 category 查詢）
│   ├── cognitive-levels.ts               # BLOCK_LEVELS（已存在，可能需更新）
│   └── projection/
│       └── block-renderer.ts             # renderBlock — 新增 extraState 攜帶降級/confidence/annotations
├── ui/
│   ├── theme/
│   │   └── category-colors.ts            # 新建：集中的 CATEGORY_COLORS 映射表
│   ├── panels/
│   │   └── blockly-panel.ts              # 修改：載入後視覺樣式處理、toolbox 重建
│   ├── toolbar/
│   │   ├── style-selector.ts             # 修改：改名為 Code Style 下拉選單
│   │   └── block-style-selector.ts       # 新建：Block Style preset 下拉選單
│   └── app.new.ts                        # 修改：連接新的選擇器、toolbox 更新觸發
├── languages/
│   └── style.ts                          # 修改：新增 BlockStylePreset 型別 + BLOCK_STYLE_PRESETS

tests/
├── unit/
│   └── category-colors.test.ts           # 新建：顏色集中管理測試
├── integration/
│   ├── degradation-visual.test.ts        # 新建：降級原因視覺測試
│   ├── confidence-visual.test.ts         # 新建：confidence 視覺測試
│   ├── toolbox-dynamic.test.ts           # 新建：toolbox 動態生成測試
│   └── annotation-visual.test.ts         # 新建：annotation 可見性測試
```

**結構決定**：延伸既有 `src/` 結構。僅有 `category-colors.ts` 和 `block-style-selector.ts` 為新建檔案，其餘皆為修改既有檔案。

## 關鍵技術決策

### 1. 降級 + Confidence 視覺（R1）

在 `block-renderer.ts` 的 `renderBlock()` 中，當節點為 `raw_code` 或 `unresolved` 時，將 `metadata.degradationCause`、`metadata.confidence`、`metadata.annotations` 寫入 BlockState.extraState。在 `blockly-panel.ts` 載入 workspace state 後，遍歷所有 block，讀取 extraState 並呼叫：
- `block.setColour()` — 依 degradationCause 設定背景色
- `block.setTooltip()` — 設定降級/confidence 提示
- `block.setCommentText()` — 設定 annotation 文字

### 2. 顏色集中管理（R3）

建立 `src/ui/theme/category-colors.ts`，定義 `CATEGORY_COLORS: Record<string, string>` 映射類別名稱到顏色值。BlockSpec JSON 中 `colour` 保留以維持可讀性，但動態積木的 `setColour()` 改為引用此表。toolbox category 標籤色也引用此表。

### 3. Toolbox 動態生成（R2）

現有 `BlockSpecRegistry` 已有 `listByCategory(category, level)` 方法。需要：
- 新增 `getCategories(): string[]` 方法列出所有類別
- 建立 `buildToolbox(registry, level, codeStyle)` 函式，取代硬編碼的 toolbox 定義
- I/O 類別依 codeStyle.ioPreference 排序（iostream：u_print 在前；cstdio：c_printf 在前）

### 4. Block Style Preset（R4）

在 `src/languages/style.ts` 新增 `BlockStylePreset` 介面和 3 個 preset。toolbar 新增 Block Style dropdown。切換 renderer 需重建 workspace。

### 5. Annotation 渲染（R6）

使用 Blockly 原生 `block.setCommentText(text)` 在積木上顯示 comment icon，點擊展開完整文字。獨立註解用現有 `c_comment_line` 積木。

## 複雜度追蹤

無違規需要說明。所有變更皆為既有架構的增量修改。
