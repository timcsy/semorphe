# Implementation Plan: 四條護欄——碎裂、殼與缺陷帳的基線與棘輪

**Branch**: `049-audit-guardrails` | **Date**: 2026-08-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/049-audit-guardrails/spec.md`

## Summary

新增四條審計測試，量出三個病的基線並用棘輪擋住惡化：**中立性**（核心層硬編語言專屬元件身分）、**完備性**（元件五路是實作／殼／缺）、**缺陷帳**（停用測試的分類與阻斷者）、**就近性**（元件實作的擴散度）。

技術取徑：四條護欄沿用專案既有的 `tests/integration/audit-*.test.ts` 慣例，各自是一支獨立測試；基線存成 `tests/baselines/*.json`（**不用 vitest snapshot——`-u` 會靜默更新，正好摧毀棘輪**）；完備性護欄**不手寫樣本**，從 `ConceptDefJSON` 合成最小語義節點跑一圈五路，確保 100% 覆蓋。

唯一動到 `src/` 的是一個**可選欄位** `ConceptDefJSON.skipPaths`，讓「刻意不提供某條路徑」能被宣告——正確的空與缺失的空長得一樣，所以要求正確的那個說話。

## Technical Context

**Language/Version**: TypeScript 5.x（ESM，`strict`）

**Primary Dependencies**: Vitest（測試框架）、web-tree-sitter（完備性護欄的 lift 段需要 parser）。**不新增任何相依**

**Storage**: `tests/baselines/*.json`（四個基線檔，納入版控）、`tests/reports/completeness-map.md`（產出的補完地圖）

**Testing**: Vitest。四條護欄本身即測試，位於 `tests/integration/`

**Target Platform**: Node.js（測試環境）；不涉及瀏覽器

**Project Type**: 單一專案（library + 瀏覽器 app），本功能只加測試層

**Performance Goals**: 四條護欄合計新增 **≤ 10 秒**（現況 158 檔 / 3006 測 / 約 20 秒）

**Constraints**: **零行為改動** —— 除新增護欄與一個可選 JSON 欄位外，不得改變任何既有輸出；既有 3006 測全程綠

**Scale/Scope**: 149 個 C++ 元件 × 5 條路徑 = 745 個分類格；4 個掃描目錄（`src/core`、`src/ui`、`src/interpreter`、`src/views`）；約 76 個停用測試項目

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 憲章原則 | 本功能如何遵守 | 判定 |
|---|---|---|
| **I. 簡約優先（YAGNI）** | D1 否決 AST 解析改用字邊界比對；D5 否決預先分離執行；D3 只做兩種組態不做三種。**每一項否決都記在 `research.md`** | ✅ |
| **II. 測試驅動開發（非妥協）** | 本功能的產出**本身就是測試**。TDD 形式：先寫護欄斷言（紅：無基線檔）→ 產生基線 → 綠。每個 User Story 獨立可測（見 quickstart 情境 1–8） | ✅ |
| **III. Git 紀律** | 每條護欄一個 commit；基線檔的產生與後續每次調整各自 commit（FR-004 要求可在版本歷史中看見） | ✅ |
| **IV. 規格文件保護** | 本功能不觸及 `specs/`、`.specify/` 既有內容 | ✅ |
| **V. 繁體中文優先** | spec／plan／research／data-model／contracts／quickstart／tasks 全繁中；程式碼識別符維持英文 | ✅ |

**無違規，無需 Complexity Tracking。**

> ⚠️ 憲章 II 有一處需要在 tasks 階段明確處理：本功能的護欄**第一天預期是「紅」的**（存量大）。TDD 的 Red→Green 在此的意思是「**斷言邏輯先紅（基線缺失）→ 建立基線後綠**」，不是「違規數歸零才綠」。這點已寫入 spec 的 Assumptions 與 quickstart「常見誤判」。

## Project Structure

### Documentation (this feature)

```text
specs/049-audit-guardrails/
├── spec.md               # 需求（已完成）
├── plan.md               # 本檔
├── research.md           # Phase 0：D1–D6 決策 + F1–F3 既有事實
├── data-model.md         # Phase 1：四種結果的資料形 + skipPaths
├── quickstart.md         # Phase 1：8 個驗證情境
├── contracts/
│   └── README.md         # Phase 1：基線檔格式 + 標記語法 + skipPaths 契約
├── checklists/
│   └── requirements.md   # spec 品質檢核（16/16 通過）
└── tasks.md              # Phase 2（/speckit-tasks 產出，本指令不建立）
```

### Source Code (repository root)

```text
src/
└── core/
    └── types.ts                       # 唯一改動：ConceptDefJSON 加可選欄位 skipPaths

tests/
├── baselines/                         # 新增目錄
│   ├── neutrality.json
│   ├── completeness.json
│   ├── defect-ledger.json
│   └── locality.json
├── helpers/
│   ├── setup-lifter.ts                # 既有，重用
│   ├── setup-renderer.ts              # 既有，重用
│   ├── guardrail.ts                   # 新增：量測→報表→棘輪的共用形狀
│   ├── component-scan.ts              # 新增：D1 的字邊界掃描（中立性與就近性共用）
│   └── synth-node.ts                  # 新增：D6 的最小節點合成
├── integration/
│   ├── audit-neutrality.test.ts       # 新增（US1, P1）
│   ├── audit-completeness.test.ts     # 新增（US2, P1）
│   ├── audit-defect-ledger.test.ts    # 新增（US3, P2）
│   └── audit-locality.test.ts         # 新增（US4, P3）
└── reports/
    └── completeness-map.md            # 產出物（補完地圖）
```

**Structure Decision**：沿用專案既有的 `tests/integration/audit-*.test.ts` 慣例（已有 `audit-concept-identity.test.ts`、`audit-ptr-concepts.test.ts` 兩支先例），一條護欄一支測試，共用邏輯抽到 `tests/helpers/`。基線與報表分別放 `tests/baselines/`、`tests/reports/`（後者已存在）。

`src/` 只動 `core/types.ts` 的一個可選欄位——這是 FR-022 的最小落地，既有 149 個元件零改動。

## Phase 0 摘要（詳見 research.md）

| # | 決策 | 結論 |
|---|---|---|
| D1 | 「提及元件身分」判定 | 字邊界比對，先剝註解；**註解引用另計、不入基線** |
| D2 | 基線儲存 | `tests/baselines/*.json`；**明確否決 vitest snapshot**（`-u` 靜默更新 = 棘輪失效） |
| D3 | 兩種載入組態 | **現行組態 vs 宣告組態**（非原設想的 app vs 測試——那兩者現況相同，護欄會恆綠 = 殼） |
| D4 | 停用測試標記 | 標題前綴 `[BLOCKED:id]` / `[TOMBSTONE:ref]` / `[DEADSKIP]`；**與測試同住，不建登錄檔**（避免雙重真相） |
| D5 | 執行頻率 | 四條全進 `npm test`，不預先分離 |
| D6 | 完備性的最小樣本 | **不手寫，從 ConceptDef 合成**最小節點跑一圈；lift 的輸入來自 generate 的輸出 |

**研究中查到的三個既有事實**（改變了 D3 的設計）：

- **F1** `src/languages/cpp/module.ts` 的 `initCppModule()` 全專案零呼叫 —— 死碼
- **F2** `setTemplateGenerator()` 在 `src/` 零呼叫 —— **app 從未接上 TemplateGenerator，JSON 的 `codeTemplate` 一行都沒被用到**
- **F3** **93 個概念宣告了 `codeTemplate`**，全部處於「宣告了、沒被用」的狀態

F2／F3 把 FR-023 從保險升級成本功能最有價值的產出之一。三者皆屬 spec 的 Out of Scope（只量不修），但會出現在完備性報表中。

## Phase 1 摘要（詳見 data-model.md / contracts/ / quickstart.md）

- **四種結果資料形**：`NeutralityResult` / `CompletenessResult` / `DefectLedgerResult` / `LocalityResult`
- **共用護欄形狀**：`measure() → report() → compare(result, baseline)`；`compare` 回傳**新增項清單**而非布林——FR-005 要求失敗時指名是哪一項，比對粒度必須是項目
- **兩個對外契約**：基線檔 JSON 格式、停用測試標記語法
- **一個 `src/` 改動**：`ConceptDefJSON.skipPaths?: PathName[]`
- **八個驗證情境**：涵蓋量得出、擋得住、反映得出改善、分得出刻意的空、組態差異非空、地圖可讀、優先序可見、零行為改動

## Constitution Re-check（Phase 1 設計後）

| 原則 | 設計後複查 | 判定 |
|---|---|---|
| I. 簡約優先 | Phase 1 新增 3 個 helper、4 個測試、4 個基線檔、1 個可選欄位。**沒有新抽象層、沒有新相依、沒有為未來預留的擴充點** | ✅ |
| II. TDD | 八個驗證情境全部可執行、非佔位；每個 User Story 對應一支獨立可跑的測試 | ✅ |
| III. Git 紀律 | tasks 階段將以「一條護欄一組 commit」切分 | ✅ |
| IV. 規格保護 | 未觸及既有規格文件 | ✅ |
| V. 繁中優先 | 六份文件全繁中 | ✅ |

**設計後仍無違規。**

## 已知風險（承接 spec，plan 階段補上緩解手段）

| 風險 | plan 階段的緩解 |
|---|---|
| 完備性的綠燈製造安全感 | 報表固定印出一行聲明「本護欄不檢測條件性正確」（FR-025）；quickstart「常見誤判」也重述 |
| 護欄自己變成殼 | 棘輪寫成 `expect(newItems).toEqual([])`，跑在 `npm test` 內（D5）；基線放寬必須改 JSON 並 commit |
| 誤報侵蝕可信度 | D1 字邊界 + 註解分離；判定規則寫進基線檔的 `_meta.rule` |
| 合成節點跑不起來 | 合成失敗**本身就是一種判定結果**（該路徑判為殼並記 reason），不是護欄的錯誤 |
| 補標記的工作量 | 約 76 個停用項目需人工分類，已在 spec Assumptions 載明是本功能的一部分 |
