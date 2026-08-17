# Implementation Plan: 目標（target）

**Branch**: `134-target-named-combination` | **Date**: 2026-08-17 | **Spec**: [spec.md](spec.md)

## Summary

把「課程清單」＋「風格」綁成一個**具名的目標**，讓老師選一次而不是三次。
🔴 **而它不是新的抽象層**——目標**不擁有任何資料**，只持有指向既有東西的引用。
第一個消費者用 **C**（差異已量過：6/10），不是 Arduino。

## Technical Context

**Language/Version**: TypeScript 5.x
**Testing**: Vitest（單元／護欄）＋ `c-style-parity` 探針（要參照編譯器）
**Constraints**: 46 條護欄基線**一個數字不動**；`npm test` 全綠（4195）
**Scale/Scope**: 1 個型別 ＋ 1 個登錄表 ＋ 2 筆資料 ＋ 5 筆標頭對映 ＋ 1 個 `if`

## Constitution Check

| 原則 | 本功能 |
|---|---|
| I. 簡約優先 | ✅ **不發明擺法**——照 `Topic`／`StylePreset` 的先例（research 決策 1） |
| II. TDD（非妥協） | ✅ `c-style-parity` **先看它 6/10**，改完看 10/10 |
| III. Git 紀律 | ✅ 分支已開 |
| IV. 規格文件保護 | ✅ spec 三輪驗證通過；research 把「約 10 筆」修正為實測 5 筆 |
| V. 繁體中文優先 | ✅ |

**Gate**: 🟢 通過。

## Phase 0：Research

✅ 完成 → [research.md](research.md)。三個決策，其中一個推翻了 spec 的估計：

- 🔴 **不是「約 10 筆」，是 5 筆**——而 18 種標頭裡 **13 種在 C 裡根本不存在**，
  **那是可見範圍的責任，不是對映表的**
- **型別在核心、資料在語言套件**——第三個同族的東西照前兩個擺
- **用同一棵樹投影兩次**——不發明序列化比對

## Phase 1：Design

### 目標的形狀（而它不擁有資料）

```
Target
  id        'cpp' | 'c'
  name      顯示用
  topic     → 指向一個【既有的】課程清單 id
  style     → 指向一個【既有的】風格 id
```

🔴 **四個欄位，兩個是引用、兩個是標籤。零新機制。**
⚠️ 而 spec 的 SC-005 判準（「每個欄位說得出今天住在哪裡」）
在這個形狀下是**逐欄位可查**的。

### 落點（照先例，不發明）

```
src/core/types.ts              interface Target          型別（與 Topic／StylePreset 同處）
src/core/target-registry.ts    登錄與查找                ⚠️ 照 topic-registry 的形狀
src/languages/cpp/targets/     cpp.json ／ c.json        資料
```

### 標頭對映：5 筆，而**它住在語言套件**

```
<cstring> → <string.h>   <cstdlib> → <stdlib.h>   <cctype> → <ctype.h>
<cmath>   → <math.h>     <cstdio>  → <stdio.h>
```

⚠️ **由 `style` 的既有欄位觸發**（`header_style` 已經存在），
🔴 **不新增一個「目標決定標頭」的機制**——目標只是選了那個 style。

### `struct` 標籤：一個 `if`

C 的 `struct Point p;` vs C++ 的 `Point p;`。⚠️ 而它**由 style 決定**，
與標頭同一條路徑。

## 實作順序（依賴決定）

```
① 先跑 c-style-parity，記下 6/10 與【是哪 4 段】   ← 沒有指名就修不到點
② 5 筆標頭對映 ＋ struct 標籤            → 6/10 → 10/10
③ Target 型別 ＋ 登錄表 ＋ 兩筆資料
④ UI 接上（選目標 → 同時設 topic 與 style）
⑤ 護欄：中立性 total 仍 0；基線不動
⑥ findings ＋ 知識反流
```

🔴 **而這個順序在動手時被推翻了**（research Q4）：
**沒有任何既有 style 欄位標得出「這是 C」**——`printf` 競賽也是、
`explicit` google 也是。合取只是今天剛好沒有別人命中。

> **一個靠既有欄位合取推出來的身分，不是一個身分。**

→ **實際順序：③ target 先，② 用 `target.id` 判。**
⚠️ 而那正好證明了 target 的必要性——**「具名」不是便利，
是那個組合本身就是一個身分**。

## 風險（承 research，只列 plan 新增的）

| 風險 | 對策 |
|---|---|
| 🔴 目標長成新抽象層 | 形狀只有四欄，**兩個引用兩個標籤**；tasks 有一個檢查點逐欄位對照 |
| 編得過的漏網 | ⚠️ 對映表**逐筆列出**（5 筆全部寫進測試），不靠編譯結果反推 |
| 核心 import 語言套件 | 登錄表用**注入**——照 `topic-registry` |
| ④ 動 UI 而弄壞既有狀態 | ⚠️ **沒有選目標時行為與今天完全相同**（spec FR-005）是硬條件 |

## Complexity Tracking

無違規。
