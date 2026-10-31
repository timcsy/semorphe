# Implementation Plan: Cella 的除錯工作階段（重構階段 5b）

**Branch**: `183-cella-debug-session` | **Date**: 2026-10-31 | **Spec**: [spec.md](spec.md)

## Summary

`ExecutionSession` 換成 DAP 的形狀（R1）；Cella 提供者在 5a 的 worker 裡開 `cella-lang/dap` 的工作階段，宣告 `session`；
JS 直譯器的提供者照新形狀包。翻不出來、未就緒、無法使用時退回 JS 直譯器並標出處（R3）。覆蓋標記等 cella 回覆（R2）。

## Technical Context

**Language/Version**: TypeScript 5.x　**Dependencies**: `cella-lang/dap`（0.1.202610310706）、5a 的 worker／cache／entry
**Testing**: Vitest（介面轉換、退回、出處）＋ 探針（`cella-dap-cost`）＋ Playwright（`e2e/debug.spec.ts` 等既有的執行與除錯 e2e、新的 `cella-session.spec.ts`）
**Constraints**: 主執行緒不卡；P8 不留相容層；判題路徑不動（階段 6）

## Constitution Check

| 原則 | 判定 |
|---|---|
| I. 簡約 | ✅ 一種介面（DAP 形狀），不並存兩套 |
| II. TDD | ✅ 先寫介面契約測試（兩個提供者都要過同一組） |
| III. Git | ✅ 介面 → JS 提供者照新形狀 → 控制器 → Cella 提供者 → e2e |
| V. 繁中 | ✅ |

專案原則：P6（出處、退回原因、缺項要看得見）；P8（介面換一次，不留舊形狀）；分層護欄（控制器只認 `core/capabilities`）。

## Project Structure

```text
src/core/capabilities.ts          # ExecutionSession → DAP 形狀；提供者可以「不接」並說原因
src/providers/js-interpreter/     # 回呼模型在這裡轉成 DAP 形狀
src/providers/cella/worker.ts     # 加 DAP 工作階段（第二個模組、第二個快取鍵）
src/providers/cella/provider.ts   # 宣告 session；createSession 轉送 worker
src/ui/execution-controller.ts    # 改用新介面；狀態列顯示出處
tests/contract/session-contract.test.ts   # 兩個提供者跑同一組
e2e/cella-session.spec.ts
```

## 風險與處置

| 風險 | 處置 |
|---|---|
| 控制器 962 行、邏輯纏著回呼模型 | 先寫兩個提供者共用的契約測試，再改控制器；既有 e2e 全跑 |
| 加速／跳過一整層依賴每步回呼 | 契約裡明列；Cella 路徑做不到就退回並標出處 |
| 覆蓋資料缺 | R2：標 `missing: steps`，畫面說得出來 |
| 第一次執行要多編 20 秒 | R4：那次由 JS 跑、背景編好 |
