# Implementation Plan: 整合測試換判準——第一批（6c-2d）

**Branch**: `227-migrate-integration-low` | **Spec**: [spec.md](spec.md)

入口：`tests/helpers/cella-run.ts`（`runCella`、`expectCellaOut`、`knownCellaGap`、板子的 `boardEnv`／`boardPin`）。
分三組並行（不同檔）：盲測與往返（14）、大型程式樣式（6）、語意細節（20）。紅了先問 C++ 的答案，再決定改期望值或釘住。
