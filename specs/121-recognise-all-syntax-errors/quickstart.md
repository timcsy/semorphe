# Quickstart

**Date**: 2026-08-14

⚠️ **每一步之後都要跑第四十三條護欄**——它是這個功能被允許存在的條件。

## 前置

```bash
npx tsc --noEmit && npm test 2>&1 | tail -3          # 現況 4153
npx vitest run tests/integration/audit-false-syntax-error.test.ts   # 必須是 0
```

## 步驟一：🔴 先紅——三種形狀都要被標記

`tests/unit/core/lift-syntax-error.test.ts` 補：

```
A  少分號，下一行 return      → 必須被標記   今天 ❌ → 紅
C  少分號，下一行是另一個宣告  → 必須被標記   今天 ❌ → 紅
B  少分號，下一行是輸出        → 必須被標記   今天 ✅（不得退步）
```

## 步驟二：🔴 先紅——落點不得往上飄

```
★ 標記的節點【不含】 cpp:program        今天 ✅（安全網之一）
★ 被標記的節點數 = 1（單一錯誤）        A/C 今天是 0 → 紅
```

⚠️ 這一步是 US3 的一半——另一半（合法語料誤標 0）由第四十三條守著。

## 步驟三：🔴 先紅——訊息引用完整原文

```
★ B 的 rawCode 是「int x = 1」不是「1」   今天 ❌ → 紅
```

## 步驟四：實作

```
src/core/lift/types.ts    AstNode 加 hasError?: boolean
src/core/lift/lifter.ts   hasErrorDescendant 認旗標；rawCode 一律用 node.text
```

```bash
npx vitest run tests/unit/core/lift-syntax-error.test.ts     # 應轉綠
npx vitest run tests/integration/audit-false-syntax-error.test.ts   # 🔴 必須仍是 0
```

## 步驟五：反向驗證（真的跑）

```
把落點邏輯的 claimed 判斷拿掉  → 標記飄到 cpp:program，步驟二必須紅
把判定改回只認 ERROR 節點      → 步驟一的 A/C 必須紅
讓判定也吃 unsupported         → 第四十三條必須紅
```

## 步驟六：US5 的上限

```
tests/probes/scenario-coverage.test.ts   300000 → 900000 ＋ 理由
```

⚠️ 理由要寫：**1.5 倍於最差實測（575 秒），而上限是偵測卡死不是強制速度。**

## 步驟七：瀏覽器實測（⚠️ 重 build）

| 情境 | 該看到 |
|---|---|
| 三種漏分號 → 按執行 | 🔴 **三種都不跑** |
| 積木上的訊息 | 引用完整的一行，不是片段 |
| 正常程式 → 按執行 | 正常跑 |

## 步驟八

```bash
npm test；npx vitest run tests/integration/audit-*.test.ts；npm run test:e2e
git diff --stat tests/baselines/     # 🔴 必須是空的
```
