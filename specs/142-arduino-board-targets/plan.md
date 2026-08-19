# 實作計畫：板子成為目標，而它決定學生看得到什麼

**Branch**: `142-arduino-board-targets` · **Date**: 2026-08-19
**Spec**: [spec.md](spec.md)

## Summary

給 `Target` 加一格 **`provides`**（這塊板子提供哪些能力），給元件的 `traits`
加一個 **`needsCapability`**，工具箱的可見集合取兩者的交集。
🔴 **只作用在工具箱**——lift／generate／畫布上的既有積木一律不動。

## Technical Context

**語言／依賴**：TypeScript 5.x · Blockly 12.4.1 · Vitest（**無新增依賴**）
**儲存**：localStorage（目標選擇沿用既有機制）
**測試**：`npm test`（護欄 31 條 ＋ 本刀新增 2 條）
**規模**：3 個新目標定義 · 5 顆元件加一行 `traits` · 1 個過濾點 · 2 條護欄

**Unknowns**：**無**。Phase 0 的四個問題全部有答案，見 [research.md](research.md)。

## Constitution Check

| 條 | 判定 | 依據 |
|---|---|---|
| **I. 簡約優先** | 🟢 | 能力只定義**兩個**（`touch`／`ledc-pwm`），有當前元件當理由；🔴 **US3（腳位常數）被移出**，因為它需要一個不存在的機制而沒有當前需求（R3） |
| **II. TDD（非妥協）** | 🟢 | 順序寫進下面的「不可交換的順序」；⚠️ **護欄先於功能**是本刀最硬的約束 |
| **III. Git 紀律** | 🟢 | 每一組任務一個 commit |
| **IV. 規格文件保護** | 🟢 | 不覆蓋 `specs/`；⚠️ 本刀**要修改 spec.md 兩處**（見下），那是**修訂**不是覆寫，且留紀錄 |
| **V. 繁體中文優先** | 🟢 | 文件中文、識別字英文 |

### 🔴 Phase 0 之後要修訂規格的兩處

| 規格原文 | 研究發現 | 怎麼改 |
|---|---|---|
| **FR-008** 可拿性判準要放寬 | 護欄算的是分類定義，**與目標無關**——原封不動就是綠的（R2） | 改成「**新增能力供給完備性檢查**」：每個被需要的能力至少一個目標提供 |
| **FR-005 / US3** 三塊板子腳位常數不同 | `properties.values` 是靜態宣告，要它隨目標變需要**不存在的機制**（R3） | 移到「明確排除」，並在 vision 開一筆「屬性的候選值由目標提供」 |

> **一個 Phase 0 如果沒有改到任何規格，它多半沒有真的去查。**

## 🔴 不可交換的順序

```
① 能力供給完備性護欄            ← 先蓋，此時它是【綠】的（還沒有人宣告能力）
② 兩顆元件的 traits + 三個目標   ← 蓋完之後，護欄開始有輸入
③ 過濾點 + 可見性測試
④ US2 的反向測試（lift 不受影響）
⑤ 快照與基線
```

⚠️ **①②不可對調**。`skills/build-guardrail` 6.5 逐字：

> 「**護欄先蓋，功能後做。**……一個被順便修掉的缺陷不會留下任何紀錄，
> 而它的同類還會再來。」

🔴 **而①有一個特殊處**：它第一次跑會是**綠**的（今天沒有元件宣告能力）。
那違反 6.5「第一次跑必須是紅的」——**處置是注入**，同一節的例外條款：

> 「這種情況靠的是注入，不是靠第一次的紅」

→ ① 必須附一支注入：**合成一顆需要不存在能力的元件 → 必須被報出**。

## Project Structure

### Documentation

```
specs/142-arduino-board-targets/
├── spec.md              規格（⚠️ Phase 0 後要修訂兩處）
├── plan.md              本檔
├── research.md          Phase 0——四個問題、兩個改變規格的發現
├── data-model.md        能力 · Target.provides · 可見集合的計算
├── contracts/
│   └── capability.md    宣告形狀 ＋ 唯一入口 ＋ 護欄判準
├── quickstart.md        怎麼證明它做到了（含人工驗收四條）
└── checklists/
    └── requirements.md
```

### Source Code

```
src/core/types.ts                          Target 加 provides
src/core/component/traits.ts               capabilityOf() · targetProvides()  ← 唯一入口
src/ui/toolbox-builder.ts                  唯一的過濾點
src/languages/cpp/targets/                 三個板子的目標定義（新）
src/components/cpp/touch_read/component.json      traits.needsCapability
src/components/cpp/pwm_{attach,setup,bind,write}/ 同上

tests/integration/audit-capability-supply.test.ts       新護欄（硬性零）
tests/integration/board-target-visibility.test.ts       US1
tests/integration/board-target-lift-unaffected.test.ts  US2 ← 最容易做錯的方向
```

## Complexity Tracking

| 新增的複雜度 | 當前需求 | 為什麼不能更簡單 |
|---|---|---|
| `Target.provides` 一格 | 學生拉得到編不過的積木 | 沒有更小的表達方式——目標必須說得出它有什麼 |
| `traits.needsCapability` 一鍵 | 同上，另一端 | 走既有的 `traits`，**沒有新機制**（R1：`ioStyle` 是同一形狀） |
| 兩條護欄 | 憲法 II ＋ 新開的洞（R2） | 一條守供給完備性、一條守可見性；**少一條就有一半沒人看** |
| ~~屬性候選值隨目標變~~ | ❌ **無當前需求** | 憲法 I 否決，移出本刀（R3） |

## 風險與對策

| 風險 | 來自 | 對策 |
|---|---|---|
| 🔴 把「拿不到」做成「認不得」 | P4「過濾不是簡化」 | US2 的反向測試（步驟④），⚠️ **它比正向那支重要** |
| 過濾過頭——整個分類消失 | 空分類的處理 | 人工驗收第 1 條明寫「🔴 壞的是整個分類消失」 |
| 切回去沒復原 | 過濾有殘留狀態 | 人工驗收第 2 條 |
| 既有積木被吃掉 | 順手做多 | 人工驗收第 4 條（**保護性**：驗我們沒有做多） |
| 三塊板子從一塊推論 | `experience.md`「一叢違規不一定同一個根因」 | Nano **逐塊斷言** |
