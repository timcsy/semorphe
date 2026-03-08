# 任務清單：前端 UI/UX 第一性原理合規

**輸入文件**：`/specs/013-ux-first-principles/` 目錄下的設計文件
**前置需求**：plan.md、spec.md、research.md、data-model.md、quickstart.md

**組織方式**：任務按使用者故事分組，各故事可獨立實作與測試。

## 格式：`[ID] [P?] [Story] 描述`

- **[P]**：可並行執行（不同檔案、無相依性）
- **[Story]**：所屬使用者故事（如 US1、US2、US3）
- 描述中包含精確檔案路徑

---

## 階段 1：基礎建設

**目的**：所有使用者故事共用的基礎模組

- [X] T001 建立集中的類別顏色模組 src/ui/theme/category-colors.ts — 定義 CATEGORY_COLORS 映射表（data、operators、control、io、functions、arrays、preprocessor、special、comment），hex 值對應目前 Scratch 配色
- [X] T002 在 src/ui/theme/category-colors.ts 新增 DegradationVisual 和 ConfidenceVisual 預設映射 — 定義 DEGRADATION_VISUALS（syntax_error: #FF6B6B、unsupported: #9E9E9E、nonstandard_but_valid: 綠色邊框 #4CAF50）和 CONFIDENCE_VISUALS（high: 正常、warning: 黃色 #FFC107、inferred: 虛線/0.85 透明度）

---

## 階段 2：核心前置（阻擋性前置條件）

**目的**：所有使用者故事都必須等此階段完成才能開始

- [X] T003 擴充 src/core/projection/block-renderer.ts 的 BlockState.extraState 傳遞 — 渲染 raw_code/unresolved 節點時，將 metadata.degradationCause、metadata.confidence 和 node.annotations 複製到 extraState
- [X] T004 在 src/ui/panels/blockly-panel.ts 新增載入後視覺樣式處理 — workspace 載入 state 後，遍歷所有積木，讀取 extraState，根據降級/confidence/annotation 資料呼叫 setColour()/setTooltip()/setCommentText()
- [X] T005 在 src/core/block-spec-registry.ts 的 BlockSpecRegistry 新增 getCategories() 方法 — 回傳所有已載入 spec 的不重複類別字串清單

**檢查點**：基礎就緒，使用者故事實作可以開始

---

## 階段 3：使用者故事 1 — 降級視覺區分（優先級：P1）MVP

**目標**：降級積木（raw_code）依 degradationCause 顯示不同顏色和 tooltip

**獨立測試**：將含語法錯誤、未支援、進階寫法的程式碼轉為積木，驗證三種降級積木各自顯示正確顏色和 tooltip

### 使用者故事 1 實作

- [X] T006 [US1] 在 src/core/projection/block-renderer.ts 的 renderBlock() 中，對 raw_code 節點：將 node.metadata.degradationCause 寫入 extraState.degradationCause（預設為 'unsupported'）
- [X] T007 [US1] 在 src/ui/panels/blockly-panel.ts 的載入後處理中：讀取 block.extraState.degradationCause，查詢 DEGRADATION_VISUALS，呼叫 block.setColour(colour) 和 block.setTooltip(tooltipText) — 使用 i18n key DEGRADATION_SYNTAX_ERROR、DEGRADATION_UNSUPPORTED、DEGRADATION_ADVANCED
- [X] T008 [P] [US1] 在 src/i18n/en/blocks.json 和 src/i18n/zh-TW/blocks.json 新增降級 tooltip 的 i18n 字串 — key：DEGRADATION_SYNTAX_ERROR（"Code contains syntax error" / "程式碼含語法錯誤"）、DEGRADATION_UNSUPPORTED（"Unsupported syntax" / "系統尚未支援此寫法"）、DEGRADATION_ADVANCED（"Advanced syntax" / "進階寫法"）
- [X] T009 [US1] 撰寫整合測試 tests/integration/degradation-visual.test.ts — 驗證 renderToBlocklyState 對不同 metadata.degradationCause 值的節點產生正確的 extraState.degradationCause

**檢查點**：降級原因視覺區分功能完成且可測試

---

## 階段 4：使用者故事 2 — Confidence 視覺回饋（優先級：P1）

**目標**：積木依 confidence 等級顯示不同邊框樣式（high/warning/inferred）

**獨立測試**：將含不同 confidence 等級的程式碼轉為積木，驗證視覺樣式差異

### 使用者故事 2 實作

- [X] T010 [US2] 在 src/core/projection/block-renderer.ts 的 renderBlock() 中，將 metadata.confidence 傳遞到所有已渲染積木的 extraState.confidence（不只 raw_code）
- [X] T011 [US2] 在 src/ui/panels/blockly-panel.ts 的載入後處理中：讀取 block.extraState.confidence，查詢 CONFIDENCE_VISUALS，為 warning/inferred 等級套用 tooltip — 使用 i18n key CONFIDENCE_WARNING、CONFIDENCE_INFERRED
- [X] T012 [P] [US2] 在 src/i18n/en/blocks.json 和 src/i18n/zh-TW/blocks.json 新增 confidence tooltip 的 i18n 字串 — key：CONFIDENCE_WARNING（"Structure matched but semantics uncertain" / "結構匹配但語義可疑"）、CONFIDENCE_INFERRED（"System inference" / "系統推測"）
- [X] T013 [US2] 撰寫整合測試 tests/integration/confidence-visual.test.ts — 驗證不同 metadata.confidence 值的節點正確傳遞 extraState.confidence

**檢查點**：Confidence 視覺回饋功能完成

---

## 階段 5：使用者故事 3 — 顏色集中管理與 Toolbox 動態生成（優先級：P2）

**目標**：所有積木顏色來自集中的 CATEGORY_COLORS；toolbox 100% 由 registry 動態生成並依認知層級過濾

**獨立測試**：修改 category-colors.ts 中某類別顏色，驗證該類別所有積木使用新顏色；切換認知層級，驗證 toolbox 正確過濾

### 使用者故事 3 實作

- [X] T014 [US3] 替換 src/ui/app.new.ts 中動態積木註冊的硬編碼 setColour() 呼叫 — import CATEGORY_COLORS，改用類別查表取代 hex 字面值
- [X] T015 [US3] 在 src/ui/app.new.ts 建立 buildToolbox() 函式 — 從 BlockSpecRegistry.getCategories() + listByCategory(cat, level) 動態生成 toolbox 定義，使用 CATEGORY_COLORS 設定類別標籤色
- [X] T016 [US3] 移除硬編碼的 BEGINNER_BLOCKS 陣列 — 改用 registry.listByCategory() 透過 BlockSpec.level 欄位進行過濾
- [X] T017 [US3] 將 buildToolbox() 整合到 src/ui/app.new.ts 的初始化流程 — 在初始化和認知層級變更時呼叫 buildToolbox(registry, level, codeStyle)
- [X] T018 [US3] 撰寫整合測試 tests/integration/toolbox-dynamic.test.ts — 驗證不同認知層級（L0 約 18 個積木、L2 全部積木）的 toolbox 生成結果正確

**檢查點**：顏色集中管理完成，toolbox 完全動態生成且支援層級過濾

---

## 階段 6：使用者故事 4 — Code Style 影響工具箱（優先級：P2）

**目標**：切換 Code Style preset 時重新排序 toolbox 的 I/O 積木（APCS：cout 在前、competitive：printf 在前）

**獨立測試**：切換 Code Style，驗證 I/O 工具箱類別重新排序

### 使用者故事 4 實作

- [X] T019 [US4] 在 buildToolbox() 中新增 style-aware 排序邏輯 — 對 'io' 類別，當 ioPreference='iostream' 時 u_print/u_input 排前面，'cstdio' 時 c_printf/c_scanf 排前面
- [X] T020 [US4] 在 src/ui/app.new.ts 將 Code Style 變更連結到 toolbox 重建 — 在 StyleSelector 變更事件中，用更新的 codeStyle 呼叫 buildToolbox() 並更新 workspace 的 toolbox
- [X] T021 [US4] 撰寫整合測試 tests/integration/style-toolbox.test.ts — 驗證 buildToolbox() 的輸出順序依 ioPreference 正確變化

**檢查點**：Code Style 切換正確更新 toolbox I/O 排序

---

## 階段 7：使用者故事 5 — Annotations 積木可見（優先級：P2）

**目標**：行內 annotations 在積木上顯示為 comment icon；獨立註解渲染為 c_comment_line 積木

**獨立測試**：將含行內和獨立註解的程式碼轉為積木，驗證 annotations 可見

### 使用者故事 5 實作

- [X] T022 [US5] 在 src/core/projection/block-renderer.ts 的 renderBlock() 中，將 node.annotations 傳遞到所有已渲染積木的 extraState.annotations
- [X] T023 [US5] 在 src/ui/panels/blockly-panel.ts 的載入後處理中：讀取 block.extraState.annotations，對行內 annotations 呼叫 block.setCommentText(text) 顯示 Blockly 原生 comment icon
- [X] T024 [US5] 驗證獨立註解的 c_comment_line 積木渲染 — 確認 block-renderer.ts 正確處理 concept='comment_line' 節點並渲染為含正確文字的 c_comment_line 積木
- [X] T025 [US5] 撰寫整合測試 tests/integration/annotation-visual.test.ts — 驗證 annotations 在 extraState 中的傳遞及 comment_line 積木的渲染

**檢查點**：Annotations 透過 comment icon 和獨立註解積木在積木上可見

---

## 階段 8：使用者故事 6 — Block Style Preset 與 Style 切換 UI（優先級：P3）

**目標**：使用者可透過 toolbar 下拉選單切換 Block Style preset（scratch/classic/teaching）和 Code Style，切換後 workspace 立即更新

**獨立測試**：切換 Block Style，驗證渲染器變更；切換 Code Style，驗證程式碼重新生成

### 使用者故事 6 實作

- [X] T026 [US6] 在 src/languages/style.ts 定義 BlockStylePreset 介面和 BLOCK_STYLE_PRESETS 常數 — 3 個 preset：scratch（zelos+compact+scratch+true）、classic（geras+normal+classic+false）、teaching（zelos+spacious+high_contrast+true）
- [X] T027 [P] [US6] 建立 BlockStyleSelector 元件 src/ui/toolbar/block-style-selector.ts — Block Style preset 選擇的下拉選單，參考現有 StyleSelector 的模式
- [X] T028 [US6] 在 src/ui/app.new.ts 將 BlockStyleSelector 接入 toolbar — 變更時若 renderer 不同則重建 workspace；若僅 theme/density 不同則動態更新
- [X] T029 [US6] 更新 src/ui/panels/blockly-panel.ts 的 BlocklyPanel.init() 接受 BlockStylePreset 參數 — 使用 preset.renderer，套用 density/theme 設定
- [X] T030 [US6] 在 src/i18n/en/blocks.json 和 src/i18n/zh-TW/blocks.json 新增 Block Style 的 i18n 字串 — preset 名稱："Scratch Style"/"Scratch 風格"、"Classic Style"/"經典風格"、"Teaching Style"/"教學風格"

**檢查點**：Block Style 和 Code Style 切換 UI 功能完成

---

## 階段 9：收尾與跨領域整合

**目的**：最終整合驗證與清理

- [X] T031 執行所有既有測試 `npx vitest run` — 確保 100% 通過
- [X] T032 手動執行 quickstart.md 的 7 個測試場景 — 驗證全部通過
- [X] T033 驗證 roundtrip：積木→程式碼→積木保留 annotations 和降級 metadata

---

## 相依性與執行順序

### 階段相依性

- **基礎建設（階段 1）**：無相依性，可立即開始
- **核心前置（階段 2）**：依賴階段 1 完成，阻擋所有使用者故事
- **US1 + US2（階段 3-4）**：依賴階段 2，可彼此並行
- **US3（階段 5）**：依賴階段 1（category-colors.ts）
- **US4（階段 6）**：依賴 US3（buildToolbox 函式）
- **US5（階段 7）**：依賴階段 2（extraState 傳遞）
- **US6（階段 8）**：依賴 US3（集中顏色）+ US4（toolbox 重建）
- **收尾（階段 9）**：依賴所有使用者故事完成

### 使用者故事相依性

- **US1（P1）**：階段 2 之後，不依賴其他故事
- **US2（P1）**：階段 2 之後，不依賴其他故事
- **US3（P2）**：階段 1 之後，不依賴其他故事
- **US4（P2）**：US3 之後（需要 buildToolbox）
- **US5（P2）**：階段 2 之後，不依賴其他故事
- **US6（P3）**：US3 + US4 之後

### 並行機會

- T006 和 T008 可並行（不同檔案）
- T010 和 T012 可並行（不同檔案）
- US1、US2 和 US5 在階段 2 完成後可全部並行
- T027 可與 T026 並行（不同檔案）

---

## 實作策略

### MVP 優先（US1 + US2）

1. 完成階段 1：基礎建設（category-colors.ts）
2. 完成階段 2：核心前置（extraState 傳遞 + 載入後處理）
3. 完成階段 3：US1 — 降級視覺區分
4. 完成階段 4：US2 — Confidence 視覺回饋
5. **停下並驗證**：獨立測試降級 + confidence 視覺效果

### 增量交付

1. 基礎建設 + 核心前置 → 基礎就緒
2. US1 + US2 → 降級 + Confidence 視覺（MVP）
3. US3 → 顏色集中管理 + toolbox 動態化
4. US4 → Code Style 影響 toolbox
5. US5 → Annotations 可見
6. US6 → Block Style 切換 UI
7. 收尾 → 完整驗證

---

## 備註

- [P] 標記表示可並行（不同檔案、無相依性）
- [Story] 標記對應到特定使用者故事
- 每個使用者故事在檢查點均可獨立測試
- 每個階段完成後提交 commit
- 使用的 Blockly API：setColour()、setTooltip()、setCommentText()、setWarningText()
- 切換 renderer（zelos↔geras）需重建 workspace；切換 theme 可動態更新
