# Implementation Plan: 補回無聲丟失的資料，並讓缺陷帳量對

**Branch**: `050-repay-top-blockers` | **Date**: 2026-08-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/050-repay-top-blockers/spec.md`

## Summary

四件事，全部建立在 Phase 0 的實證探測之上（**初稿的兩個前提被推翻，spec 已改寫**）：

1. **修一個無聲丟值的 bug**——`int a[3] = {1,2,3}` 的初始值在辨識時消失，而節點標著最高信心。這是本功能唯一的行為修改。
2. **釘住一個身分不保的現象**——輸出概念走一圈後變成另一個概念。**只記錄不修法**（修法會動到跨風格的已知坑）。
3. **修正缺陷帳的量測**——它把「被關掉的測試」（21）與「只有名字的測試」（64）當成同一種在數，導致優先序失真。
4. **改對阻斷者歸因**——先前依檔案開頭的宣稱歸因，而那個宣稱本身是錯的。

技術取徑：三處都用**既有機制**，不發明新東西——初始值走既有的具名子槽、可見降級走既有的信心等級與降級原因、缺陷帳擴充既有的量測結構。

## Technical Context

**Language/Version**: TypeScript 5.x（ESM，`strict`）

**Primary Dependencies**: 無新增。既有 Vitest、web-tree-sitter

**Storage**: `tests/baselines/defect-ledger.json`（擴充兩個欄位）

**Testing**: Vitest。新增一支 round-trip 身分測試（**刻意是紅的**）與一支陣列初始值測試

**Target Platform**: Node.js（測試）＋瀏覽器（實際行為）

**Project Type**: 單一專案

**Performance Goals**: 無新增負擔。缺陷帳的 `hasBody` 判定與既有掃描同一趟

**Constraints**: 除陣列初始值外**零行為改動**；既有測試全數維持通過；US2 明訂不得改動輸出構造的產生或辨識行為

**Scale/Scope**: 1 個辨識策略分支、2 支新測試、1 支既有護欄的擴充、85 筆標記的重新歸因

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 憲章原則 | 本功能如何遵守 | 判定 |
|---|---|---|
| **I. 簡約優先（YAGNI）** | 三處都用既有機制：具名子槽、既有的信心等級與降級原因、既有的量測結構。**唯一的新東西是一個標記字串** `[UNVERIFIED]`，而它取代的是「編一個阻斷者出來」 | ✅ |
| **II. 測試驅動開發（非妥協）** | US1 先寫失敗的 round-trip 測試再修；US2 **本身就是一支測試**；US3 先讓護欄斷言分類再實作分類 | ✅ |
| **III. Git 紀律** | 四個 Story 各自獨立 commit；基線調整獨立一次 commit | ✅ |
| **IV. 規格文件保護** | 不觸及既有規格；本功能的 spec 改寫是**依研究修正**，已在檔內留下修正紀錄與理由 | ✅ |
| **V. 繁體中文優先** | 全部文件繁中；程式碼識別符英文 | ✅ |

**無違規，無需 Complexity Tracking。**

> ⚠️ 憲章 II 有一處要在 tasks 階段講清楚：**US2 交付的是一支刻意失敗的測試**。TDD 的 Red 在此不是「等待被實作變綠」，而是「**把一個已知缺陷釘在測試套件裡，讓它每次都出聲**」。它與「留一個待辦就走」的差別是：待辦是沉默的，紅色測試不是。

## Project Structure

### Documentation (this feature)

```text
specs/050-repay-top-blockers/
├── spec.md               # 需求（已依研究改寫）
├── plan.md               # 本檔
├── research.md           # Phase 0：F1–F6 六個實測發現 + D1–D5 決策
├── data-model.md         # Phase 1：三處資料形
├── quickstart.md         # Phase 1：七個驗證情境
├── contracts/README.md   # Phase 1：三個契約
├── checklists/requirements.md
└── tasks.md              # Phase 2（/speckit-tasks 產出）
```

### Source Code (repository root)

```text
src/
└── languages/cpp/core/lifters/
    └── strategies.ts             # US1：陣列宣告加初始值分支——本功能唯一的行為改動

tests/
├── baselines/
│   └── defect-ledger.json        # US3：加 withBody / titleOnly
├── helpers/
│   └── disabled-scan.ts          # US3：判定 hasBody；US4：加 [UNVERIFIED]
├── integration/
│   ├── roundtrip-array-initializer.test.ts   # US1：新增
│   ├── roundtrip-concept-identity.test.ts    # US2：新增，刻意紅
│   ├── audit-defect-ledger.test.ts           # US3：分類斷言 + 報表
│   └── fuzz-*.test.ts                        # US4：重新歸因（只改標記）
```

**Structure Decision**：US1 的改動集中在一個既有的辨識策略檔；US2／US3 落在測試層；US4 只改測試檔的標題標記。**`src/` 只動一個檔。**

## Phase 0 摘要（詳見 research.md）

**六個實測發現**，其中兩個推翻了 spec 初稿：

| # | 發現 |
|---|---|
| **F1** | `cout << s.substr(0,3) << endl` **已經能辨識**——檔頭記載的阻斷條件已過期 ❌推翻初稿 |
| **F2** | 但輸出概念的 round-trip 確實壞——**預設風格產生的寫法辨識回來是另一個概念** |
| **F3** | 陣列初始值無聲丟失**確認**，且比初稿描述更糟——節點標著**最高信心** |
| **F4** | 85 筆停用項目**有 64 筆沒有測試本體** ❌推翻初稿 |
| **F5** | 阻斷者歸因不可靠——檔案開頭的宣稱與逐筆註解**互相矛盾** |
| **F6** | 缺陷帳護欄**量錯了**——把兩種需要完全不同工作量的東西當同一種數 |

**五個決策**：D1 初始值用具名子槽（三態靠欄位存在與否表達）／D2 可見降級用既有信心機制／D3 輸出身分**只釘住不修法**／D4 停用項目分兩類計數／D5 歸因只更正註解已寫明的。

## Phase 1 摘要

- **三處資料形**：`array_declare` 的 `values` 子槽（可選，三態）、缺陷帳的 `withBody`／`titleOnly`、新標記 `[UNVERIFIED]`
- **三個契約**：陣列語義形狀（向下相容）、缺陷帳基線（`byBlocker` 語義收窄）、標記語法（加一種）
- **七個驗證情境**，其中情境 2「做不到的時候會出聲」標為**本功能的核心**

## Constitution Re-check（Phase 1 設計後）

| 原則 | 設計後複查 | 判定 |
|---|---|---|
| I. 簡約優先 | Phase 1 沒有引入任何新型別、新相依、新抽象層。`[UNVERIFIED]` 是一個字串常數 | ✅ |
| II. TDD | 兩支新測試皆具體可執行；US2 的紅色是設計意圖並已在 plan 與 quickstart 明載 | ✅ |
| III. Git 紀律 | tasks 階段以 Story 切分 | ✅ |
| IV. 規格保護 | 未觸及既有規格 | ✅ |
| V. 繁中優先 | 六份文件全繁中 | ✅ |

**設計後仍無違規。**

## 已知風險（承接 spec，plan 階段補上緩解手段）

| 風險 | plan 階段的緩解 |
|---|---|
| **修陣列時退回「填個空值就算了」** | **先寫「做不到要出聲」那支測試**（quickstart 情境 2），再寫保留邏輯——讓紅色出現在正確的地方 |
| **US2 的「只記錄不修法」被擴大** | tasks 明訂：該 Story 不得改動 `src/`。實作時想順手修，那是另一個功能 |
| **`[UNVERIFIED]` 變成新垃圾桶** | 契約規定它的**數量本身是棘輪**，只准下降 |
| **改缺陷帳分類讓舊基線失效** | `total` 保留可比較；新欄位各自建立基線 |
| **本功能的量測也可能量錯** | US1 的驗證**用真實程式碼走一圈，不靠合成節點**——完備性護欄漏掉這個 bug 的原因正是它只跑合成的最小樣本 |

## 一個要傳給實作階段的判斷

本功能的四個 Story 裡，**只有 US1 改變系統行為**。其餘三個改的是「我們對系統的認識」——釘住一個現象、修正一個量測、改對一批標籤。

這個比例本身值得注意：**照著量測行動的第一步，有四分之三的工作是修正量測自己。**

這不是浪費，是那條紀律的代價——不付這個代價，後面每一步都會照著錯的優先序走。而付了之後，缺陷帳才第一次真的能回答它被建出來要回答的那個問題。
