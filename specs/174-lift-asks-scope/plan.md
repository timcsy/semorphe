# Implementation Plan: 讓 lift 樣式問得出「這個名字被宣告過嗎」

**Branch**: `174-lift-asks-scope` | **Date**: 2026-09-06 | **Spec**: [spec.md](spec.md)

## Summary

```
① AstConstraint 加一格 notDeclared        「這個名字必須沒有被宣告」
② checkConstraints 收 LiftContext          ⚠️ 兩個呼叫點【手邊都有 ctx】，只是沒傳
③ recordDeclaration 認得 enumerator        列舉成員今天不進 declarations
④ builtin_constant 的 EOF／NULL 加那一格
⑤ 🔴 重開 pin_constant 的 lift 樣式        ← 這一刀真正的收益（round-trip 不掉形狀）
```

## Technical Context

**Language/Version**: TypeScript 5.x · tree-sitter-cpp
**Testing**: Vitest（單元 ＋ 護欄 ＋ 探針）· Playwright（既有 e2e 當回歸）
**Constraints**: 🔴 **既有 e2e 一條不改**；第三十二條護欄（行為的誤差）**一條不改**
**Scale/Scope**: 4 個檔改 ＋ 2 顆膠囊的宣告 ＋ 1 個新樣式檔

## Constitution Check

| 條款 | 判定 | 依據 |
|---|---|---|
| **I. 簡約優先** | 🟢 過 | 加**一格** constraint，形狀對齊既有的 `absent`。不做兩趟掃描（Out of Scope） |
| **II. TDD** | 🟢 過 | 兩支探針**已經是先紅**：它們今天量到的就是缺陷 |
| **III. Git 紀律** | 🟢 過 | 兩段：① 機制（constraint ＋ scope）② 兩顆膠囊接上 |
| **IV. 規格保護** | 🟢 過 | A-002 那個近似寫在 spec 裡，不因實作困難而改 |

🔴 **最大的風險是「修好一半」**：US1（不搶）修好而 US2（沒人宣告時仍要認）壞掉
——而只驗 US1 的測試會全綠。

## 實作順序

### ① 先紅
1. 把兩支探針的「量」改成「**斷言**」——它們今天就會紅在真的行為上
2. 加 US2／US3 的反向斷言（沒人宣告時仍要認 · round-trip 不掉形狀）

### ② 再綠
3. `AstConstraint.notDeclared` ＋ `checkConstraints(node, constraints, ctx)`
4. `recordDeclaration` 認 `enumerator`
5. `builtin_constant` 的 EOF／NULL 加 `notDeclared: true`
6. `pin_constant` 重開 lift 樣式（帶 `notDeclared: true`）
   ——⚠️ 那顆膠囊的 `_lift_why` 要改寫：**它記的是一個已經被解掉的兩難**

### ③ 收尾
7. `npm test` ＋ e2e 全套（**一條不改**）
8. 基線 · vision · `history/` 一筆轉變

## 風險與緩解

| 風險 | 緩解 |
|---|---|
| 🔴 **修好一半**（US1 綠而 US2 壞） | 兩個方向都寫成斷言，而**反向那個先寫** |
| 🔴 宣告寫在使用**之後** → 仍會被搶 | spec 的 Out of Scope 明說（要兩趟掃描）。⚠️ 而測試要**釘住那個已知界線**，不然它會被誤讀成 bug |
| ⚠️ 作用域彈出的時機 | 探針已經驗過（離開 `{ }` 之後查不到 ✅） |
| ⚠️ `pin_constant` 重開讓第三十二條護欄紅 | 那正是它該做的——**紅了就是修錯了** |
