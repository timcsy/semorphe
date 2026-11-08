# Implementation Plan: 操作者介面第一刀——「提議中」的變更

**Branch**: `368-operator-proposals` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/220-operator-proposals/spec.md`

## Summary

讓外部操作者（AI、測試）用結構操作（插入／刪除／移動／改屬性，以節點 id 指位置）送「提議」；提議先在副本上驗證與套用，人看過程式碼差異後接受（走既有的 `edit:tree`，可復原）或退回。樹改過之後重新檢查，引用的節點不在或元件變了就照實標過期。核心是不碰 DOM 的純函式與佇列；介面是一條提議列；入口是 `App.proposals`。

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: 既有的語義匯流排與 `SyncController`、元件登錄表與 traits（slot-check、param-spec）、`generateCode`、`alignLines`；無新增依賴
**Storage**: 無（佇列只在工作階段的記憶體中）
**Testing**: Vitest（單元、整合）、Playwright（e2e）
**Target Platform**: 瀏覽器（網頁版）與 VSCode webview（共用 App）
**Project Type**: 單一前端專案
**Performance Goals**: 送出到看見提議 < 1 秒（SC-001）
**Constraints**: 核心零 DOM（audit-portable-core）；分層（audit-layering）；不寫死元件名（audit-neutrality）；不新增視圖直接呼叫（audit-four-independences）
**Scale/Scope**: 課文長度的程式；佇列數個提議

## Constitution Check

| 原則 | 判定 |
|---|---|
| I 簡約優先 | ✅ 列而不是面板、文字差異而不是 diff editor、不做依形狀重新對位、VSCode 外部訊息延後 |
| II TDD | ✅ 核心純函式先寫單元測試（每一種拒絕原因各一支），e2e 寫在介面之前 |
| III Git 紀律 | ✅ 依 tasks 分段提交 |
| IV 規格文件保護 | ✅ |
| V 繁體中文 | ✅ |
| 專案原則：P6 誠實降級 | ✅ 不合法 → 拒並說原因；過期 → 不硬套 |
| 專案原則：分工（history/334） | ✅ 不判對錯、不擋接受；權限與委派不做 |

無違反。

## Project Structure

### Documentation (this feature)

```text
specs/220-operator-proposals/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/proposals-api.md
└── tasks.md
```

### Source Code

```text
src/core/proposals/
├── tree-ops.ts        # TreeOp、NodeSpec、OpSchema、applyOps、refsOf（純函式）
├── line-diff.ts       # lineDiff（以 alignLines 組 +／-）
└── proposal-queue.ts  # ProposalQueue：submit／list／get／accept／reject／revalidate（無 DOM）
src/ui/
├── proposal-bar.ts    # 提議列（作者、理由、差異、還有幾個、接受／退回）
└── app.ts             # 組 OpSchema、接佇列、訂閱 semantic:update、accept → edit:tree、lastEditor 'proposal'
tests/unit/core/proposals/
├── tree-ops.test.ts
├── line-diff.test.ts
└── proposal-queue.test.ts
tests/integration/proposals-roundtrip.test.ts   # SC-005：四種語言
e2e/proposals.spec.ts
```

**Structure Decision**: 核心模組放 `src/core/proposals/`（新的子目錄，`src/core/README.md` 加一列）；`OpSchema` 由 App 注入（核心不 import `languages/`）。

## 設計要點（細節見 research）

- 接受：`bus.emit('edit:tree', { viewId: 'proposal', tree })`；同步中則回報「稍後再試」、提議留著（R1）。
- 復原：`lastEditor = 'proposal'` → `undoTree`（R2）。
- 過期：訂閱 `semantic:update`，對每個 pending／stale 重跑 `refs` 比對＋`applyOps`（R3）。
- 差異：改前 = 目前樹產碼＋補丁器；改後 = 提議後的樹產碼＋補丁器；`lineDiff`（R6）。
- 入口：`App.proposals = { submit, list, get }`，不暴露 accept／reject（R8）。

## Complexity Tracking

無。
