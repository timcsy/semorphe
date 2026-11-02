# Implementation Plan: 整合測試換判準——第二批（6c-2e）

**Branch**: `228-migrate-integration-mid` | **Spec**: [spec.md](spec.md)

入口：`tests/helpers/cella-run.ts`。分三組並行（不同檔）：參照編譯器即時比對（10）、基線與內部模組（7）、大型或跨語言（5；只有這一組可以改 `cella-run.ts`——擴充 Python）。
