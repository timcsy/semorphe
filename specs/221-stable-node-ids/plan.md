# Implementation Plan: 改程式碼之後，沒動到的節點保住身分

**Branch**: `369-stable-node-ids` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

## Summary

新增核心純函式 `carryIds(prev, next)`：由上而下對位，對上的節點把 `id` 改成前一棵的。`SyncController.handleEditCode` 在 lift 之後、換樹之前呼叫它。
「程式被換掉」是顯式事件：App 的 `programReplaced()`（推進 `languageConversionEpoch` 的那幾個地方，加上課文起始程式與匯入）呼叫 `ProposalQueue.staleAll()`，被標的提議黏住過期。

## Technical Context

TypeScript 5.x；無新增依賴；核心零 DOM。測試：Vitest（單元：對位的每一種情況）、Playwright（e2e：改別處提議還在、套範例過期）。

## Constitution Check

I 簡約（一個純函式＋一個呼叫點＋一個事件）✅ · II TDD ✅ · P6 誠實降級：對不上就換新、提議照實過期 ✅

## 設計

- 對位（`src/core/sync/carry-ids.ts`）：
  1. 元件不同 ⟹ 不對、不往下。
  2. 同一個接點：先以「整棵子樹形狀相同」做最長共同子序列；
  3. 對上的那些之間的每一段空隙：兩邊數量相同且逐一同元件 ⟹ 逐一對位；否則那一段都不對。
  4. 對上的遞迴往下。
- 呼叫點：`handleEditCode` 的 `this.lifter.lift(rootNode)` 之後（`this.currentTree` 存在時）。
- `ProposalQueue.staleAll(detail)`：每個待處理提議 `sticky = true`、`status = stale`、`reason.code = 'replaced'`；`check()` 遇到 sticky 不改。
- App：`programReplaced()` 在 `applyTemplate`、`handleTargetChange`、`seedArrange`、`seedDebug`、匯入檔案時呼叫。
