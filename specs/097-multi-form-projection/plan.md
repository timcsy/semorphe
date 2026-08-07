# 實作計畫：多形態機制——一個元件身分，多個積木形態

**Feature**: `097-multi-form-projection` ｜ **Spec**: [spec.md](spec.md) ｜ **Created**: 2026-08-07

## Summary

讓一個 `conceptId` 能對應多個積木形態，並依**宣告的選擇軸**選出正確的那一個。

第一個真實案例是容器操作：`cpp_container_push` / `cpp_container_pop` 在堆疊上顯示「頂端」、在佇列上顯示「尾端」——**修一個學生實際回報的困惑**。同時解除 B 項（身分整併）的最大阻斷。

**核心發現（見 [research.md](research.md)）：這不是新機制，是把既有的 `expressionCounterpart` 一般化。** 系統已經在做「一個概念、兩個形態、依位置選」，只是那條軸寫死了，而且鍵是 blockType 不是 conceptId。

## Technical Context

| | |
|---|---|
| 語言／工具 | TypeScript 5.x、Blockly 12.4.1、Vitest |
| 儲存 | localStorage（`semorphe-state`），版本閘門在 `src/core/storage-version.ts` |
| **活的渲染路徑** | `PatternRenderer.renderSpecs: Map<conceptId, RenderSpec>` |
| **宣告但零呼叫者** | `BlockSpecRegistry.byConceptId` — 改它不會改變行為，但不改會讓宣告與實作分歧 |
| 抽取路徑 | `PatternExtractor.extractSpecs: Map<blockType, …>` — **不用改**，多形態天然成立 |
| 遷移機制 | `UPGRADES: Record<number, Upgrade> = {}` — **已存在且是空的**，`CURRENT_VERSION` 仍是 1 |
| 既有的形態配對 | `renderMapping.expressionCounterpart`，5 個活的使用者 |

**無 NEEDS CLARIFICATION**——研究階段已把四個未知全部解掉。

## Constitution Check

| 原則 | 判定 | 說明 |
|---|---|---|
| **I. 簡約優先** | ⚠️ 需辯護 | 「具名的選擇軸」比「再加一個寫死欄位」複雜。**辯護**：目前**已有兩條軸**（`role`、`container_kind`），不是為假設性未來預留。寫死兩個欄位的話第二條軸就要改核心，而 P3 說「新增不得改變既有」。**但不建外掛系統**——軸的解析就是一張表。 |
| **II. TDD（非妥協）** | ✅ | 每個 task 先寫會紅的測試。**FR-002 刻意寫成「MUST NOT 蓋掉先註冊的」**——因為蓋掉是現況，可以直接對著它寫紅燈。 |
| **III. Git 紀律** | ✅ | 每組 task commit 一次；存檔轉換與型別改名分成兩個 commit（順序不可反）。 |
| **IV. 規格文件保護** | ✅ | 不動 specs/ 既有檔。 |
| **V. 繁體中文優先** | ✅ | 文件中文，識別字英文。 |

**設計後複查**：`Complexity Tracking` 一節記著唯一那筆需要辯護的複雜度。

## Project Structure

### Documentation

```
specs/097-multi-form-projection/
  spec.md          需求（已完成）
  plan.md          本檔
  research.md      四個決定 ＋ 一處對規格的更正
  data-model.md    FormSet / FormAxis / container_kind / 存檔狀態轉移
  contracts/
    form-selection.md   C-1..C-5 與反例
  quickstart.md    由外而內的驗證順序
```

### Source Code

```
src/core/
  types.ts                       + FormSet / FormAxis 型別
  block-spec-registry.ts         byConceptId → 一對多（宣告側）
  projection/
    pattern-renderer.ts          renderSpecs → FormSet；選擇函式（活的路徑）
  storage-version.ts             CURRENT_VERSION 1→2；UPGRADES[1]

src/languages/cpp/
  core/lifters/strategies.ts     辨識時寫入 container_kind
  core/blocks.json               容器操作的兩個形態宣告

src/i18n/{zh-TW,en}/blocks.json  接上既有的死字串

tests/
  unit/core/form-selection.test.ts        契約 C-1..C-5
  unit/storage-version.test.ts            （既有）轉換階梯
  integration/multi-form-container.test.ts  學生看得到的那件事
```

## 實作順序（依賴決定，不可調換）

```
① 契約測試（全紅）
      ↓
② 存檔轉換 UPGRADES[1] ＋ CURRENT_VERSION 2
      ↓   ← 必須在型別改名之前，否則中途任一 commit 都會弄壞既有存檔
③ FormSet 型別 ＋ 選擇函式（核心，不含任何元件身分）
      ↓
④ renderSpecs 改用 FormSet（活的路徑）
      ↓
⑤ byConceptId 一對多（宣告側，補齊一致性）
      ↓
⑥ 辨識寫入 container_kind
      ↓
⑦ 容器的兩個形態宣告 ＋ 接上死字串
      ↓
⑧ 全套 ＋ 護欄複查
```

**② 排在 ③ 之前是硬條件。** 存檔轉換先落地，之後每一個 commit 都保持「舊存檔載得起來」。反過來做的話，中間會有一段時間任何人重開專案都會壞——而那段時間有多長取決於後續順不順利，那是不能賭的。

## Complexity Tracking

| 複雜度 | 為什麼賺得起 | 更簡單的做法為何不夠 |
|---|---|---|
| **具名的選擇軸**（而非再加一個寫死欄位） | **已有兩條軸在跑**：`role`（依呈現位置）與 `container_kind`（依節點屬性）。兩條軸的取值來源不同，寫死欄位裝不下第二條。 | 「再加一個 `containerCounterpart` 欄位」——那會讓第三條軸來時再改核心一次，違反 P3；而且兩個平行欄位是同一個概念的兩份表示（雙重真相）。 |

**明確不做的**：軸的外掛註冊系統。軸的解析是**一張表**，加一條軸就是加一列。YAGNI。

## 風險與已備的緩解

| 風險 | 緩解 | 誰會叫 |
|---|---|---|
| 多形態退化成複製實作 | CK-3：執行器 MUST NOT 讀 `container_kind` | 執行器重複註冊護欄 |
| 選擇規則以元件身分分支 | 契約 C-2 | **中立性護欄**（這是契約裡唯一有機械檢查的一條） |
| 積木型別改名弄壞存檔 | 順序 ② 先於 ⑦ | `storage-version.test.ts` 的階梯測試 |
| 標籤改了但仍不說位置 | SC-001 驗「不看 tooltip」 | 只有人驗得到——quickstart 有手動那一格 |
| 兩個形態產出不同 | 契約 C-3 | 整合測試「產出相同」 |

## Out of Scope

見 [spec.md](spec.md)。特別提醒：**本功能只提供機制，不執行身分整併**——6 對 statement/expression 在此完全不動。
