# 386 · f-string 的轉換（`!r`／`!s`／`!a`）是插值那一格的屬性

> 日期：2026-11-11（412）
> 轉變：`f'{s!r:<6}'` 的 `!r` 從「整句降級」變成插值那一格（`python:string_insert`）的屬性 `conversion`，積木上是一個下拉。
>
> | 時期 | `f'{s!r:<6}'` 走一趟 |
> |---|---|
> | 410 之前 | 產回 `f"{s:<6}"`，`!r` 被安靜丟掉，印出來少了引號 |
> | 410 | 整句降級成照實保留的一段（誠實，但積木上是一塊看不懂的文字） |
> | 412 | 一字不差；Cella 照實跑出 `'q'   ` |

## 為什麼現在做得起來

Cella 的 Python 程式形狀照 CPython 的 AST，`eFormattedValue` 本來就有 `conversion` 欄位（沒有是 -1，其餘是字母的字元碼）。我們一直送 -1。所以缺的只有我們這側的一格，不必等 Cella。

## 為什麼是屬性，不是黏進格式字串

文字欄位裝得下 `!r:<6`，但那是「字串裡藏著結構」，而且轉換與格式是兩件事：先轉換、再套格式。與格式規格 `format` 當初成為一格的理由相同（見那顆的 `_properties_why`）。

## 留下的邊界

- `{x=}`（自我說明）仍整句降級：它要把運算式的原文也印出來，那一格還沒有位置放。
- 文法收得下、Python 不收的轉換字母（`!x`）整句降級，不猜。

測試：`src/components/python/string_make/spec.test.ts`（lift、來回、Cella 執行）、`tests/integration/python-loop-names-through-blocks.test.ts`（走真 Blockly，空字串那個選項＝沒有轉換）、盲測 `fuzz-python-student` 的 fuzz_6 從降級變成整段認得、輸出相符。
