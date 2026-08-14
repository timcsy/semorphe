# Implementation Plan: 寫錯的程式不該跑得起來——先量再擋

**Branch**: `120-reject-invalid-programs` | **Date**: 2026-08-14 | **Spec**: [spec.md](spec.md)

## Summary

少一個分號今天**照樣跑得起來**——那個標記是附註不是閘門。
本功能先**量**（那 27 段「只有我們跑得動」的是什麼），再**擋**
（語法錯誤在按執行時攔住）。

🔴 **而 research 推翻了 spec 的一個成本假設：US4（型別檢查）移出本 spec。**
它不是「中等成本」，是三個子問題，其中一個是既有架構債——而**硬做會產出一個
漏掉使用者原本舉的例子的版本**。

## Technical Context

**Language/Version**: TypeScript 5.x

**Primary Dependencies**: web-tree-sitter 0.26.6、Monaco、Blockly 12.4.1；
參照編譯器（g++／Apple clang，僅測試用）

**Storage**: N/A

**Testing**: Vitest、Playwright

**Target Platform**: 瀏覽器（而 US1 的量測只在測試環境跑）

**Project Type**: 單一前端專案

**Performance Goals**: 無新增。⚠️ 閘門是一次全樹走訪，
而 `diagnosticsFromTree` 已經每次同步走一遍——**可以共用結果**

**Constraints**: 43 條護欄基線一個都不動；⚠️ **既有測試直接呼叫
`interpreter.execute(tree)`，閘門不可放在那一層**

**Scale/Scope**: 27 段待分類；1 個閘門；異動預估 3 個 src ＋ 3 個 tests

## Constitution Check

*GATE: 通過。Phase 1 後複查見末尾。*

| 原則 | 判定 | 依據 |
|---|---|---|
| **I. 簡約優先／YAGNI** | ✅ **通過，而它是靠 descope 通過的** | US4 需要①元件宣告接收者型別（0/25）②變數型別表（不存在）③接收者從字串變成引用（**既有架構債**）。**移出本 spec**，理由記在 research 決策 2 |
| **II. TDD** | ✅ | 三支先紅：分類報表、按執行被擋、⚠️ **而「編輯時不擋」今天是綠的**（今天什麼都不擋）→ 靠注入 |
| **III. Git 紀律** | ✅ | US1（量）與 US2（擋）分開 commit——⚠️ **因為 US1 的結果可能改變 US2 的做法** |
| **IV. 規格文件保護** | ✅ | |
| **V. 繁體中文優先** | ✅ | |

⚠️ **一個要正面說的**：閘門放在 `ExecutionController` 而不是直譯器，
看起來像「把檢查放在錯的層」。**而那是刻意的**——FR-004 要求的是**時機**
（按執行才判），而直譯器不知道時機，它只知道有人給了它一棵樹。
**既有測試直接呼叫 `execute(tree)`，放在那一層會擋掉一大片。**

## Project Structure

### Documentation (this feature)

```text
specs/120-reject-invalid-programs/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/execution-gate.md
├── checklists/requirements.md
└── tasks.md（/speckit-tasks 產出）
```

### Source Code

```text
src/
├── core/diagnostics.ts               🟡 匯出一個「這棵樹能不能跑」的判定（沿用 DIAGNOSTIC_CAUSES）
└── ui/
    ├── execution-controller.ts       🔴 閘門：兩個 execute 呼叫點之前
    └── refusal-message.ts            🟡 加一個執行拒絕的訊息（形狀已存在）

tests/
├── integration/audit-behavior-error.test.ts   🔴 US1：onlyInterpreterRuns 從數字變明細
├── unit/core/execution-gate.test.ts           🆕 閘門的判定（純函式）
└── unit/ui/refusal-message.test.ts            🟡 既有——加執行拒絕那一則

e2e/
└── diagnostics.spec.ts               🟡 加「按執行被擋」與「編輯時不擋」
```

**Structure Decision**: 沿用既有結構，不新增目錄。

## Phase 1：設計產出

- [contracts/execution-gate.md](contracts/execution-gate.md)
- [data-model.md](data-model.md)
- [quickstart.md](quickstart.md)

## Complexity Tracking

| 違反 | 為什麼需要 | 為什麼不用更簡單的 |
|---|---|---|
| **無** | —— | ⚠️ 唯一的複雜度來源（US4）**已經移出**，見 research 決策 2 |

## Constitution Re-check（Phase 1 後）

| 原則 | 複查 |
|---|---|
| **I. 簡約優先** | ✅ 閘門是**一個純函式 ＋ 兩個呼叫點**，沒有新類別、沒有註冊表。⚠️ 而它**重用** `DIAGNOSTIC_CAUSES`——「哪些降級原因是使用者的錯」只有一處定義 |
| **II. TDD** | ✅ quickstart 三步先紅，每支要人工確認紅的理由 |
| **III. Git 紀律** | ✅ |
| **IV／V** | ✅ |

⚠️ **而 US1 的結果有權力改變 US2**——tasks 會把它寫成一個**檢查點**，
不是一句提醒。
