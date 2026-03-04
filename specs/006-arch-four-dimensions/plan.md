# Implementation Plan: 架構重構 — 四維分離與語義模型

**Branch**: `006-arch-four-dimensions` | **Date**: 2026-03-04 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/006-arch-four-dimensions/spec.md`

## Summary

將現有 code-blockly 系統從耦合式架構重構為四維正交架構（Concept × Language × Style × Locale）。核心改動：(1) 積木文字抽離到 i18n 翻譯檔，(2) 型別系統由語言模組注入，(3) 編碼風格參數化程式碼生成器，(4) 建立獨立的 SemanticNode 語義模型作為唯一真實來源。基於 docs/first-principles.md 的六個基本原則（P1-P6）。

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Blockly 12.4.1, web-tree-sitter 0.26.6, CodeMirror 6.0.2, Vite
**Storage**: localStorage（瀏覽器）
**Testing**: Vitest
**Target Platform**: 瀏覽器（Web）
**Project Type**: Web application（教育用視覺化程式設計環境）
**Performance Goals**: 風格切換 < 1 秒、round-trip 轉換即時
**Constraints**: 不需要向後相容舊版 workspace
**Scale/Scope**: 67+ 積木定義、5 個 User Stories、完整 C++ 支援 + Python stub 驗證

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 狀態 | 說明 |
|------|------|------|
| I. 簡約優先 | ⚠ 需要注意 | 四維架構是大範圍重構，但每一維都有明確的當前需求（i18n 已在做、多語言是路線圖、style 是教學需求）。語義模型是最大風險——需要確保不過度設計。YAGNI 判定：SemanticNode 完整實作是用戶明確要求，非假設性需求。 |
| II. 測試驅動開發 | ✅ PASS | 每個 User Story 可獨立測試，測試先於實作 |
| III. Git 紀律 | ✅ PASS | 每個 phase/task 完成後 commit |
| IV. 規格文件保護 | ✅ PASS | 不修改 specs/、.specify/ 目錄 |
| V. 繁體中文優先 | ✅ PASS | 規格/計畫/任務文件用繁體中文，程式碼用英文 |

**Gate 結果**: PASS（簡約優先需持續監控，但無 blocking violation）

## Project Structure

### Documentation (this feature)

```text
specs/006-arch-four-dimensions/
├── spec.md
├── plan.md              # This file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── semantic-model.ts
│   ├── language-module.ts
│   ├── coding-style.ts
│   └── locale.ts
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── types.ts                    # 核心型別定義（重構）
│   ├── semantic-model.ts           # 【新增】SemanticNode 樹 + SemanticModel
│   ├── concept-registry.ts         # 【新增】概念註冊表（universal + language-specific）
│   ├── block-registry.ts           # 積木註冊（重構：移除硬編碼文字）
│   ├── code-to-blocks.ts           # Code→Blocks（重構：經由語義模型）
│   ├── converter.ts                # 語言模組註冊器（重構）
│   └── diagnostics.ts              # 診斷工具
├── i18n/                           # 【新增】國際化
│   ├── loader.ts                   # Locale 載入器，注入 Blockly.Msg
│   ├── zh-TW/
│   │   ├── blocks.json             # 所有積木的 message/tooltip
│   │   └── types.json              # 型別 label（TYPE_INT: "int（整數）"）
│   └── en/
│       ├── blocks.json             # English fallback
│       └── types.json
├── blocks/
│   └── universal.json              # 重構：message/tooltip 改為 %{BKY_XXX} key
├── languages/
│   ├── types.ts                    # 【新增】LanguageModule 介面 + 型別定義
│   ├── style.ts                    # 【新增】CodingStyle 介面 + presets
│   └── cpp/
│       ├── module.ts               # C++ 語言模組（重構：實作新 LanguageModule 介面）
│       ├── types.ts                # 【新增】C++ 型別清單（{value, labelKey}）
│       ├── adapter.ts              # C++ adapter（重構：支援 style 參數）
│       ├── generator.ts            # C++ 生成器（重構：接受 CodingStyle 參數）
│       ├── parser.ts               # C++ 解析器（重構：增加 detectStyle）
│       ├── style-presets.ts        # 【新增】APCS / 競賽 / Google Style presets
│       └── blocks/
│           ├── basic.json          # 重構：message/tooltip 改為 key
│           ├── advanced.json       # 同上
│           └── special.json        # 同上
├── ui/
│   ├── App.ts                      # 重構：注入 locale/language/style
│   ├── blockly-editor.ts           # 重構：動態積木文字改為 i18n key
│   ├── code-editor.ts              # 不變
│   ├── sync-controller.ts          # 重構：經由語義模型同步
│   └── storage.ts                  # 重構：儲存語義模型
└── main.ts                         # 進入點

tests/
├── unit/
│   ├── semantic-model.test.ts      # 【新增】
│   ├── concept-registry.test.ts    # 【新增】
│   ├── i18n-loader.test.ts         # 【新增】
│   ├── coding-style.test.ts        # 【新增】
│   ├── block-registry.test.ts      # 更新
│   └── ...
├── integration/
│   ├── locale-integration.test.ts  # 【新增】
│   ├── language-module.test.ts     # 【新增】
│   ├── style-switching.test.ts     # 【新增】
│   ├── round-trip.test.ts          # 【新增】
│   ├── python-stub.test.ts         # 【新增】
│   └── ...
└── fixtures/
    └── ...
```

**Structure Decision**: 沿用現有的 `src/` 單專案結構，新增 `src/i18n/` 和 `src/core/semantic-model.ts`。語言模組維持在 `src/languages/` 下。

## Implementation Strategy

### 依賴順序

```
US4 (SemanticModel) ← 基礎，所有其他 US 依賴
  ↓
US1 (Locale) + US2 (LanguageModule) ← 可並行
  ↓
US3 (Style) ← 依賴 US2 的 LanguageModule 介面
  ↓
US5 (Python Stub) ← 依賴 US1+US2+US4
```

注意：spec 中 US4 標為 P2，但從實作角度它是所有改動的基礎。建議實作順序：**US4 → US1 → US2 → US3 → US5**。

### 風險評估

| 風險 | 影響 | 緩解策略 |
|------|------|---------|
| SemanticModel 設計不正確導致 round-trip 失敗 | 高 | 先定義 interface + 寫 round-trip 測試，再實作 |
| Blockly `%{BKY_XXX}` 語法不支援動態積木 | 中 | 動態積木改為在 init 時從 Blockly.Msg 讀取文字 |
| CodingStyle 影響範圍過大（I/O 切換） | 中 | u_print/u_input 統一為 universal，generator 根據 style 分支 |
| 現有 260+ 測試大量失敗 | 中 | 每個 phase 完成後立即跑測試，逐步修復 |

## Complexity Tracking

| 項目 | 為什麼需要 | 為什麼不能更簡單 |
|------|-----------|----------------|
| SemanticNode 完整實作（非 adapter） | 用戶明確要求 B 選項 | Adapter 只是延後複雜度，不消除 |
| 四維分離（非兩維） | Style 和 Language 是正交的，合併會造成 N×M 組合爆炸 | 三維（無 Style）可以但用戶明確需要 coding style 切換 |

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design completion.*

| 原則 | 狀態 | 說明 |
|------|------|------|
| I. 簡約優先 | ✅ PASS | 設計階段確認：(1) SemanticNode 是純資料結構，無過度抽象；(2) contracts/ 介面保持最小化；(3) 每個新增檔案都有明確用途。Complexity Tracking 中所有項目有明確的用戶需求支撐。 |
| II. 測試驅動開發 | ✅ PASS | quickstart.md 定義了 6 個驗證場景。每個 US 有獨立測試標準。contracts/ 提供了可測試的介面定義。 |
| III. Git 紀律 | ✅ PASS | 實作順序 US4→US1→US2→US3→US5 每個階段完成後 commit。 |
| IV. 規格文件保護 | ✅ PASS | 所有設計產出放在 specs/006-arch-four-dimensions/，不修改既有 specs/。 |
| V. 繁體中文優先 | ✅ PASS | 所有設計文件用繁體中文。contracts/ 用 TypeScript（程式碼），註解用英文。 |

**Post-Design Gate 結果**: ✅ ALL PASS

## Generated Artifacts

| 產出物 | 路徑 | 說明 |
|--------|------|------|
| research.md | specs/006-arch-four-dimensions/research.md | 8 個技術決策（R1-R8） |
| data-model.md | specs/006-arch-four-dimensions/data-model.md | 7 個實體定義 + 資料流 |
| semantic-model.ts | specs/006-arch-four-dimensions/contracts/semantic-model.ts | SemanticNode、SemanticModel 介面 |
| language-module.ts | specs/006-arch-four-dimensions/contracts/language-module.ts | LanguageModule、TypeEntry、Generator、Parser 介面 |
| coding-style.ts | specs/006-arch-four-dimensions/contracts/coding-style.ts | CodingStyle、StyleManager 介面 |
| locale.ts | specs/006-arch-four-dimensions/contracts/locale.ts | LocaleBundle、LocaleLoader 介面 |
| quickstart.md | specs/006-arch-four-dimensions/quickstart.md | 6 個驗證場景 |
