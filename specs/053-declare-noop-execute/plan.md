# Implementation Plan: 讓「刻意不執行」說得出話

**Branch**: `053-declare-noop-execute` | **Date**: 2026-08-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/053-declare-noop-execute/spec.md`

## Summary

核心直譯器有一份寫死的 34 個「無執行行為」概念清單。上一輪為這件事建好的宣告欄位（`skipPaths`）**一個概念都沒用過**。

Phase 0 追出三件改變設計的事：

1. **那份清單不只是文件——它在覆蓋能用的執行器。** 四個轉型概念（`static_cast` 等）有實作，被清單無聲關掉。`static_cast<int>(3.9)` **輸出 0**。
2. **「空得有理」有兩種不同的理由**（本身沒有語義 vs 語義由父概念負責），混為一談會誤導。
3. **把分類自動化的第一版，答案是反的。** 靜態掃描把壞掉的判成好的、好的判成壞的；抓到它的是先做的實測與它矛盾。

因此路線是：**先全部跑一遍實測 → 再分類 → 只有配得上的才拿到宣告 → 清單消失**。

## Technical Context

**Language/Version**: TypeScript 5.9

**Primary Dependencies**: 無新增

**Storage**: N/A（概念註冊表在記憶體）

**Testing**: Vitest

**Target Platform**: 瀏覽器

**Project Type**: 單一前端專案

**Constraints**:

- **已宣告概念的執行行為零改動**——它們現在就是 noop，之後也是 noop，只是來源不同
- **四個轉型概念是唯一的行為改變，方向是變好**
- 中立性與完備性 MUST 下降；其餘四項量測 MUST NOT 上升

**Scale/Scope**: 34 個概念（3 個是死條目）；核心層兩份清單；改動集中在 `src/interpreter/interpreter.ts`、`src/core/types.ts`、各 `concepts.json`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 條 | 評估 |
|---|---|
| **I. 簡約優先** | ✅ 不新增欄位型別（`skipPaths`／`annotations` 皆既有），不新增相依。`skipReasons` 是新欄位但**它擋的是本功能最大的風險**——沒有理由的宣告就是把缺陷洗成設計。**刻意限制成兩個值且不得增加**：第三個值就是在替「還沒做」找體面的名字 |
| **II. TDD 非妥協** | ✅ 情境 0（34 個全部實測）是第一個任務。**分類在測完之前不得寫下** |
| **III. Git 紀律** | ✅ 每個 Story 一組 commit；基線調整獨立 commit |
| **IV. 規格文件保護** | ✅ |
| **V. 繁體中文優先** | ✅ |

**Post-Design 複查**：設計未新增概念、未動語義樹。唯一的新欄位 `skipReasons` 直接對應 FR-002。`skipPaths` 從文件變機制**減少**了一處雙重真相。✅ 通過。

## Project Structure

### Documentation (this feature)

```text
specs/053-declare-noop-execute/
├── plan.md              # 本檔
├── spec.md
├── research.md          # Phase 0：八項發現，其中 F2b 是自我修正
├── data-model.md        # Phase 1：六個契約
├── quickstart.md        # Phase 1：八個驗收情境
├── contracts/
│   └── execute-declaration.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/core/
└── types.ts                     # 改：skipPaths 定位、新增 skipReasons

src/interpreter/
├── interpreter.ts               # 改：兩份清單消失，改讀概念註冊表
└── executor-registry.ts         # 改：記錄重複註冊（不報錯）

src/languages/cpp/**/concepts.json  # 改：可宣告的概念加上 skipPaths + skipReasons
src/blocks/semantics/universal-concepts.json  # 改：comment 這類通用概念

tests/
├── integration/
│   ├── noop-classification.test.ts    # 新：34 個全部實測（情境 0）
│   ├── cast-operators.test.ts         # 新：US1b 四個轉型
│   ├── audit-completeness.test.ts     # 改：報表分三欄
│   └── audit-neutrality.test.ts       # 不改（量尺）
└── baselines/
    ├── completeness.json / neutrality.json   # 下調
    └── executor-duplicates.json              # 新
```

## Phase 0 摘要

見 [research.md](./research.md)。改變設計的三項：

- **F8**：清單覆蓋了四個能用的轉型實作（`Map.set` + 清單在最後）。本功能因此多了一個「真的修好東西」的部分
- **F2b**：靜態分類的第一版答案是**反的**。分類改為一律實測
- **F2**：「空得有理」有兩種理由，宣告必須寫明是哪一種

**自我否證已寫進 research 與 contracts**：若 34 個全部可宣告，那是判準太鬆的證據。

## Phase 1 摘要

見 [data-model.md](./data-model.md)（六個契約）與 [contracts/execute-declaration.md](./contracts/execute-declaration.md)。

關鍵設計：

- **`skipReasons` 只有兩個值且不得增加**——這個限制本身就是執行機構
- **執行引擎讀宣告，不持有清單**——同一事實從兩處變一處
- **重複註冊只量不擋**——`history/017`：加嚴之前先回答「被拒絕的東西去哪了」，而這裡的答案目前是「不知道」
- **完備性報表分三欄**——不分的話，下一個人會用宣告刷數字

## Complexity Tracking

| 增加的複雜度 | 為什麼必要 | 若省略會怎樣 |
|---|---|---|
| `skipReasons` 欄位 | FR-002：沒有理由的宣告是把缺陷洗成設計 | 這個功能會變成「把 31 個缺陷改名叫設計」 |
| 完備性報表第三欄 | 兩種下降必須分得出來 | 下一個人用宣告刷數字，而護欄會替他背書 |
| 重複註冊的量測 | F8 的病目前**完全沒有東西在看** | 下一次覆蓋還是會無聲發生 |

**沒有一項是為未來預留的。** 每一項都對應 Phase 0 實測到的一個具體問題。
