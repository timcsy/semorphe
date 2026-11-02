# Implementation Plan: 膠囊自證測換判準——第二批（6c-2b）

**Branch**: `225-migrate-capsules-mid` | **Spec**: [spec.md](spec.md)

## 技術脈絡

TypeScript 5.x、Vitest；入口 `tests/helpers/cella-run.ts`（`runCella`、`expectCellaOut`、`knownCellaGap`），走 lift → formalize → verdict。

## 憲章檢查

- 測試先行：這一刀改的就是測試；每一條改完先跑、紅了逐條判斷誰對（P6：判不出來不得算過）。
- 不做向後相容：直譯器引用整個拿掉，不留雙判準。

## 做法

1. 每檔把 `run()` 換成 `expectCellaOut`／`runCella`；`rejects.toThrow()` 換成斷言 `runCella` 的 verdict 與 problems／untranslated 的原因。
2. 巨集兩檔：Cella 從原始碼判，不需要 `resetDefinedMacros`（那是直譯器的全域狀態）。
3. 紅了：先問 C++ 的答案（標準／參照編譯器），再決定改期望值或 `knownCellaGap`。
