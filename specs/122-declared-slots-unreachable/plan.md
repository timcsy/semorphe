# Implementation Plan: 宣告了的接點在積木上表達不出來

**Branch**: `122-declared-slots-unreachable` | **Date**: 2026-08-14 | **Spec**: [spec.md](spec.md)

## Summary

12 筆確定的資料遺失——**宣告了接點，而積木上沒有表達路徑**。
使用者已經撞過同一個病一次（`int a[3] = {1,2,3}` 的初始值消失）。

🔴 **而 research 發現子機制有三種不是兩種**，且第三種是這個專案已知的
**雙重真相**陷阱（積木在 `block-registrar.ts` 命令式產生，而 JSON 的 `args0` 是空的）。

→ **每一顆元件是一個獨立的交付**，而交付順序按**成本**排（先便宜的），
不按使用者影響排——理由見 research「交付順序」。

## Technical Context

**Language/Version**: TypeScript 5.x | **Primary Dependencies**: Blockly 12.4.1

**Storage**: localStorage（⚠️ 存檔遷移是紅線） | **Testing**: Vitest、Playwright

**Project Type**: 單一前端專案

**Performance Goals**: 無新增

**Constraints**: 🔴 **只新增插槽，不改名不移除**（存檔紅線）；
其餘 42 條量測基線不動；⚠️ 工具箱／課程快照可能變動 → 一起改並說明

**Scale/Scope**: 12 筆違規／12 顆元件（其中 3 顆是第一週語法）。
⚠️ **每顆獨立交付**——本輪能做完幾顆就交付幾顆，而**剩下的要逐筆寫下理由**

## Constitution Check

| 原則 | 判定 | 依據 |
|---|---|---|
| **I. 簡約優先／YAGNI** | ✅ | 每顆只加**它宣告過的**那個插槽。⚠️ 不做「預防機制」（Out of Scope）——那會影響每一顆元件的加法，是獨立決定 |
| **II. TDD（非妥協）** | ✅ | 每顆先寫一支**來回測試**（放進去 → render → extract → 還在），今天必紅 |
| **III. Git 紀律** | ✅ 🔴 **一顆一個 commit** | 三種子機制的修法完全不同，混在一起**一顆出問題其餘無法二分**（research 決策 1） |
| **IV. 規格文件保護** | ✅ | |
| **V. 繁體中文優先** | ✅ | |

⚠️ **一個要正面說的**：本功能**可能無法一輪清完 12 筆**。
而 spec 的 FR-004 就是為此寫的——**剩下的每一筆要寫下為什麼，而不是靜靜留著**。

> 🔴 **一筆靜靜留在那裡的違規，與一筆被遺忘的違規長得一模一樣。**

## Project Structure

```text
src/components/cpp/<元件>/
├── component.json            ⚪ 宣告已經對了，不動
├── forms/blocks.json         🔴 加 input ＋ renderMapping（子機制①②）
└── labels/{zh-TW,en}.json    🟡 新插槽的標籤

src/ui/block-registrar.ts     🔴 子機制③：命令式註冊的那幾顆
tests/integration/            🆕 每顆一支來回測試
tests/baselines/conformance.json  🟡 數字下降 ＋ 理由（FR-005）
```

**Structure Decision**: 沿用膠囊結構。⚠️ 不新增目錄。

## Phase 1：設計產出

- [contracts/slot-roundtrip.md](contracts/slot-roundtrip.md) · [data-model.md](data-model.md) · [quickstart.md](quickstart.md)

## Complexity Tracking

| 違反 | 為什麼需要 | 更簡單的方案為何不行 |
|---|---|---|
| **無** | —— | ⚠️ 唯一的複雜度來源是**子機制③的雙重真相**，而那是既有的架構，不是本功能引入的 |

## Constitution Re-check（Phase 1 後）

| 原則 | 複查 |
|---|---|
| **I. 簡約優先** | ✅ 每顆的改動是「一個 input ＋ 一條對映 ＋ 兩份標籤」。沒有新機制 |
| **II. TDD** | ✅ 來回測試先紅；而**每顆改完都要跑符合性量測** |
| **III. Git 紀律** | ✅ 一顆一個 commit——而那讓「做到哪裡」永遠是明確的 |
| **IV／V** | ✅ |
