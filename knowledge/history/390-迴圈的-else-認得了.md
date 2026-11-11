# 390 · 迴圈的 `else:` 認得了

> 日期：2026-11-12（417）
> 轉變：Python 的 `while … else:`／`for … else:` 從「整顆降級」變成 `python:loop_while`／`python:loop_for` 的新接點 `else_body`；積木多一個齒輪，裡面只有一顆「沒被中斷就」。
>
> | 寫法 | 417 之前 | 417 |
> |---|---|---|
> | `for … else:`、`while … else:` | 整顆降級（2026-08-23 起；更早是**安靜地丟掉** else 那一段） | 認得；來回一字不差；Cella 判決（`sFor`／`sWhile` 的 `orelse`） |
> | 同上，走一趟真的積木 | （lift 就降級了） | 一字不差，`for` 的多個名字 ＋ else 也是 |
> | 同上，轉成 C++ | 降級 | 照實保留（`outside-subset`：C++ 沒有一對一的寫法） |

## 為什麼是齒輪、為什麼不叫「否則」

手勢跟 `if` 的 else 一樣：齒輪裡拖一顆小積木進容器，積木下面就多一段。使用者 2026-08-21 說過兩個語言、兩顆同族積木的互動要一致，所以同一個「可有可無的尾巴」用同一種手勢。

標籤寫「沒被中斷就」（英文 `if no break`）。迴圈的 `else` 不是條件不成立：迴圈跑完而沒有遇到 `break` 才會做。寫成「否則」，學生會讀成「條件一開始就不成立才做」。

## 一顆積木兩個機制

`for` 已經有參數列的 `＋`／`−`（`attachParamList`），它也寫 `saveExtraState`。新的 `attachElseTail`（`src/panels/blocks/branch-list-block.ts`）是包上去的：它只管 `hasElse` 一個鍵，交給參數列的那一份先拿掉這個鍵。一顆積木只能有一個 mutator，所以如果那顆積木已經真的掛了齒輪，建積木的當下就丟例外，不會安靜地蓋掉。（參數列的原型上一律有 `decompose`，但只有在有可選段落時才掛齒輪，所以量的是實例上有沒有齒輪，不是原型上有沒有那個函式。）

## lift 從純資料換成策略

`while` 原本是 `lift-pattern.json` 加上 `absent: alternative` 的限制。else 那一段住在 `else_clause` 裡（第二層），`else:` 底下第一行的註解也掛在 `else_clause` 上，`fieldMappings` 拿不到，所以換成具名策略 `python:liftLoopWhile`，與 `python:if` 收 else 的做法相同。

## 跟 Cella 的介面

Python 的 formalize 模板由 `tools/sync-python-formalize.py` 從 Cella 的對照表同步。這一刀先在本地把兩筆的 `orelse` 從 `[]` 改成 `{"$stmts": "else_body"}`（沒有 else 時是空清單；用 `$body` 的話空接點會補一個 `sPass`，每個迴圈都會多送一段 `else: pass`——第一版就寫錯成那樣，被「範例照展開器展開與 CPython ast 相同」那支測試抓到），並向 cella 提議改對照表（2026-11-12），否則下次同步會蓋回去。

測試：兩顆元件的 `spec.test.ts`（lift、來回、Cella 執行：break 了不做 else）、`tests/integration/python-loop-names-through-blocks.test.ts`（走真 Blockly）、盲測 `fuzz_4` 從「照實保留」轉成整段認得且輸出相符、`python-comment-roundtrip` 改成斷言正規化後的形狀與不動點。
