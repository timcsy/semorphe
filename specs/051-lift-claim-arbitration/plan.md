# Implementation Plan: 讓「誰認領這段語法」不再靠運氣

**Branch**: `051-lift-claim-arbitration` | **Date**: 2026-08-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/051-lift-claim-arbitration/spec.md`

## Summary

第五條護欄：量出「哪些辨識規則在搶同一種語法」，讓 P3「歧義在註冊時仲裁，不在執行時碰運氣」第一次有執行機構。

**零行為改動**——本功能只讓歧義可見，不改任何匹配結果。

技術取徑：從測試載入路徑讀取載入後的規則表，對同一語法節點的每一對規則做三分類（確定會撞／不會撞／無法確定），四個數字各自進棘輪。**判定保守**：只有能證明互斥才判「不會撞」。

Phase 0 最關鍵的發現是 **F2**：判別式不只在限定條件裡。`chain` 型規則的判別式住在運算子與根文字——漏掉這層，護欄會在專案最常用的兩條規則（`print`／`input`）上誤報，而那足以讓維護者立刻學會忽略整個護欄。

## Technical Context

**Language/Version**: TypeScript 5.x（ESM，`strict`）

**Primary Dependencies**: 無新增

**Storage**: `tests/baselines/lift-ambiguity.json`（第五份基線）

**Testing**: Vitest。護欄本身即測試，位於 `tests/integration/`

**Target Platform**: Node.js（測試）

**Project Type**: 單一專案

**Performance Goals**: 純靜態分析，76 條規則的兩兩比對可忽略不計

**Constraints**: **零行為改動**——`src/` 不得有任何改動；既有 3047 測全數維持通過；前四項量測數字皆未上升

**Scale/Scope**: 76 條規則、47 種語法節點、8 個同優先權群組

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 憲章原則 | 本功能如何遵守 | 判定 |
|---|---|---|
| **I. 簡約優先（YAGNI）** | 判定程序只有三步；否決了「跑樣本動態驗證」（更複雜且給假安全感）；不新增型別到 `src/`、不開新的公開介面 | ✅ |
| **II. 測試驅動開發（非妥協）** | 護欄本身即測試。TDD 形式同 049：先寫斷言（紅：基線缺失）→ 建立基線 → 綠。**另有一支測試釘住已知案例**（FR-022），它是護欄的自我驗證 | ✅ |
| **III. Git 紀律** | 三個 Story 各自 commit；基線建立獨立 commit | ✅ |
| **IV. 規格文件保護** | 不觸及既有規格 | ✅ |
| **V. 繁體中文優先** | 全部文件繁中；識別符英文 | ✅ |

**無違規，無需 Complexity Tracking。**

> ⚠️ 與 049 相同的一處要講清楚：**本護欄第一天預期不是零**。8 個同優先權群組已知存在。TDD 的 Red→Green 指「斷言邏輯先紅（基線缺失）→ 建立基線後綠」，不是「歧義歸零才綠」。

## Project Structure

### Documentation (this feature)

```text
specs/051-lift-claim-arbitration/
├── spec.md / plan.md / research.md / data-model.md / quickstart.md
├── contracts/README.md
├── checklists/requirements.md
└── tasks.md            # Phase 2
```

### Source Code (repository root)

```text
src/                     # ⛔ 零改動（FR-030）

tests/
├── baselines/
│   └── lift-ambiguity.json          # 新增，第五份基線
├── helpers/
│   └── discriminator.ts             # 新增：萃取判別式 + 互斥判定
└── integration/
    └── audit-lift-ambiguity.test.ts # 新增：第五條護欄
```

**Structure Decision**：完全落在測試層。判定邏輯抽到 `tests/helpers/discriminator.ts`，因為它是本功能唯一有實質邏輯的部分，需要自己的單元測試（誤報風險集中在那裡——與 049 的掃描規則同理）。

## Phase 0 摘要（詳見 research.md）

| # | 發現 |
|---|---|
| **F1** | 限定條件的語言很小（`field`／`text`／`nodeType`／`match`），互斥**可判定** |
| **F2** | **判別式不只在限定條件裡**——`chain` 型的判別式在運算子與根文字。漏掉會誤報 `print`／`input` |
| **F3** | `declaration` 的 8 條確認「確定會撞」——這是要釘住的已知案例 |
| **F4** | `pointer_expression` 的一對概念在兩個優先權各出現一次 ＝ **重複登記** |

**五個決策**：D1 三分類保守判定／D2 用測試載入路徑不動生產碼／D3 兩個數字都要且差集是資訊／D4 自我否證聲明／D5 四數字皆棘輪含 `unknown`。

## Phase 1 摘要

- **四個資料形**：`Discriminator`、`PairVerdict`、`AmbiguityGroup`、`DuplicateRegistration`
- **一個契約**：第五份基線的格式，四個數字各自棘輪
- **七個驗證情境**，其中情境 2（已知案例必然出現）與情境 3（不誤報最常用的那對）是護欄的自我驗證

## Constitution Re-check（Phase 1 設計後）

| 原則 | 設計後複查 | 判定 |
|---|---|---|
| I. 簡約優先 | 一個 helper、一支護欄、一份基線。無新相依、無新抽象層、`src/` 零改動 | ✅ |
| II. TDD | 判定邏輯有自己的單元測試（誤報風險集中處）；護欄有自我驗證測試 | ✅ |
| III–V | 同前 | ✅ |

**設計後仍無違規。**

## 已知風險（承接 spec，plan 階段補上緩解手段）

| 風險 | plan 階段的緩解 |
|---|---|
| **誤報最常用的規則** | F2 已定位成因；情境 3 專門驗 `print`／`input` 判為「不會撞」；判別式萃取有單元測試 |
| **漏報已知案例** | 情境 2 ＋ FR-022 的專屬測試釘住 `declaration` 那 8 條 |
| **`unknown` 變成垃圾桶** | 它自己是棘輪（D5） |
| **量測意外改變行為** | `src/` 零改動是硬性約束；前四項量測全程當回歸基準，完備性最敏感 |
| **護欄自己量錯** | D4 的自我否證聲明；**而 050 學到這類錯有一種只有照它行動時才現形**——所以下一輪拿它排歧義修法時，要準備好推翻它 |

## 一個要傳給實作階段的判斷

本功能與 049 的四條護欄是同一族，但有一個關鍵差異：**前四條量的是「有多少東西壞了」，這一條量的是「有多少東西靠運氣」。**

靠運氣的東西**現在可能是對的**——8 個群組裡，登記順序碰巧給出正確結果的不在少數（否則專案早就不能用了）。所以這條護欄的數字下降**不代表修好了 bug**，而代表**移除了一個未來會咬人的機會**。

這個區別要寫進報表，否則維護者會期待「消一組歧義 → 修好一個 bug」，然後發現行為完全沒變而懷疑護欄沒用。
