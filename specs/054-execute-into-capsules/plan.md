# Implementation Plan: 執行那一路搬回它的模組

**Branch**: `054-execute-into-capsules` | **Date**: 2026-08-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/054-execute-into-capsules/spec.md`

## Summary

語言套件的模組已經有固定形狀，五路裡四路住在模組裡，**只有執行那一路住在核心層**。這一步把「整份可搬」的 58 個執行器搬回它們的模組。

Phase 0 修正了 spec 的一處與補了一處：

1. **字串那份也跨模組**（`std/string` 17 ＋ `std/cstring` 10）。spec 寫成「→ `std/string/executors.ts`」是錯的——**用檔名推歸屬會錯**，檔名反映的是誰跟誰寫在一起方便，不是誰屬於誰。
2. **七個跨容器的泛用操作歸語言核心**——它們宣告在 `core/concepts.json`、generator 也早在 `core/generators/`，只有執行那一路走丟了。

## Technical Context

**Language/Version**: TypeScript 5.9 ｜ **Primary Dependencies**: 無新增 ｜ **Testing**: Vitest
**Target Platform**: 瀏覽器 ｜ **Project Type**: 單一前端專案

**Constraints**:

- **執行行為零改動**——這是純搬移
- 語言中立性 MUST 下降；其餘六項量測 MUST NOT 上升
- 既有測試全數維持通過

**Scale/Scope**: 58 個執行器 → 8 個標準函式庫模組 ＋ 語言核心；`src/interpreter/executors/` 減四個檔

## Constitution Check

| 條 | 評估 |
|---|---|
| **I. 簡約優先** | ✅ 不新增相依、不新增概念。唯一的型別增量是模組介面加一欄，而它與既有兩欄同形。**設為必填而非選填**是刻意的：選填會讓忘記接上的模組靜靜地少一條路 |
| **II. TDD 非妥協** | ✅ 情境 0（固定搬移前的概念集合）是第一個任務。**搬完才想比對就沒有基準了** |
| **III. Git 紀律** | ✅ 每個 Story 一組 commit；基線調整獨立 commit |
| **IV. 規格文件保護** | ✅ |
| **V. 繁體中文優先** | ✅ |

**Post-Design 複查**：設計未新增概念、未動語義樹、未改任何執行邏輯。`hasAnyExecutor()` 是新增的查詢，只用於補一句錯誤訊息，不改變任何判定。✅ 通過。

## Project Structure

### Documentation (this feature)

```text
specs/054-execute-into-capsules/
├── plan.md ／ spec.md ／ research.md ／ data-model.md ／ quickstart.md
├── contracts/module-executors.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/languages/cpp/
├── std/{string,cstring,cmath,vector,queue,map,set,stack}/executors.ts   # 新：13+ 個模組的第五面牆
├── std/types.ts                          # 改：StdModule 加 registerExecutors（必填）
├── std/index.ts                          # 改：聚合時一併接上
├── core/executors/{pointers,containers}.ts  # 新：語言核心的 15 個
└── generators/index.ts                   # 改：載入時推送執行器

src/interpreter/
├── executors/{strings,containers,pointers,cmath}.ts   # 刪
├── executor-registry.ts                  # 改：加 hasAnyExecutor()
└── interpreter.ts                        # 改：未知概念的訊息補一句

tests/
├── integration/executor-inventory.test.ts   # 新：概念集合比對（主防線）
└── assets/executor-inventory.json           # 新：搬移前的集合（測試資產）
```

**結構決策**：執行器檔名為 `executors.ts`，與同目錄的 `generators.ts`／`lifters.ts` 對稱。語言核心的兩份放 `core/executors/`，與 `core/generators/`／`core/lifters/` 對稱。**不發明新形狀。**

## Phase 0 摘要

見 [research.md](./research.md)。六項發現，兩項改變了設計（見上方 Summary）。

**兩條自我否證都先驗過了**：

- 每個概念只屬於一個模組 → 149 個概念、**0 個跨模組重複宣告**，落點表成立
- 沒有批次註冊（迴圈／表格）→ 四份都是逐行 `register('x', ...)`，**58 這個數字完整**

## Phase 1 摘要

見 [data-model.md](./data-model.md) 與 [contracts/module-executors.md](./contracts/module-executors.md)。

- **模組介面加一欄且必填**——編譯器擋得住的東西不要留給人
- **落點由概念註冊表決定**，不由檔名決定
- **主防線是集合比對**，不是輸出比對——後者漏一個不會現形
- **「沒載入語言套件」的判準是「註冊表是空的」**，不是「概念名長得像 C++」——後者又會讓核心去認識語言

## Complexity Tracking

| 增加的複雜度 | 為什麼必要 | 若省略會怎樣 |
|---|---|---|
| 模組介面第三個註冊函式 | 五路完備性在檔案層級的樣子 | 執行那一路永遠留在核心層 |
| `hasAnyExecutor()` | 分辨「概念未知」與「語言套件沒載入」 | 錯誤訊息看不出真正原因（上一輪 144 個失敗就是這樣） |
| 概念集合的測試資產 | 搬移漏失的唯一可靠防線 | 漏一個不會現形 |

**沒有一項是為未來預留的。**
