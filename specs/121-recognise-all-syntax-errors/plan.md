# Implementation Plan: 辨識層只認得一半的語法錯誤

**Branch**: `121-recognise-all-syntax-errors` | **Date**: 2026-08-14 | **Spec**: [spec.md](spec.md)

## Summary

解析器有**兩種**標記錯誤的方式（實體錯誤節點／傳播旗標），而我們只認得前者
——於是三種漏分號的寫法只抓得到一種，而漏掉的兩種**更常見**。

本功能補上另一種，並讓訊息引用完整的一行原文。
順帶把三情境探測的時間上限調到量得出來的需求之上。

✅ **而安全網已經在了**：第四十三條護欄量的正是「合法程式被誤標」（今天 0）。
`history/017` 說「加嚴一個檢查必須連同安全網一起做」——**這次它先到了**。

## Technical Context

**Language/Version**: TypeScript 5.x | **Primary Dependencies**: web-tree-sitter 0.26.6

**Storage**: N/A | **Testing**: Vitest、Playwright | **Target Platform**: 瀏覽器

**Project Type**: 單一前端專案

**Performance Goals**: 無新增。⚠️ 判定從「遞迴找 ERROR」變成「讀一個旗標」
——**更快**，因為旗標是解析器算好的

**Constraints**: 43 條護欄基線一個都不動；🔴 第四十三條**必須維持 0**

**Scale/Scope**: 2 個 src 檔（`lifter.ts`／`types.ts`）＋ 1 個測試設定；
異動預估 20 行以內

## Constitution Check

| 原則 | 判定 | 依據 |
|---|---|---|
| **I. 簡約優先／YAGNI** | ✅ | 改的是**一個判定式**與**一個欄位來源**。沒有新類別、沒有新抽象。⚠️ 而 `hasError?` 是選用，理由在 research 決策 2（不是「怕壞」，是**對假樹沒有意義**） |
| **II. TDD（非妥協）** | ✅ | 三支先紅：A／C 兩種形狀被標記、落點不往上飄、訊息引用完整原文。⚠️ 而**第四十三條今天是綠的**——它是安全網不是先紅的對象 |
| **III. Git 紀律** | ✅ | 辨識改動與逾時調整**分開 commit**（兩件無關的事） |
| **IV. 規格文件保護** | ✅ | |
| **V. 繁體中文優先** | ✅ | |

⚠️ **一個要正面說的**：本功能**擴大**了「什麼算語法錯誤」，
而 `history/017` 逐字「加嚴一個檢查，可能讓事情比不檢查更糟」。
**這次的安全網是上一輪蓋的第四十三條**——所以順序是對的，
而**驗收 US3 就是去確認那張網真的接得住**。

## Project Structure

### Documentation

```text
specs/121-recognise-all-syntax-errors/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/error-detection.md
└── checklists/requirements.md
```

### Source Code

```text
src/core/lift/
├── types.ts     🟡 AstNode 加 hasError?: boolean（選用，理由見 research 決策 2）
└── lifter.ts    🔴 hasErrorDescendant 認旗標；rawCode 一律用節點原文

tests/
├── unit/core/lift-syntax-error.test.ts   🔴 三種形狀 ＋ 落點 ＋ 原文
└── probes/scenario-coverage.test.ts      🟡 上限 300s → 900s ＋ 理由

e2e/diagnostics.spec.ts                   🟡 三種形狀按執行都不跑
```

**Structure Decision**: 不新增目錄、不搬檔案。

## Phase 1：設計產出

- [contracts/error-detection.md](contracts/error-detection.md) · [data-model.md](data-model.md) · [quickstart.md](quickstart.md)

## Complexity Tracking

> 無違反。

## Constitution Re-check（Phase 1 後）

| 原則 | 複查 |
|---|---|
| **I. 簡約優先** | ✅ 最終形狀是**兩行判定 ＋ 一個選用欄位 ＋ 一個常數**。⚠️ 而落點邏輯**一行不改**——research 決策 1 證明它與「錯誤怎麼表示」無關 |
| **II. TDD** | ✅ quickstart 三步先紅；而第四十三條在每一步後都要跑 |
| **III／IV／V** | ✅ |
