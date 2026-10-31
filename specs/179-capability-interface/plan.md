# Implementation Plan: 能力介面（179）

**Branch**: `179-capability-interface` | **Date**: 2026-10-31 | **Spec**: [spec.md](spec.md)
**Design**: `knowledge/draft/2026-10-31-重構的設計-能力介面與降級路徑.md`

## Summary

把「誰給語意」從 `ui/execution-controller.ts` 的三處 `new SemanticInterpreter` 抽成**能力介面＋有序登錄表**。
JS 直譯器包成第一個提供者；介面層不再 import `interpreter/`。學生看到的行為逐字不變。

## Technical Context

TypeScript 5.x、Vite、Vitest、Playwright（e2e）。不加依賴。

量到的接縫（2026-10-31）：
- 產品裡直接碰直譯器的只有 `ui/execution-controller.ts`：三處建構（360／453／700），用到 13 個方法：
  `setInputProvider` `setOutputCallback` `setWaitingCallback` `setUnknownComponentPause` `setRecordSteps` `setStepRecordCallback`
  `execute` `executeWithSteps` `abort` `snapshotScope` `setVariableFromHost` `getVisitCounts` `getRecordedInputs`；
  另外 `instanceof RuntimeError`（422／473／760）判停止原因，並從 `interpreter/types` 拿 `StepInfo`／`ExecutionSpeed`／`ExecutionStatus`（這三個本來就住在 `core/execution.ts`）。
- 判題在 `ui/app.ts:583`：比對執行時收集的 stdout（走匯流排），不碰直譯器 ⟹ 本階段不動。
- 分層護欄 `tests/integration/audit-layering.test.ts:38` 的 `FORBIDDEN` 表。

## Constitution Check

- 簡約優先：只抽控制器真的用到的 13 個方法，不預先設計 Cella 的全部 DAP 面（階段 5 再長）。✅
- 測試驅動：先寫登錄表與「核心不認提供者」的測試（注入一個違規要紅），再搬控制器。✅
- 繁體中文：註解與測試名中文。✅

## Design

```
src/core/capabilities.ts          能力名、能力宣告、ExecutionSession 介面、SessionStop、Provided<T>、登錄表
src/providers/js-interpreter/     第一個提供者：包 SemanticInterpreter；RuntimeError → SessionStop
組裝點（main.ts、vscode/webview/main.ts、tests/helpers）  registerProvider(jsInterpreterProvider)
ui/execution-controller.ts        向登錄表要 session；改判 SessionStop；型別改從 core/execution 引
```

- **能力宣告**：`{ session?: { granularity: 'statement'|'node'; setInput; setVariable; steps }, verdict?: true, types?: true }`。
  JS 直譯器：`session = { granularity: 'node', setInput: false, setVariable: true, steps: true }`，不宣告 verdict／types。
- **`Provided<T>`**：`{ value, provenance, missing }` 或 `{ value: null, provenance: null, missing: [能力] }`——沒有提供者時不回 undefined（FR-008）。
- **`ExecutionSession`**：名字照 DAP 的語彙但只放今天用到的 13 件事（`run`／`runWithSteps`／`abort`／`setVariable`／`visitCounts`／`recordedInputs`……）。
- **`SessionStop`**（核心型別）：`{ kind: 'aborted' | 'runtime', i18nKey, params, nodeId }`——控制器只認它，不認 `RuntimeError`。
- **分層**：`core` 與 `ui` 禁止 import `providers`；`ui` 另禁止 import `interpreter`；`providers` 禁止 import `ui`、`vscode`。

## Phases

1. 測試先行：登錄表（挑第一個宣告者、缺項結果）、`SessionStop` 正規化、分層護欄的新規則（含注入）。
2. 核心型別與登錄表。
3. JS 直譯器提供者。
4. 控制器改向登錄表要 session；三處建構合成一處。
5. 組裝點登記；happy-dom 測試的 helper 登記。
6. 全套、e2e（行為不變的證據）、`audit-layering` 基線只准下降。

## Risks

- 控制器有三條執行路徑（run／step／animate），合成一處建構時漏掉某一條的回呼 ⟹ e2e 的逐步、動畫、輸入那幾支是證據。
- `vscode/webview` 也是組裝點，漏登記就只有 VSCode 那邊壞 ⟹ 登錄表在「沒有任何提供者」時 `Provided` 帶缺項，控制器顯示錯誤而不是靜默。
