# Implementation Plan：參照元件的讀數要能重新量

**Branch**: `108-residual-error-baselines` ｜ **Spec**: [spec.md](spec.md)
**Input**: [spec.md](spec.md)、[research.md](research.md)、[data-model.md](data-model.md)

## Summary

蓋兩條互不相干的護欄，並收攏一份共用工具：

```
① runCpp 收攏        2 份私有實作 → 1        （US3，US2 的前置）
② 殘差護欄           起點 0.23%，棘輪         （US1，可獨立交付）
③ 誤差護欄           起點 64／276，棘輪       （US2，最高風險）
```

## Technical Context

| | |
|---|---|
| 語言 | TypeScript 5.x |
| 測試 | Vitest 4.0.18 |
| 解析 | web-tree-sitter 0.26.6（`rootNode.hasError` 用來分語料欄） |
| 參照編譯器 | **Apple clang 16.0.0**（`/usr/bin/g++` 是別名）｜旗標 `-std=c++17` |
| 既有可複用 | `tests/helpers/guardrail.ts`（基線／棘輪／報告） |
| 新增外部依賴 | **無** |

無 NEEDS CLARIFICATION——research.md 已把六個未知全部實測掉。

## Constitution Check

| 原則 | 判定 | 說明 |
|---|---|---|
| **I. 簡約優先** | ✅ | 不新增抽象層。`runCpp` 的收攏是**消除**重複而非預留擴充。⚠️ 兩條護欄**不共用**基礎結構——那不是重複，是 FR-008 明文要求的分離 |
| **II. TDD** | ⚠️ **形狀不同但更嚴** | 護欄類的「紅」不是先寫失敗測試，而是 `build-guardrail` 6.5「第一次跑必須是紅的」——**先跑真實世界、確認紅、逐項指名、最後才產基線**。先產基線＝把現況封為合格。已寫成 FR-012 |
| **III. Git 紀律** | ✅ | 三個交付各自 commit；誤差那條的「首次紅」要**單獨留一個 commit**（SC-006） |
| **IV. 規格保護** | ✅ | 不動 specs/ |
| **V. 繁中優先** | ✅ | 文件繁中、識別字英文 |

**Post-Design 重評**：無新增違規。唯一的張力是 I 與 FR-008——已在上表說明為何分離不算過度設計。

## Project Structure

```
tests/
  helpers/run-cpp.ts                              ← 新增（US3）
  integration/audit-projection-residual.test.ts   ← 新增（US1）
  integration/audit-behavior-error.test.ts        ← 新增（US2）
  baselines/projection-residual.json              ← 新增
  baselines/behavior-error.json                   ← 新增
  assets/behavior-error-decisions.json            ← 新增（判定落點）
  integration/fuzz-cpp-strings.test.ts            ← 改（改用共用工具）
  integration/fuzz-cpp-stacks-queues.test.ts      ← 改（同上）
```

## Phase 0：Research ✅

見 [research.md](research.md)。六項決策，全部有實測支撐。最關鍵的兩條：

1. **參照編譯器是 Apple clang 不是 GCC** → `_meta` 記版本字串原文
2. **誤差第一次是 64／276（23.2%）** → 而它**很可能又是語料問題**，必須先分類再定基線

## Phase 1：Design ✅

見 [data-model.md](data-model.md)、[quickstart.md](quickstart.md)。

### 實作順序與理由

```
US3 (runCpp)  →  US2 (誤差)      US2 需要它
US1 (殘差)                        獨立，可並行
```

⚠️ **US1 先做完並 commit**，理由是 `build-guardrail` 的「護欄先蓋，功能後做」——
US1 起點已知（0.23%）、不依賴外部工具，是驗證整套流程的最便宜路徑。
若 US2 卡住（64 筆分類是人工判斷），US1 已經是完整的交付。

### 三個必須寫進程式碼的約束

| 出處 | 形狀 |
|---|---|
| FR-010 | 自我否證聲明錨在**合成輸入**（「語料載入了幾段」），**不是**錨在殘差／誤差計數 |
| FR-006 | `hasReferenceCompiler()` 為 false ⇒ **丟例外**，不是 `it.skip` |
| FR-005 | 四欄語料統計進基線——**分母縮小會讓誤差看起來下降** |

## Complexity Tracking

無需要辯護的違規。
