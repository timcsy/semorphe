# Implementation Plan：積木面板裡的第二套程式碼產生器

**Branch**: `060-panel-parallel-generator` ｜ **Date**: 2026-08-06 ｜ **Spec**: [spec.md](./spec.md)

## Summary

面板的 `simpleExpressionToCode` 是一套與核心平行的手寫產生器。實測八種節點兩套產出一字不差——**它現在是對的，而它沒有理由永遠是對的**。刪掉它，改呼叫唯一那套。

## Technical Context

| | |
|---|---|
| **語言** | TypeScript 5.x｜**新增相依**：無 |
| **改動** | `src/ui/panels/blockly-panel.ts`、`src/ui/sync-controller.ts`（注入語言與風格） |
| **NEEDS CLARIFICATION** | 無 |

## Constitution Check

| 條款 | 狀態 |
|---|---|
| I 簡約優先 | ✅ **淨刪除**——移除一整個 switch，不新增機制 |
| II TDD | ✅ 切換**之前**先拍快照，且快照必須先綠（證明它拍到了東西）再動程式碼 |
| III Git 紀律 | ✅ 快照與切換分開 commit |
| IV 規格文件保護 | ✅ 只增不刪 |
| V 繁體中文 | ✅ |

## Phase 0：Research ✅

唯一的未知是「唯一那套能不能產出相同的東西」，已實測：

| 節點 | 面板那套 | 唯一那套 |
|---|---|---|
| 數字／變數引用／算術 | `5`／`x`／`a + 1` | **相同** |
| 字串取字元 | `s[0]` | **相同** |
| 遞增運算式 | `i++` | **相同** |
| 三元運算 | `c ? 1 : 2` | **相同** |
| 型別轉換 | `(int)d` | **相同** |
| 內建常數 | `INT_MAX` | **相同** |

**八種全部相同。** 所以這不是「改寫」，是「刪掉一份重複的」。

**語言與風格從哪來**：`sync-controller.ts` 已經持有 `this.language` 與 `this.style`（見 `:181`）。面板由它注入。

## Phase 1：Design ✅

契約一條：**切換前後輸出一字不差**，比對對象是產出的文字，由切換之前拍的快照釘住。

`default` 分支的行為（產不出來時）也要拍——它在降級路徑上，平常跑不到，最容易無聲改掉。

## Tasks

- [X] T001 建 `tests/integration/panel-expression-parity.test.ts`：拍下面板 switch 涵蓋的**每一種**節點的產出，含 `default` 分支 — 契約
- [X] T002 確認 T001 **先綠**——它必須證明自己真的拍到了東西，否則後面的比對是空的
- [X] T003 在面板加入語言與風格的注入點，`sync-controller` 建立面板時推進去 — FR-003
- [X] T004 `simpleExpressionToCode` 改為呼叫唯一那套；**整個 switch 刪除** — FR-001／FR-002
- [X] T005 `default` 分支的行為保持不變 — FR-005
- [X] T006 T001 逐一比對，一字不差 — FR-004
- [X] T007 中立性量測，確認下降且全部落在「真的搬走的」欄 — SC-001
- [X] T008 全套測試 + 十三條護欄 — FR-010／FR-011

## 風險

| 風險 | 緩解 | 在哪驗 |
|---|---|---|
| 某個節點產出不同，而它在降級路徑上平常跑不到 | 切換**之前**拍快照 | T001／T002 |
| `default` 行為無聲改變 | 一併拍進快照 | T001 |
| 面板拿不到語言與風格，於是又寫死一個 | FR-003；沒有值時的行為要明確 | T003 |
